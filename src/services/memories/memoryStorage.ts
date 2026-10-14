import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import type { MemoryDraft, MemoryEntry } from '../../types/memory';
import { parseDateKey, toDateKey } from '../../utils/vietnameseCalendar';
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
  const next = previous.catch(() => undefined).then(action);
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
    throw new Error('Hãy chọn ngày hôm nay hoặc trước đó.');
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
  return enqueue(uid, () => read(uid));
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

export function updateMemory(uid: string, id: string, draft: MemoryDraft) {
  requireUid(uid);
  if (!ID.test(id)) return Promise.reject(new Error('Ký ức không hợp lệ.'));
  validateDraft(draft);
  return enqueue(uid, async () => {
    const entries = await read(uid);
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error('Không tìm thấy ký ức cần sửa.');
    const previous = entries[index];
    const nextPhoto =
      draft.photoChange === 'replace'
        ? await copyPhoto(uid, id, draft)
        : previous.photoFileName;
    if (!nextPhoto)
      throw new Error('Hãy chụp ảnh trước khi lưu ký ức.');
    const updated: MemoryEntry = {
      ...previous,
      dateKey: draft.dateKey,
      text: draft.text.trim(),
      photoFileName: nextPhoto,
      updatedAt: Date.now(),
    };
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

export function deleteMemory(uid: string, id: string) {
  requireUid(uid);
  if (!ID.test(id)) return Promise.reject(new Error('Ký ức không hợp lệ.'));
  return enqueue(uid, async () => {
    const entries = await read(uid);
    const target = entries.find((entry) => entry.id === id);
    if (!target) throw new Error('Không tìm thấy ký ức cần xóa.');
    await setEncryptedItem(
      uid,
      key(uid),
      JSON.stringify(entries.filter((entry) => entry.id !== id)),
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
    entries[index] = { ...entries[index], visibility };
    await setEncryptedItem(uid, key(uid), JSON.stringify(entries));
  });
}
