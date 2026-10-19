import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  getFirestore,
  onSnapshot,
  runTransaction,
} from '@react-native-firebase/firestore';
import { getStorage, ref, writeToFile } from '@react-native-firebase/storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore } from '../../store/authStore';
import type { MemoryEntry } from '../../types/memory';
import {
  assertMemorySession,
  downloadPrivatePhoto,
  uploadPrivatePhoto,
} from './memoryPrivatePhotos';
export { assertMemorySession } from './memoryPrivatePhotos';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const PHOTO = /^[A-Za-z0-9_-]{1,128}\.(jpg|jpeg|png|webp|heic|heif|gif)$/;
function readDeadline<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Chưa kết nối được cloud. Hãy thử lại.')),
        15000,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}
export class MemoryCloudConflict extends Error {
  constructor(public remote: unknown) {
    super('Ký ức đã thay đổi trên thiết bị khác.');
  }
}
function document(uid: string, id: string) {
  assertMemorySession(uid);
  if (!ID.test(id)) throw new Error('Mã ký ức không hợp lệ.');
  return doc(getFirestore(), 'memoryAccounts', uid, 'items', id);
}
function photo(uid: string, entry: MemoryEntry) {
  assertMemorySession(uid);
  if (
    entry.ownerId !== uid ||
    !ID.test(entry.id) ||
    !entry.photoFileName ||
    !PHOTO.test(entry.photoFileName)
  )
    throw new Error('Đường dẫn ảnh không hợp lệ.');
  return ref(
    getStorage(),
    `memories/${uid}/${entry.id}/${entry.photoFileName}`,
  );
}
async function transfer(uid: string, task: ReturnType<typeof writeToFile>) {
  const cancel = () => {
    void Promise.resolve(task.cancel()).catch(() => undefined);
  };
  const stop = () => {
    if (useAuthStore.getState().user?.uid !== uid) cancel();
  };
  const unsubscribe = useAuthStore.subscribe(stop);
  const timer = setTimeout(cancel, 120000);
  try {
    assertMemorySession(uid);
    await task;
    assertMemorySession(uid);
  } catch (cause) {
    cancel();
    throw cause;
  } finally {
    clearTimeout(timer);
    unsubscribe();
  }
}
export async function readCloudMemories(uid: string) {
  assertMemorySession(uid);
  const snapshot = await readDeadline(
    getDocsFromServer(
      collection(getFirestore(), 'memoryAccounts', uid, 'items'),
    ),
  );
  assertMemorySession(uid);
  return snapshot.docs.map((item) => ({
    id: item.id,
    value: item.data() as unknown,
  }));
}
export async function readCloudMemory(uid: string, id: string) {
  const snapshot = await readDeadline(getDocFromServer(document(uid, id)));
  assertMemorySession(uid);
  return snapshot.exists() ? snapshot.data() : null;
}
function matchesBackup(
  uid: string,
  entry: MemoryEntry,
  proof: MemoryEntry['r2Photo'],
) {
  return (
    entry.ownerId === uid &&
    ID.test(entry.id) &&
    !!entry.photoFileName &&
    PHOTO.test(entry.photoFileName) &&
    proof?.fileName === entry.photoFileName &&
    Number.isSafeInteger(proof.sizeBytes) &&
    proof.sizeBytes > 0 &&
    proof.sizeBytes <= 15 * 1024 * 1024 &&
    proof.sizeBytes === entry.photoSizeBytes
  );
}
export async function uploadMemoryPhoto(
  uid: string,
  entry: MemoryEntry,
  uri: string | null,
) {
  assertMemorySession(uid);
  if (!entry.photoFileName) return 0;
  if (!uri) throw new Error('Chưa tìm thấy ảnh cần sao lưu.');
  if (matchesBackup(uid, entry, entry.r2Photo)) {
    const info = await FileSystem.getInfoAsync(uri);
    assertMemorySession(uid);
    if (
      info.exists &&
      !info.isDirectory &&
      info.size === entry.r2Photo!.sizeBytes
    )
      return info.size;
  }
  return uploadPrivatePhoto(uid, entry, uri);
}
export async function downloadMemoryPhoto(
  uid: string,
  entry: MemoryEntry,
  uri: string | null,
  localBackup?: MemoryEntry['r2Photo'],
): Promise<MemoryEntry['r2Photo']> {
  assertMemorySession(uid);
  if (!uri || !entry.photoFileName) return;
  const info = await FileSystem.getInfoAsync(uri);
  assertMemorySession(uid);
  if (info.exists && !info.isDirectory && info.size === entry.photoSizeBytes) {
    // Unmarked legacy files still migrate once; known immutable originals need no network check.
    if (!matchesBackup(uid, entry, localBackup))
      await uploadPrivatePhoto(uid, entry, uri);
    return { fileName: entry.photoFileName, sizeBytes: info.size };
  }
  await FileSystem.makeDirectoryAsync(uri.slice(0, uri.lastIndexOf('/') + 1), {
    intermediates: true,
  });
  const partial = `${uri}.partial`;
  try {
    const onR2 = await downloadPrivatePhoto(uid, entry, partial);
    if (!onR2) await transfer(uid, writeToFile(photo(uid, entry), partial));
    const downloaded = await FileSystem.getInfoAsync(partial);
    assertMemorySession(uid);
    if (
      !downloaded.exists ||
      downloaded.isDirectory ||
      !downloaded.size ||
      downloaded.size !== entry.photoSizeBytes
    )
      throw new Error('Ảnh tải về chưa đầy đủ.');
    // Verify R2 backup before accepting a restored legacy original.
    if (!onR2) await uploadPrivatePhoto(uid, entry, partial);
    assertMemorySession(uid);
    await FileSystem.moveAsync({ from: partial, to: uri });
    return { fileName: entry.photoFileName, sizeBytes: downloaded.size };
  } finally {
    await FileSystem.deleteAsync(partial, { idempotent: true }).catch(
      () => undefined,
    );
  }
}
export async function commitCloudMemory(uid: string, entry: MemoryEntry) {
  const target = document(uid, entry.id);
  const revision = entry.pendingRevision;
  if (!revision) throw new Error('Thiếu phiên bản ký ức.');
  const next = entry.deletedAt
    ? {
        id: entry.id,
        ownerId: uid,
        revision,
        deleted: true,
        updatedAt: entry.deletedAt,
      }
    : {
        id: entry.id,
        ownerId: uid,
        revision,
        deleted: false,
        dateKey: entry.dateKey,
        text: entry.text,
        photoFileName: entry.photoFileName,
        photoSizeBytes: entry.photoSizeBytes ?? 0,
        visibility: entry.visibility ?? 'private',
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      };
  await runTransaction(getFirestore(), async (transaction) => {
    assertMemorySession(uid);
    const snapshot = await transaction.get(target);
    assertMemorySession(uid);
    const current = snapshot.exists() ? snapshot.data() : null;
    if (current?.revision === revision) return;
    if ((current?.revision ?? null) !== (entry.cloudRevision ?? null))
      throw new MemoryCloudConflict(current);
    transaction.set(target, next);
  });
  const confirmed = await readCloudMemory(uid, entry.id);
  if (confirmed?.revision !== revision)
    throw new MemoryCloudConflict(confirmed);
}
export function observeOwnMemories(uid: string, changed: () => void) {
  assertMemorySession(uid);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = onSnapshot(
    collection(getFirestore(), 'memoryAccounts', uid, 'items'),
    (snapshot) => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)
        return;
      clearTimeout(timer);
      timer = setTimeout(changed, 250);
    },
    () => {},
  );
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
