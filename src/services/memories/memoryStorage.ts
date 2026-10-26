import {
  memoryPublishDefinitelyNotStarted,
  publishMemory,
  revokeDeletedMemory,
  unshareMemory,
} from './memorySharing';
import { randomUUID } from 'expo-crypto';
import {
  assertMemorySession,
  commitCloudMemory,
  downloadMemoryPhoto,
  MemoryCloudConflict,
  readCloudMemories,
  readCloudMemory,
  uploadMemoryPhoto,
} from './memoryCloud';
import * as FileSystem from 'expo-file-system/legacy';
import type {
  MemoryDraft,
  MemoryEntry,
  MemoryPhotoDimensions,
} from '../../types/memory';
import { parseDateKey, toDateKey } from '../../utils/vietnameseCalendar';
import { accountTask } from '../security/accountLifecycle';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const PHOTO = /^[A-Za-z0-9_-]{1,128}\.(jpg|jpeg|png|webp|heic|heif|gif)$/;
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const queues = new Map<string, Promise<unknown>>();

function requireUid(uid: string) {
  if (!ID.test(uid))
    throw new Error('Không tìm thấy tài khoản đang đăng nhập.');
}

function key(uid: string) {
  return `lifemate:memories:v1:${encodeURIComponent(uid)}`;
}

function directory(uid: string) {
  if (!FileSystem.documentDirectory)
    throw new Error('Thiết bị chưa sẵn sàng lưu ảnh.');
  return `${FileSystem.documentDirectory}memories/${encodeURIComponent(uid)}/`;
}

export function memoryPhotoUri(uid: string, fileName: string | null) {
  requireUid(uid);
  return fileName && PHOTO.test(fileName)
    ? `${directory(uid)}${fileName}`
    : null;
}

function validEntry(value: unknown, uid: string): value is MemoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<MemoryEntry>;
  return (
    typeof entry.id === 'string' &&
    ID.test(entry.id) &&
    entry.ownerId === uid &&
    typeof entry.dateKey === 'string' &&
    !!parseDateKey(entry.dateKey) &&
    typeof entry.text === 'string' &&
    entry.text.length <= 2000 &&
    (entry.photoFileName === null ||
      (typeof entry.photoFileName === 'string' &&
        PHOTO.test(entry.photoFileName))) &&
    (entry.visibility === undefined ||
      entry.visibility === 'private' ||
      entry.visibility === 'friends') &&
    (entry.r2Photo === undefined ||
      (!!entry.r2Photo &&
        typeof entry.r2Photo === 'object' &&
        entry.r2Photo.fileName === entry.photoFileName &&
        Number.isSafeInteger(entry.r2Photo.sizeBytes) &&
        entry.r2Photo.sizeBytes > 0 &&
        entry.r2Photo.sizeBytes <= MAX_PHOTO_BYTES &&
        entry.r2Photo.sizeBytes === entry.photoSizeBytes)) &&
    (entry.cloudRevision === undefined ||
      (typeof entry.cloudRevision === 'string' &&
        ID.test(entry.cloudRevision))) &&
    (entry.pendingRevision === undefined ||
      (typeof entry.pendingRevision === 'string' &&
        ID.test(entry.pendingRevision))) &&
    (entry.deletedAt === undefined ||
      (Number.isSafeInteger(entry.deletedAt) && entry.deletedAt > 0)) &&
    (entry.photoSizeBytes === undefined ||
      (Number.isSafeInteger(entry.photoSizeBytes) &&
        entry.photoSizeBytes >= 0 &&
        entry.photoSizeBytes <= MAX_PHOTO_BYTES)) &&
    (!!entry.text.trim() || !!entry.photoFileName) &&
    typeof entry.createdAt === 'number' &&
    Number.isFinite(entry.createdAt) &&
    typeof entry.updatedAt === 'number' &&
    Number.isFinite(entry.updatedAt)
  );
}

function sortEntries(entries: MemoryEntry[]) {
  return entries.sort(
    (a, b) =>
      b.dateKey.localeCompare(a.dateKey) ||
      b.createdAt - a.createdAt ||
      b.id.localeCompare(a.id),
  );
}

