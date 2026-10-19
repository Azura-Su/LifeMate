import { getAuth, getIdToken } from '@react-native-firebase/auth';
import * as FileSystem from 'expo-file-system/legacy';
import { audioCloudApiKey, audioCloudUrl } from '../../config/audioCloud';
import { memoryR2Bucket, memoryR2Origin } from '../../config/memoryR2';
import { useAuthStore } from '../../store/authStore';
import type { MemoryEntry } from '../../types/memory';
import { assertAccountWritable } from '../security/accountLifecycle';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const PHOTO = /^[A-Za-z0-9_-]{1,128}\.(jpg|jpeg|png|webp|heic|heif|gif)$/;
const TYPES: Record<string, string> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  heic: 'heic',
  heif: 'heif',
  gif: 'gif',
};
export function assertMemorySession(uid: string) {
  if (
    !ID.test(uid) ||
    useAuthStore.getState().user?.uid !== uid ||
    getAuth().currentUser?.uid !== uid
  )
    throw new Error('Phiên tài khoản đã thay đổi.');
  assertAccountWritable(uid);
}
function pathFor(uid: string, entry: MemoryEntry) {
  assertMemorySession(uid);
  if (
    entry.ownerId !== uid ||
    !ID.test(entry.id) ||
    !entry.photoFileName ||
    !PHOTO.test(entry.photoFileName)
  )
    throw new Error('Đường dẫn ảnh không hợp lệ.');
  return `private/${uid}/${entry.id}/${entry.photoFileName}`;
}
function signedUrl(value: unknown, path: string, upload: boolean) {
  const url = new URL(String(value));
  const expires = Number(url.searchParams.get('X-Amz-Expires'));
  const headers = url.searchParams.get('X-Amz-SignedHeaders')?.split(';') ?? [];
  if (
    url.origin !== memoryR2Origin ||
    url.pathname !== `/${memoryR2Bucket}/${path}` ||
    url.username ||
    url.password ||
    url.hash ||
    url.searchParams.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256' ||
    !url.searchParams.get('X-Amz-Date') ||
    !url.searchParams.get('X-Amz-Credential') ||
    !url.searchParams.get('X-Amz-Signature') ||
    !headers.includes('host') ||
    (upload &&
      !['content-type', 'content-length', 'if-none-match'].every((h) =>
        headers.includes(h),
      )) ||
    !Number.isInteger(expires) ||
    expires < 1 ||
    expires > (upload ? 120 : 600)
  )
    throw new Error('Địa chỉ ảnh riêng không hợp lệ.');
  return url.toString();
}
async function action(
  uid: string,
  entry: MemoryEntry,
  operation: string,
  sizeBytes?: number,
) {
  pathFor(uid, entry);
  const origin = audioCloudUrl();
  const apikey = audioCloudApiKey();
  if (!origin || !apikey) throw new Error('Chưa kết nối được kho ảnh riêng.');
  const { sessionEpoch } = useAuthStore.getState();
  const controller = new AbortController();
  let rejectDeadline!: (cause: Error) => void;
  const deadline = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
  });
  const cancel = (message: string) => {
    rejectDeadline(new Error(message));
    controller.abort();
  };
  const stop = () => {
    const state = useAuthStore.getState();
    if (state.user?.uid !== uid || state.sessionEpoch !== sessionEpoch)
      cancel('Phiên đăng nhập đã thay đổi.');
  };
  const unsubscribe = useAuthStore.subscribe(stop);
  const timeout = setTimeout(
    () => cancel('Kho ảnh phản hồi quá lâu. Hãy thử đồng bộ lại.'),
    20000,
  );
  try {
    const token = await Promise.race([
      getIdToken(getAuth().currentUser!),
      deadline,
    ]);
    assertMemorySession(uid);
    if (controller.signal.aborted)
      throw new Error('Phiên đăng nhập đã thay đổi.');
    const response = await Promise.race([
      fetch(`${origin}/functions/v1/memory-access`, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          apikey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: operation,
          id: entry.id,
          fileName: entry.photoFileName,
          ...(sizeBytes === undefined ? {} : { sizeBytes }),
        }),
      }),
      deadline,
    ]);
    assertMemorySession(uid);
    if (!response.ok)
      throw new Error(
        `Chưa truy cập được kho ảnh riêng (HTTP ${response.status}). Hãy thử lại.`,
      );
    let data: unknown;
    try {
      data = await Promise.race([response.json(), deadline]);
    } catch {
      assertMemorySession(uid);
      throw new Error(
        'Kho ảnh trả về phản hồi chưa đầy đủ. Hãy thử đồng bộ lại.',
      );
    }
    assertMemorySession(uid);
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error(
        'Kho ảnh trả về phản hồi không hợp lệ. Hãy thử đồng bộ lại.',
      );
    return data as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
    unsubscribe();
  }
}
function photoSize(data: Record<string, unknown>): number | null {
  if (data.photo === null) return null;
  const size = (data.photo as { sizeBytes?: number } | undefined)?.sizeBytes;
  if (!Number.isSafeInteger(size) || !size || size < 1 || size > 15728640)
    throw new Error('Ảnh cloud không hợp lệ.');
  return size;
}
async function transfer<T>(
  uid: string,
  task: { cancelAsync(): Promise<void> },
  run: () => Promise<T>,
) {
  let timer: ReturnType<typeof setTimeout>;
  let unsubscribe = () => {};
  try {
    assertMemorySession(uid);
    const result = await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        const stop = () => {
          try {
            assertMemorySession(uid);
          } catch (cause) {
            reject(cause);
          }
        };
        unsubscribe = useAuthStore.subscribe(stop);
        timer = setTimeout(
          () => reject(new Error('Tải ảnh quá lâu. Hãy thử lại.')),
          120000,
        );
        stop();
      }),
    ]);
    assertMemorySession(uid);
    return result;
  } catch (cause) {
    await task.cancelAsync().catch(() => undefined);
    throw cause;
  } finally {
    clearTimeout(timer!);
    unsubscribe();
  }
}
export async function uploadPrivatePhoto(
  uid: string,
  entry: MemoryEntry,
  uri: string,
) {
  const path = pathFor(uid, entry);
  const info = await FileSystem.getInfoAsync(uri);
  assertMemorySession(uid);
  if (!info.exists || info.isDirectory || !info.size || info.size > 15728640)
    throw new Error('Ảnh trên máy không còn đầy đủ.');
  const data = await action(uid, entry, 'private-upload', info.size);
  if (data.uploadUrl !== undefined) {
    const task = FileSystem.createUploadTask(
      signedUrl(data.uploadUrl, path, true),
      uri,
      {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
        headers: {
          'Content-Type': `image/${TYPES[entry.photoFileName!.split('.').pop()!]}`,
          'Content-Length': String(info.size),
          'If-None-Match': '*',
        },
      },
    );
    const result = await transfer(uid, task, () => task.uploadAsync());
    // Another device may have uploaded the same immutable filename first.
    if (
      !result ||
      !((result.status >= 200 && result.status < 300) || result.status === 412)
    )
      throw new Error('Ảnh chưa sao lưu đầy đủ.');
    const confirmed = await action(uid, entry, 'private-head');
    if (photoSize(confirmed) !== info.size)
      throw new Error('Ảnh chưa sao lưu đầy đủ.');
  } else if (photoSize(data) !== info.size)
    throw new Error('Ảnh cloud không khớp bản trên máy.');
  return info.size;
}
export async function downloadPrivatePhoto(
  uid: string,
  entry: MemoryEntry,
  partial: string,
) {
  const path = pathFor(uid, entry);
  const data = await action(uid, entry, 'private-download');
  const size = photoSize(data);
  if (size === null) return false;
  if (size !== entry.photoSizeBytes)
    throw new Error('Ảnh cloud không khớp kích thước.');
  const task = FileSystem.createDownloadResumable(
    signedUrl(data.downloadUrl, path, false),
    partial,
    {
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    },
  );
  const result = await transfer(uid, task, () => task.downloadAsync());
  if (!result || result.status !== 200)
    throw new Error('Ảnh tải về chưa đầy đủ.');
  return true;
}
