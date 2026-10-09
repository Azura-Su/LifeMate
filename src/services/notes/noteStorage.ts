import {
  collection,
  deleteDoc,
  doc,
  getDocsFromServer,
  getFirestore,
  setDoc,
} from '@react-native-firebase/firestore';
import type { LifeNote } from '../../types/note';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';

type Cache = {
  notes: LifeNote[];
  deletedIds: string[];
  pendingIds: string[];
  migrationComplete: boolean;
};
export type NoteStorageResult = { notes: LifeNote[]; synced: boolean };
const keyFor = (uid: string) => `lifemate:notes:v1:${encodeURIComponent(uid)}`;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const CLOUD_TIMEOUT_MS = 10_000;
const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  const next = (queues.get(uid) ?? Promise.resolve())
    .catch(() => undefined)
    .then(operation);
  queues.set(uid, next);
  void next
    .finally(() => {
      if (queues.get(uid) === next) queues.delete(uid);
    })
    .catch(() => undefined);
  return next;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Cloud timeout')),
      CLOUD_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function parseNote(value: unknown, uid: string): LifeNote | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<LifeNote>;
  if (
    item.ownerId !== uid ||
    typeof item.id !== 'string' ||
    !ID.test(item.id) ||
    typeof item.title !== 'string' ||
    !item.title.trim() ||
    item.title.length > 120 ||
    typeof item.body !== 'string' ||
    item.body.length > 20000 ||
    typeof item.updatedAt !== 'number' ||
    !Number.isFinite(item.updatedAt)
  )
    return null;
  return { ...item, title: item.title.trim() } as LifeNote;
}

function parseDeletedId(value: unknown, uid: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const tombstone = value as {
    id?: unknown;
    ownerId?: unknown;
    deleted?: unknown;
  };
  return tombstone.ownerId === uid &&
    tombstone.deleted === true &&
    typeof tombstone.id === 'string' &&
    ID.test(tombstone.id)
    ? tombstone.id
    : null;
}

async function readCache(uid: string): Promise<Cache> {
  const raw = await getEncryptedItem(uid, keyFor(uid));
  if (!raw)
    return {
      notes: [],
      deletedIds: [],
      pendingIds: [],
      migrationComplete: false,
    };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object')
      return {
        notes: [],
        deletedIds: [],
        pendingIds: [],
        migrationComplete: true,
      };
    const cache = value as Partial<Cache>;
    const ids = (list: unknown) =>
      Array.isArray(list)
        ? list.filter(
            (id): id is string => typeof id === 'string' && ID.test(id),
          )
        : [];
    return {
      notes: Array.isArray(cache.notes)
        ? cache.notes
            .map((note) => parseNote(note, uid))
            .filter((note): note is LifeNote => !!note)
        : [],
      deletedIds: ids(cache.deletedIds),
      pendingIds: ids(cache.pendingIds),
      migrationComplete: cache.migrationComplete === true,
    };
  } catch {
    return {
      notes: [],
      deletedIds: [],
      pendingIds: [],
      migrationComplete: true,
    };
  }
}

async function writeCache(uid: string, cache: Cache) {
  await setEncryptedItem(uid, keyFor(uid), JSON.stringify(cache));
}

function path(uid: string, id?: string) {
  const firestore = getFirestore();
  return id
    ? doc(firestore, 'noteAccounts', uid, 'notes', id)
    : collection(firestore, 'noteAccounts', uid, 'notes');
}

function deletionPath(uid: string, id?: string) {
  const firestore = getFirestore();
  return id
    ? doc(firestore, 'noteAccounts', uid, 'deletedNotes', id)
    : collection(firestore, 'noteAccounts', uid, 'deletedNotes');
}

function tombstone(uid: string, id: string) {
  return { id, ownerId: uid, deleted: true, updatedAt: Date.now() };
}