async function read(uid: string): Promise<MemoryEntry[]> {
  const raw = await getEncryptedItem(uid, key(uid));
  if (raw === null) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Chưa đọc được dòng ký ức trên thiết bị.');
  }
  if (!Array.isArray(value))
    throw new Error('Dữ liệu dòng ký ức không hợp lệ.');
  const entries: MemoryEntry[] = [];
  for (const item of value) {
    if (!validEntry(item, uid))
      throw new Error(
        'Một ký ức trên thiết bị không hợp lệ. Dữ liệu gốc được giữ nguyên để khôi phục.',
      );
    entries.push(item);
  }
  return sortEntries(entries);
}

function enqueue<T>(uid: string, action: () => Promise<T>): Promise<T> {
  const previous = queues.get(uid) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => accountTask(uid, action));
  queues.set(uid, next);
  void next
    .finally(() => {
      if (queues.get(uid) === next) queues.delete(uid);
    })
    .catch(() => undefined);
  return next;
}

function validateDraft(draft: MemoryDraft) {
  const date = parseDateKey(draft.dateKey);
  if (!date || draft.dateKey > toDateKey(new Date()))
    throw new Error('Ngày của ký ức không hợp lệ.');
  if (draft.text.trim().length > 2000)
    throw new Error('Nội dung tối đa 2.000 ký tự.');
  if (draft.photoChange === 'replace' && !draft.photoUri)
    throw new Error('Chưa chọn ảnh cho khoảnh khắc.');
  if (draft.visibility !== 'private' && draft.visibility !== 'friends')
    throw new Error('Quyền xem ký ức không hợp lệ.');
}

function extension(uri: string, mimeType: string | null | undefined) {
  const byMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/gif': 'gif',
  };
  if (mimeType && byMime[mimeType]) return byMime[mimeType];
  const matched = uri.split('?')[0].match(/\.(jpe?g|png|webp|heic|heif|gif)$/i);
  if (!matched) throw new Error('Định dạng ảnh chưa được hỗ trợ.');
  return matched[1].toLowerCase() === 'jpeg' ? 'jpg' : matched[1].toLowerCase();
}

async function copyPhoto(uid: string, id: string, draft: MemoryDraft) {
  if (!draft.photoUri) throw new Error('Chưa chọn ảnh.');
  const info = await FileSystem.getInfoAsync(draft.photoUri);
  if (
    !info.exists ||
    info.isDirectory ||
    !info.size ||
    info.size > MAX_PHOTO_BYTES
  )
    throw new Error('Ảnh cần nhỏ hơn 15 MB. Hãy chọn ảnh khác.');
  const folder = directory(uid);
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const fileName = `${id}-${randomUUID()}.${extension(draft.photoUri, draft.photoMimeType)}`;
  const target = `${folder}${fileName}`;
  try {
    await FileSystem.copyAsync({ from: draft.photoUri, to: target });
  } catch (error) {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(
      () => undefined,
    );
    throw error;
  }
  return fileName;
}

async function removePhoto(uid: string, fileName: string | null) {
  const uri = memoryPhotoUri(uid, fileName);
  if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
}

export function readMemories(uid: string) {
  requireUid(uid);
  return enqueue(uid, async () =>
    (await read(uid)).filter((entry) => !entry.deletedAt),
  );
}

export function createMemory(uid: string, draft: MemoryDraft) {
  requireUid(uid);
  validateDraft(draft);
  if (draft.photoChange !== 'replace')
    return Promise.reject(new Error('Hãy chụp ảnh trước khi lưu ký ức.'));
  return enqueue(uid, async () => {
    const entries = await read(uid);
    const id = randomUUID();
    const photoFileName = await copyPhoto(uid, id, draft);
    const now = Date.now();
    const entry: MemoryEntry = {
      id,
      ownerId: uid,
      dateKey: draft.dateKey,
      text: draft.text.trim(),
      photoFileName,
      visibility: 'private',
      pendingRevision: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await setEncryptedItem(
        uid,
        key(uid),
        JSON.stringify(sortEntries([entry, ...entries])),
      );
    } catch (error) {
      await removePhoto(uid, photoFileName).catch(() => undefined);
      throw error;
    }
    return entry;
  });
}

