import {
  collection,
  deleteDoc,
  doc,
  getDocsFromServer,
  getFirestore,
  setDoc,
} from '@react-native-firebase/firestore';
import type { AgendaItem } from '../../types/agenda';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';

type Cache = {
  items: AgendaItem[];
  deletedIds: string[];
  pendingIds: string[];
  migrationComplete: boolean;
};
export type AgendaStorageResult = { items: AgendaItem[]; synced: boolean };
const keyFor = (uid: string) => `lifemate:agenda:v1:${encodeURIComponent(uid)}`;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_DATE_MS = 253402300799999;
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

function withCloudTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Cloud timeout')),
      CLOUD_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function parseItem(value: unknown, uid: string): AgendaItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<AgendaItem>;
  if (
    item.ownerId !== uid ||
    typeof item.id !== 'string' ||
    !ID.test(item.id) ||
    typeof item.title !== 'string' ||
    !item.title.trim() ||
    item.title.length > 120 ||
    typeof item.details !== 'string' ||
    item.details.length > 2000 ||
    typeof item.dueAt !== 'number' ||
    !Number.isFinite(item.dueAt) ||
    item.dueAt < 0 ||
    item.dueAt > MAX_DATE_MS ||
    typeof item.completed !== 'boolean' ||
    (item.reminderAt !== null &&
      (typeof item.reminderAt !== 'number' ||
        !Number.isFinite(item.reminderAt) ||
        item.reminderAt < 0 ||
        item.reminderAt > MAX_DATE_MS)) ||
    typeof item.updatedAt !== 'number' ||
    !Number.isFinite(item.updatedAt) ||
    item.updatedAt < 0 ||
    item.updatedAt > MAX_DATE_MS
  )
    return null;
  return { ...item, title: item.title.trim() } as AgendaItem;
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
      items: [],
      deletedIds: [],
      pendingIds: [],
      migrationComplete: false,
    };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object')
      return {
        items: [],
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
      items: Array.isArray(cache.items)
        ? cache.items
            .map((item) => parseItem(item, uid))
            .filter((item): item is AgendaItem => !!item)
        : [],
      deletedIds: ids(cache.deletedIds),
      pendingIds: ids(cache.pendingIds),
      migrationComplete: cache.migrationComplete === true,
    };
  } catch {
    return {
      items: [],
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
    ? doc(firestore, 'agendaAccounts', uid, 'items', id)
    : collection(firestore, 'agendaAccounts', uid, 'items');
}

function deletionPath(uid: string, id?: string) {
  const firestore = getFirestore();
  return id
    ? doc(firestore, 'agendaAccounts', uid, 'deletedItems', id)
    : collection(firestore, 'agendaAccounts', uid, 'deletedItems');
}

function tombstone(uid: string, id: string) {
  return { id, ownerId: uid, deleted: true, updatedAt: Date.now() };
}

function sortItems(items: AgendaItem[]) {
  return [...items].sort((a, b) => a.dueAt - b.dueAt);
}

async function readAgendaInternal(uid: string): Promise<AgendaStorageResult> {
  const cache = await readCache(uid);
  try {
    const [snapshot, deletedSnapshot] = await Promise.all([
      withCloudTimeout(
        getDocsFromServer(path(uid) as ReturnType<typeof collection>),
      ),
      withCloudTimeout(
        getDocsFromServer(deletionPath(uid) as ReturnType<typeof collection>),
      ),
    ]);
    const rows = snapshot.docs.map((docItem) => docItem.data());
    const deletedRows = deletedSnapshot.docs.map((docItem) => docItem.data());
    const remoteDeletedIds = new Set(
      [...rows, ...deletedRows].flatMap((row) => {
        const id = parseDeletedId(row, uid);
        return id ? [id] : [];
      }),
    );
    const deletedIds = new Set([...cache.deletedIds, ...remoteDeletedIds]);
    const merged = new Map<string, AgendaItem>();
    for (const row of rows) {
      const item = parseItem(row, uid);
      if (item && !deletedIds.has(item.id)) merged.set(item.id, item);
    }
    const pendingIds = new Set(cache.pendingIds);
    const toUpload: AgendaItem[] = [];
    for (const local of cache.items) {
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
      toUpload.map((item) =>
        withCloudTimeout(
          setDoc(path(uid, item.id) as ReturnType<typeof doc>, item),
        ),
      ),
    );
    const pendingDeletes = cache.deletedIds.filter(
      (id) => !remoteDeletedIds.has(id),
    );
    const remoteActiveIds = new Set(
      rows.flatMap((row) => {
        const item = parseItem(row, uid);
        return item ? [item.id] : [];
      }),
    );
    const activeDeletes = [
      ...new Set([
        ...pendingDeletes,
        ...[...remoteDeletedIds].filter((id) => remoteActiveIds.has(id)),
      ]),
    ];
    await Promise.all(
      pendingDeletes.map((id) =>
        withCloudTimeout(
          setDoc(
            deletionPath(uid, id) as ReturnType<typeof doc>,
            tombstone(uid, id),
          ),
        ),
      ),
    );
    await Promise.all(
      activeDeletes.map((id) =>
        withCloudTimeout(deleteDoc(path(uid, id) as ReturnType<typeof doc>)),
      ),
    );
    const items = sortItems([...merged.values()]);
    await writeCache(uid, {
      items,
      deletedIds: [],
      pendingIds: [],
      migrationComplete: true,
    });
    return { items, synced: true };
  } catch {
    return { items: sortItems(cache.items), synced: false };
  }
}

export function readAgenda(uid: string): Promise<AgendaStorageResult> {
  return enqueue(uid, () => readAgendaInternal(uid));
}

export function saveAgendaItem(
  uid: string,
  value: AgendaItem,
): Promise<AgendaStorageResult> {
  return enqueue(uid, async () => {
    const item = parseItem(value, uid);
    if (!item) throw new Error('Thông tin công việc chưa hợp lệ.');
    const cache = await readCache(uid);
    if (cache.deletedIds.includes(item.id))
      throw new Error('Công việc này đã bị xóa. Hãy tạo công việc mới.');
    const items = [
      item,
      ...cache.items.filter((current) => current.id !== item.id),
    ];
    const deletedIds = cache.deletedIds.filter((id) => id !== item.id);
    const pendingIds = [...new Set([...cache.pendingIds, item.id])];
    const nextCache = { ...cache, items, deletedIds, pendingIds };
    await writeCache(uid, nextCache);
    try {
      await withCloudTimeout(
        setDoc(path(uid, item.id) as ReturnType<typeof doc>, item),
      );
      await writeCache(uid, {
        ...nextCache,
        pendingIds: pendingIds.filter((id) => id !== item.id),
        migrationComplete:
          cache.migrationComplete ||
          items
            .filter((current) => current.id !== item.id)
            .every((current) => cache.pendingIds.includes(current.id)),
      });
      return { items: sortItems(items), synced: true };
    } catch {
      return { items: sortItems(items), synced: false };
    }
  });
}

export function deleteAgendaItem(
  uid: string,
  id: string,
): Promise<AgendaStorageResult> {
  return enqueue(uid, async () => {
    if (!ID.test(id)) throw new Error('Mã công việc không hợp lệ.');
    const cache = await readCache(uid);
    const items = cache.items.filter((item) => item.id !== id);
    const deletedIds = [...new Set([...cache.deletedIds, id])];
    const pendingIds = cache.pendingIds.filter((value) => value !== id);
    const nextCache = { ...cache, items, deletedIds, pendingIds };
    await writeCache(uid, nextCache);
    try {
      await withCloudTimeout(
        setDoc(
          deletionPath(uid, id) as ReturnType<typeof doc>,
          tombstone(uid, id),
        ),
      );
      await withCloudTimeout(
        deleteDoc(path(uid, id) as ReturnType<typeof doc>),
      );
      await writeCache(uid, {
        ...nextCache,
        deletedIds: deletedIds.filter((value) => value !== id),
        migrationComplete:
          cache.migrationComplete ||
          items.every((item) => cache.pendingIds.includes(item.id)),
      });
      return { items, synced: true };
    } catch {
      return { items, synced: false };
    }
  });
}