function sortNotes(notes: LifeNote[]) {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function readNotesInternal(uid: string): Promise<NoteStorageResult> {
  const cache = await readCache(uid);
  try {
    const [snapshot, deletedSnapshot] = await Promise.all([
      withTimeout(
        getDocsFromServer(path(uid) as ReturnType<typeof collection>),
      ),
      withTimeout(
        getDocsFromServer(deletionPath(uid) as ReturnType<typeof collection>),
      ),
    ]);
    const rows = snapshot.docs.map((item) => item.data());
    const deletedRows = deletedSnapshot.docs.map((item) => item.data());
    const remoteDeletedIds = new Set(
      [...rows, ...deletedRows].flatMap((row) => {
        const id = parseDeletedId(row, uid);
        return id ? [id] : [];
      }),
    );
    const deletedIds = new Set([...cache.deletedIds, ...remoteDeletedIds]);
    const merged = new Map<string, LifeNote>();
    for (const row of rows) {
      const note = parseNote(row, uid);
      if (note && !deletedIds.has(note.id)) merged.set(note.id, note);
    }
    const pendingIds = new Set(cache.pendingIds);
    const toUpload: LifeNote[] = [];
    for (const local of cache.notes) {
      if (deletedIds.has(local.id)) continue;
      const remote = merged.get(local.id);
      const pending = pendingIds.has(local.id);
      const isLegacyChange =
        !cache.migrationComplete &&
        (!remote || local.updatedAt > remote.updatedAt);
      if (pending || isLegacyChange) {
        toUpload.push(local);
        merged.set(local.id, local);
      }
    }
    await Promise.all(
      toUpload.map((note) =>
        withTimeout(setDoc(path(uid, note.id) as ReturnType<typeof doc>, note)),
      ),
    );
    const pendingDeletes = cache.deletedIds.filter(
      (id) => !remoteDeletedIds.has(id),
    );
    const remoteActiveIds = new Set(
      rows.flatMap((row) => {
        const note = parseNote(row, uid);
        return note ? [note.id] : [];
      }),
    );
    const activeDeletes = [
      ...new Set([
        ...pendingDeletes,
        ...[...remoteDeletedIds].filter((id) => remoteActiveIds.has(id)),
      ]),
    ];
    await Promise.all(
      pendingDeletes.map(async (id) => {
        await withTimeout(
          setDoc(
            deletionPath(uid, id) as ReturnType<typeof doc>,
            tombstone(uid, id),
          ),
        );
      }),
    );
    await Promise.all(
      activeDeletes.map((id) =>
        withTimeout(deleteDoc(path(uid, id) as ReturnType<typeof doc>)),
      ),
    );
    const notes = sortNotes([...merged.values()]);
    await writeCache(uid, {
      notes,
      deletedIds: [],
      pendingIds: [],
      migrationComplete: true,
    });
    return { notes, synced: true };
  } catch {
    return { notes: sortNotes(cache.notes), synced: false };
  }
}

export function readNotes(uid: string): Promise<NoteStorageResult> {
  return enqueue(uid, () => readNotesInternal(uid));
}

export function saveNote(
  uid: string,
  value: LifeNote,
): Promise<NoteStorageResult> {
  return enqueue(uid, async () => {
    const note = parseNote(value, uid);
    if (!note) throw new Error('Ghi chú chưa hợp lệ.');
    const cache = await readCache(uid);
    if (cache.deletedIds.includes(note.id))
      throw new Error('Ghi chú này đã bị xóa. Hãy tạo ghi chú mới.');
    const notes = [note, ...cache.notes.filter((item) => item.id !== note.id)];
    const deletedIds = cache.deletedIds.filter((id) => id !== note.id);
    const pendingIds = [...new Set([...cache.pendingIds, note.id])];
    const nextCache = { ...cache, notes, deletedIds, pendingIds };
    await writeCache(uid, nextCache);
    try {
      await withTimeout(
        setDoc(path(uid, note.id) as ReturnType<typeof doc>, note),
      );
      await writeCache(uid, {
        ...nextCache,
        pendingIds: pendingIds.filter((id) => id !== note.id),
        migrationComplete:
          cache.migrationComplete ||
          notes
            .filter((item) => item.id !== note.id)
            .every((item) => cache.pendingIds.includes(item.id)),
      });
      return { notes: sortNotes(notes), synced: true };
    } catch {
      return { notes: sortNotes(notes), synced: false };
    }
  });
}

export function deleteNote(
  uid: string,
  id: string,
): Promise<NoteStorageResult> {
  return enqueue(uid, async () => {
    if (!ID.test(id)) throw new Error('Mã ghi chú không hợp lệ.');
    const cache = await readCache(uid);
    const notes = cache.notes.filter((item) => item.id !== id);
    const deletedIds = [...new Set([...cache.deletedIds, id])];
    const pendingIds = cache.pendingIds.filter((value) => value !== id);
    const nextCache = { ...cache, notes, deletedIds, pendingIds };
    await writeCache(uid, nextCache);
    try {
      await withTimeout(
        setDoc(
          deletionPath(uid, id) as ReturnType<typeof doc>,
          tombstone(uid, id),
        ),
      );
      await withTimeout(deleteDoc(path(uid, id) as ReturnType<typeof doc>));
      await writeCache(uid, {
        ...nextCache,
        deletedIds: deletedIds.filter((value) => value !== id),
        migrationComplete:
          cache.migrationComplete ||
          notes.every((item) => cache.pendingIds.includes(item.id)),
      });
      return { notes, synced: true };
    } catch {
      return { notes, synced: false };
    }
  });
}