function entrySnapshot(entry: MemoryEntry) {
  const { r2Photo: _localBackup, ...snapshot } = entry;
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(snapshot).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}
// Acknowledging an upload changes sync bookkeeping, not the content the user saw.
function contentSnapshot(entry: MemoryEntry) {
  return JSON.stringify([
    entry.id,
    entry.ownerId,
    entry.dateKey,
    entry.text,
    entry.photoFileName,
    entry.visibility ?? 'private',
    entry.createdAt,
    entry.updatedAt,
    entry.deletedAt ?? null,
  ]);
}
function assertExpectedEntry(current: MemoryEntry, expected?: MemoryEntry) {
  if (
    current.deletedAt ||
    (expected && contentSnapshot(current) !== contentSnapshot(expected))
  )
    throw new Error(
      'Ký ức vừa thay đổi trên thiết bị khác. Hãy tải lại trước khi lưu hoặc xóa; nội dung đang nhập vẫn được giữ.',
    );
}

export function updateMemory(
  uid: string,
  id: string,
  draft: MemoryDraft,
  expected?: MemoryEntry,
) {
  requireUid(uid);
  if (!ID.test(id)) return Promise.reject(new Error('Ký ức không hợp lệ.'));
  validateDraft(draft);
  return enqueue(uid, async () => {
    const entries = await read(uid);
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error('Không tìm thấy ký ức cần sửa.');
    const previous = entries[index];
    assertExpectedEntry(previous, expected);
    if (
      draft.photoChange === 'keep' &&
      !previous.photoFileName &&
      !draft.text.trim()
    )
      throw new Error('Nhập nội dung cho ký ức không có ảnh.');
    // Keep the account queue held through access reduction and local persistence.
    // A sync cannot replace the version checked here while this editor saves.
    if (expected) {
      await unshareMemory(uid, 'Người dùng', id);
      assertMemorySession(uid);
    }
    const nextPhoto =
      draft.photoChange === 'replace'
        ? await copyPhoto(uid, id, draft)
        : previous.photoFileName;
    const updated: MemoryEntry = {
      ...previous,
      ...(expected ? { visibility: 'private' as const } : {}),
      dateKey: draft.dateKey,
      text: draft.text.trim(),
      photoFileName: nextPhoto,
      updatedAt: Date.now(),
      pendingRevision: randomUUID(),
    };
    if (previous.photoFileName !== nextPhoto) {
      delete updated.r2Photo;
      delete updated.photoSizeBytes;
    }
    entries[index] = updated;
    try {
      await setEncryptedItem(
        uid,
        key(uid),
        JSON.stringify(sortEntries(entries)),
      );
    } catch (error) {
      if (draft.photoChange === 'replace')
        await removePhoto(uid, nextPhoto).catch(() => undefined);
      throw error;
    }
    if (previous.photoFileName !== nextPhoto)
      await removePhoto(uid, previous.photoFileName).catch(() => undefined);
    return updated;
  });
}

export function deleteMemory(uid: string, id: string, expected?: MemoryEntry) {
  requireUid(uid);
  if (!ID.test(id)) return Promise.reject(new Error('Ký ức không hợp lệ.'));
  return enqueue(uid, async () => {
    const entries = await read(uid);
    const target = entries.find((entry) => entry.id === id);
    if (!target) throw new Error('Không tìm thấy ký ức cần xóa.');
    assertExpectedEntry(target, expected);
    await setEncryptedItem(
      uid,
      key(uid),
      JSON.stringify(
        entries.map((entry) =>
          entry.id === id
            ? { ...entry, deletedAt: Date.now(), pendingRevision: randomUUID() }
            : entry,
        ),
      ),
    );
    await removePhoto(uid, target.photoFileName).catch(() => undefined);
  });
}

export function setMemoryVisibility(
  uid: string,
  id: string,
  visibility: 'private' | 'friends',
) {
  requireUid(uid);
  if (!ID.test(id)) return Promise.reject(new Error('Ký ức không hợp lệ.'));
  return enqueue(uid, async () => {
    const entries = await read(uid);
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error('Không tìm thấy ký ức.');
    entries[index] = {
      ...entries[index],
      visibility,
      updatedAt: Date.now(),
      pendingRevision: randomUUID(),
    };
    await setEncryptedItem(uid, key(uid), JSON.stringify(entries));
  });
}

export class MemoryShareUnconfirmedError extends Error {
  constructor(public readonly entry: MemoryEntry) {
    super('Chưa xác nhận được quyền xem. Hãy kết nối và tải lại ký ức.');
    this.name = 'MemoryShareUnconfirmedError';
  }
}

// Keep the exact checked content stable until publication and cache persistence
// complete. Never enqueue another storage operation from inside this queue.
export function shareMemory(
  uid: string,
  displayName: string,
  expected: MemoryEntry,
  photoDimensions?: MemoryPhotoDimensions,
): Promise<MemoryEntry> {
  requireUid(uid);
  if (!ID.test(expected.id))
    return Promise.reject(new Error('Ký ức không hợp lệ.'));
  return enqueue(uid, async () => {
    assertMemorySession(uid);
    const entries = await read(uid);
    const index = entries.findIndex((entry) => entry.id === expected.id);
    if (index < 0) throw new Error('Không tìm thấy ký ức.');
    const current = entries[index];
    assertExpectedEntry(current, expected);
    const persistShared = async () => {
      assertMemorySession(uid);
      const shared: MemoryEntry = {
        ...current,
        visibility: 'friends',
        updatedAt: Date.now(),
        pendingRevision: randomUUID(),
      };
      entries[index] = shared;
      await setEncryptedItem(uid, key(uid), JSON.stringify(entries));
      return shared;
    };
    try {
      if (photoDimensions)
        await publishMemory(uid, displayName, current, photoDimensions);
      else await publishMemory(uid, displayName, current);
      return await persistShared();
    } catch (cause) {
      if (!memoryPublishDefinitelyNotStarted(cause)) {
        try {
          await unshareMemory(uid, displayName, current.id);
          assertMemorySession(uid);
        } catch {
          // Server access is uncertain even if the conservative cache write fails.
          const conservative = await persistShared().catch(() => current);
          throw new MemoryShareUnconfirmedError(conservative);
        }
      }
      throw cause;
    }
  });
}

export type MemorySyncConflict = {
  local: MemoryEntry;
  remoteRevision: string | null;
  remote: MemoryEntry | null;
  remoteDeleted: boolean;
};
type RemoteMemory = {
  id: string;
  revision: string;
  deleted: boolean;
  updatedAt: number;
  entry: MemoryEntry | null;
};
function remoteMemory(id: string, value: unknown, uid: string): RemoteMemory {
  if (!value || typeof value !== 'object')
    throw new Error('Dữ liệu ký ức cloud không hợp lệ.');
  const row = value as Record<string, unknown>;
  if (
    row.id !== id ||
    row.ownerId !== uid ||
    typeof row.revision !== 'string' ||
    !ID.test(row.revision) ||
    typeof row.updatedAt !== 'number' ||
    !Number.isSafeInteger(row.updatedAt) ||
    row.updatedAt < 0 ||
    row.updatedAt > 253402300799999 ||
    typeof row.deleted !== 'boolean'
  )
    throw new Error('Dữ liệu ký ức cloud không hợp lệ.');
  if (row.deleted)
    return {
      id,
      revision: row.revision,
      deleted: true,
      updatedAt: row.updatedAt,
      entry: null,
    };
  const revision = String(row.revision);
  if (
    !validEntry(row, uid) ||
    !Number.isSafeInteger(row.photoSizeBytes) ||
    (row.photoFileName
      ? Number(row.photoSizeBytes) < 1 ||
        Number(row.photoSizeBytes) > MAX_PHOTO_BYTES
      : row.photoSizeBytes !== 0)
  )
    throw new Error('Dữ liệu ảnh ký ức cloud không hợp lệ.');
  const entry: MemoryEntry = {
    id,
    ownerId: uid,
    dateKey: row.dateKey,
    text: row.text,
    photoFileName: row.photoFileName,
    photoSizeBytes: Number(row.photoSizeBytes),
    visibility: row.visibility ?? 'private',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    cloudRevision: revision,
  };
  return {
    id,
    revision: revision,
    deleted: false,
    updatedAt: row.updatedAt,
    entry,
  };
}
async function writeSyncCache(uid: string, entries: MemoryEntry[]) {
  assertMemorySession(uid);
  await setEncryptedItem(uid, key(uid), JSON.stringify(sortEntries(entries)));
}
// Only prune unreferenced originals after reading the durable, validated cache.
// The UID queue excludes concurrent local edits; failed deletes retry next sync.
async function pruneMemoryPhotos(uid: string) {
  assertMemorySession(uid);
  const referenced = new Set(
    (await read(uid)).map((entry) => entry.photoFileName),
  );
  const root = directory(uid);
  const info = await FileSystem.getInfoAsync(root);
  assertMemorySession(uid);
  if (!info.exists) return;
  const names = await FileSystem.readDirectoryAsync(root);
  assertMemorySession(uid);
  for (const name of names) {
    if (!PHOTO.test(name) || referenced.has(name)) continue;
    const uri = memoryPhotoUri(uid, name)!;
    const photo = await FileSystem.getInfoAsync(uri);
    assertMemorySession(uid);
    if (photo.exists && !photo.isDirectory) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      assertMemorySession(uid);
    }
  }
}
export type MemorySyncResult = {
  entries: MemoryEntry[];
  synced: boolean;
  warning?: string;
  conflict?: MemorySyncConflict;
};
function syncConflict(
  local: MemoryEntry,
  remote: RemoteMemory | undefined,
): MemorySyncConflict {
  return {
    local,
    remoteRevision: remote?.revision ?? null,
    remote: remote?.entry ?? null,
    remoteDeleted: remote?.deleted === true,
  };
}
export function synchronizeMemories(uid: string): Promise<MemorySyncResult> {
  requireUid(uid);
  return enqueue(uid, async () => {
    assertMemorySession(uid);
    let entries = await read(uid);
    // Skip re-encrypting the whole cache when nothing changed since the
    // last durable snapshot (unchanged entries used to rewrite it per item).
    // Compare with sorted keys: remote rows rebuild entries in another key order.
    const snapshot = () =>
      JSON.stringify(sortEntries(entries), (_key, value) =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(
              Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)),
            )
          : value,
      );
    let persisted = snapshot();
    async function persist() {
      const next = snapshot();
      if (next === persisted) return;
      await writeSyncCache(uid, entries);
      persisted = next;
    }
    let warning: string | undefined;
    async function transfer<T>(operation: () => Promise<T>) {
      try {
        const value = await operation();
        assertMemorySession(uid);
        return { ok: true as const, value };
      } catch (cause) {
        assertMemorySession(uid);
        warning ??= `Chưa đồng bộ đầy đủ. ${(cause as Error).message || 'Hãy thử lại.'}`;
        return { ok: false as const };
      }
    }
    const download = (entry: MemoryEntry, local?: MemoryEntry) =>
      transfer(async () => {
        const proof = await downloadMemoryPhoto(
          uid,
          entry,
          memoryPhotoUri(uid, entry.photoFileName),
          local?.id === entry.id && local.ownerId === entry.ownerId
            ? local.r2Photo
            : undefined,
        );
        if (proof) entry.r2Photo = proof;
      });
    const cleanup = () => transfer(() => pruneMemoryPhotos(uid));
    try {
      const rows = await readCloudMemories(uid);
      const remote = new Map(
        rows.map(({ id, value }) => [id, remoteMemory(id, value, uid)]),
      );
      for (const local of [...entries]) {
        assertMemorySession(uid);
        const current = remote.get(local.id);
        if (!local.pendingRevision && local.cloudRevision) {
          // A missing row is not proof of deletion; only tombstones remove data.
          if (!current)
            throw new Error(
              'Chưa tìm thấy bản cloud; bản trên máy vẫn được giữ.',
            );
          if (current.deleted)
            entries = entries.filter(({ id }) => id !== local.id);
          else {
            if (!(await download(current.entry!, local)).ok) continue;
            entries = entries.map((item) =>
              item.id === local.id ? current.entry! : item,
            );
          }
          await persist();
          continue;
        }
        if (current && !local.pendingRevision && !local.cloudRevision) {
          if (current.deleted) {
            entries = entries.filter(({ id }) => id !== local.id);
            await persist();
            continue;
          }
          const matching =
            current.entry!.dateKey === local.dateKey &&
            current.entry!.text === local.text &&
            current.entry!.photoFileName === local.photoFileName &&
            current.entry!.updatedAt === local.updatedAt;
          if (matching) {
            if (!(await download(current.entry!, local)).ok) continue;
            entries = entries.map((item) =>
              item.id === local.id ? current.entry! : item,
            );
            await persist();
            continue;
          }
        }
        if (
          current &&
          local.pendingRevision &&
          current.revision === local.pendingRevision
        ) {
          if (current.entry && !(await download(current.entry, local)).ok)
            continue;
          entries = entries.filter((item) => item.id !== local.id);
          if (current.entry) entries.push(current.entry);
          await persist();
          continue;
        }
        if ((current?.revision ?? null) !== (local.cloudRevision ?? null)) {
          await persist();
          await cleanup();
          return {
            entries: entries.filter((item) => !item.deletedAt),
            synced: false,
            conflict: syncConflict(local, current),
            warning:
              'Ký ức đã thay đổi ở hai thiết bị. Chọn bản cần giữ để đồng bộ tiếp.',
          };
        }
        const pending = {
          ...local,
          pendingRevision: local.pendingRevision ?? randomUUID(),
        };
        entries = entries.map((item) =>
          item.id === local.id ? pending : item,
        );
        await persist(); // Stable retry intent before any upload/write.
        if (pending.deletedAt) {
          await revokeDeletedMemory(uid, pending.id);
          assertMemorySession(uid);
        } else {
          const uploaded = await transfer(() =>
            uploadMemoryPhoto(
              uid,
              pending,
              memoryPhotoUri(uid, pending.photoFileName),
            ),
          );
          if (!uploaded.ok) continue;
          pending.photoSizeBytes = uploaded.value;
          if (pending.photoFileName)
            pending.r2Photo = {
              fileName: pending.photoFileName,
              sizeBytes: uploaded.value,
            };
          await persist();
        }
        try {
          await commitCloudMemory(uid, pending);
        } catch (cause) {
          if (!(cause instanceof MemoryCloudConflict)) throw cause;
          const changed = cause.remote
            ? remoteMemory(pending.id, cause.remote, uid)
            : undefined;
          await cleanup();
          return {
            entries: entries.filter((item) => !item.deletedAt),
            synced: false,
            conflict: syncConflict(pending, changed),
            warning: 'Ký ức đã thay đổi ở thiết bị khác. Chọn bản cần giữ.',
          };
        }
        entries = entries.filter((item) => item.id !== pending.id);
        if (!pending.deletedAt) {
          const confirmed: MemoryEntry = {
            ...pending,
            cloudRevision: pending.pendingRevision,
          };
          delete confirmed.pendingRevision;
          entries.push(confirmed);
        }
        remote.delete(pending.id);
        await persist();
      }
      const localIds = new Set(entries.map(({ id }) => id));
      for (const current of remote.values()) {
        if (current.deleted || localIds.has(current.id)) continue;
        if (!(await download(current.entry!)).ok) continue;
        entries.push(current.entry!);
        await persist();
      }
      await persist();
      await cleanup();
      return {
        entries: entries.filter((item) => !item.deletedAt),
        synced: !warning,
        ...(warning ? { warning } : {}),
      };
    } catch (cause) {
      assertMemorySession(uid);
      await cleanup();
      return {
        entries: (await read(uid)).filter((item) => !item.deletedAt),
        synced: false,
        warning: `Chưa đồng bộ đầy đủ. ${(cause as Error).message || 'Hãy kết nối mạng và thử lại.'}`,
      };
    }
  });
}
export function resolveMemorySyncConflict(
  uid: string,
  conflict: MemorySyncConflict,
  choice: 'local' | 'cloud',
) {
  return enqueue(uid, async () => {
    assertMemorySession(uid);
    const entries = await read(uid);
    const local = entries.find(({ id }) => id === conflict.local.id);
    if (!local || entrySnapshot(local) !== entrySnapshot(conflict.local))
      throw new Error('Bản trên máy đã thay đổi. Hãy tải lại.');
    const value = await readCloudMemory(uid, local.id);
    const current = value ? remoteMemory(local.id, value, uid) : undefined;
    if ((current?.revision ?? null) !== conflict.remoteRevision)
      throw new Error('Bản cloud vừa thay đổi. Hãy tải lại và chọn lại.');
    if (choice === 'cloud') {
      if (!current) throw new Error('Không có bản cloud hợp lệ để thay thế.');
      if (current.entry) {
        const proof = await downloadMemoryPhoto(
          uid,
          current.entry,
          memoryPhotoUri(uid, current.entry.photoFileName),
          local.r2Photo,
        );
        if (proof) current.entry.r2Photo = proof;
      }
      await writeSyncCache(uid, [
        ...entries.filter(({ id }) => id !== local.id),
        ...(current.entry ? [current.entry] : []),
      ]);
      await pruneMemoryPhotos(uid);
    } else {
      const rebased = { ...local, pendingRevision: randomUUID() };
      if (current) rebased.cloudRevision = current.revision;
      else delete rebased.cloudRevision;
      await writeSyncCache(
        uid,
        entries.map((item) => (item.id === local.id ? rebased : item)),
      );
    }
  });
}
