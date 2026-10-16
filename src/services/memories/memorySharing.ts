import { getAuth, getIdToken } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { audioCloudApiKey, audioCloudUrl } from '../../config/audioCloud';
import { memoryR2Bucket, memoryR2Origin } from '../../config/memoryR2';
import { useAuthStore } from '../../store/authStore';
import type { MemoryEntry } from '../../types/memory';
import {
  refreshAccountVerification,
  sendAccountVerificationEmail,
} from '../firebase/authService';
import { memoryPhotoUri } from './memoryStorage';

const MAX_SHARED_PHOTO_BYTES = 2 * 1024 * 1024;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
class MemoryShareNotStartedError extends Error {}
class MemoryEmailNotVerifiedError extends MemoryShareNotStartedError {}

export type MemoryFriend = { uid: string; email: string; name: string };
export type MemoryPendingInvite = { email: string };
export type MemoryShareState = {
  email: string;
  friends: MemoryFriend[];
  incoming: MemoryFriend[];
  outgoing: MemoryPendingInvite[];
  sharedIds: string[];
  legacyIds: string[];
};
export type FriendMemory = {
  id: string;
  ownerId: string;
  ownerName: string;
  dateKey: string;
  sharedAt?: number;
  text: string;
  photoUrl: string | null;
};
export type FriendMemoryPage = {
  items: FriendMemory[];
  nextOffset: number | null;
};

function assertSession(uid: string) {
  if (!ID.test(uid) || useAuthStore.getState().user?.uid !== uid)
    throw new Error('Phiên tài khoản đã thay đổi. Hãy mở lại Ký ức.');
  const user = getAuth().currentUser;
  if (!user || user.uid !== uid)
    throw new Error('Hãy đăng nhập lại để chia sẻ ký ức.');
  return user;
}

function serviceError(status: number, code?: string) {
  if (code === 'email-not-verified')
    return new MemoryEmailNotVerifiedError(
      'Email đăng nhập chưa được xác nhận để kết bạn và chia sẻ ký ức.',
    );
  if (code === 'invite-not-found')
    return new Error('Lời mời này không còn hiệu lực.');
  if (status === 404)
    return new MemoryShareNotStartedError(
      'Máy chủ chưa bật tính năng chia sẻ ký ức.',
    );
  if (status === 401 || status === 403)
    return new MemoryShareNotStartedError(
      'Phiên đăng nhập chưa hợp lệ. Hãy đăng nhập lại.',
    );
  if (code === 'self-invite') return new Error('Đây là email của chính bạn.');
  if (code === 'invalid-email')
    return new Error('Hãy nhập email tài khoản LifeMate hợp lệ.');
  if (status === 429)
    return new MemoryShareNotStartedError(
      'Đã đến giới hạn lời mời hoặc ký ức chia sẻ.',
    );
  if (code === 'photo-not-ready')
    return new Error('Ảnh chưa tải lên xong. Hãy thử chia sẻ lại.');
  if (status === 409)
    return new Error('Ký ức này đã được chia sẻ. Hãy tải lại danh sách.');
  return new Error('Chưa kết nối được phần chia sẻ. Hãy thử lại sau.');
}

export function memoryPublishDefinitelyNotStarted(cause: unknown) {
  return cause instanceof MemoryShareNotStartedError;
}

export function memoryEmailVerificationNeeded(cause: unknown) {
  return cause instanceof MemoryEmailNotVerifiedError;
}

export async function sendMemoryVerificationEmail(uid: string) {
  assertSession(uid);
  try {
    await sendAccountVerificationEmail(uid);
    assertSession(uid);
  } catch (cause) {
    const code =
      cause && typeof cause === 'object' && 'code' in cause ? cause.code : null;
    if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded')
      throw new Error('Đã yêu cầu quá nhiều lần. Hãy đợi rồi gửi lại.');
    if (code === 'auth/network-request-failed')
      throw new Error('Chưa có kết nối mạng. Hãy thử lại.');
    if (code === 'auth/invalid-email')
      throw new Error('Email đăng nhập không hợp lệ. Hãy kiểm tra tài khoản.');
    if (code === 'auth/user-token-expired')
      throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
    throw new Error(
      'Firebase chưa nhận được yêu cầu gửi thư. Hãy thử lại sau.',
    );
  }
}

export async function refreshMemoryVerification(uid: string) {
  assertSession(uid);
  try {
    const verified = await refreshAccountVerification(uid);
    assertSession(uid);
    return verified;
  } catch {
    throw new Error('Chưa kiểm tra được trạng thái email. Hãy thử lại sau.');
  }
}

async function requestMemoryAction(
  uid: string,
  displayName: string,
  input: Record<string, unknown>,
  retryVerification = true,
): Promise<Record<string, unknown>> {
  const user = assertSession(uid);
  const origin = audioCloudUrl();
  const apiKey = audioCloudApiKey();
  if (!origin || !apiKey)
    throw new MemoryShareNotStartedError(
      'Chia sẻ ký ức chưa được kết nối. Ký ức riêng vẫn dùng được.',
    );
  const token = await getIdToken(user);
  assertSession(uid);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${origin}/functions/v1/memory-access`, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...input,
        displayName: displayName.trim().slice(0, 60) || 'Người dùng',
      }),
    });
    const value: unknown = await response.json().catch(() => ({}));
    assertSession(uid);
    const data =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    if (!response.ok) {
      const error = serviceError(
        response.status,
        typeof data.code === 'string' ? data.code : undefined,
      );
      if (
        retryVerification &&
        response.status === 403 &&
        memoryEmailVerificationNeeded(error)
      ) {
        clearTimeout(timeout);
        let verified: boolean;
        try {
          verified = await refreshMemoryVerification(uid);
          assertSession(uid);
        } catch {
          // This request was rejected before any shared data could change.
          throw error;
        }
        if (verified)
          return requestMemoryAction(uid, displayName, input, false);
      }
      throw error;
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw new Error('Kết nối chia sẻ quá lâu. Hãy thử lại.');
    throw error;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

function person(value: unknown): MemoryFriend | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<MemoryFriend>;
  return typeof row.uid === 'string' &&
    ID.test(row.uid) &&
    typeof row.email === 'string' &&
    row.email.length <= 254 &&
    typeof row.name === 'string' &&
    row.name.length <= 60
    ? { uid: row.uid, email: row.email, name: row.name }
    : null;
}

export async function getMemoryShareState(
  uid: string,
  displayName: string,
): Promise<MemoryShareState> {
  const data = await requestMemoryAction(uid, displayName, { action: 'state' });
  const people = (key: 'friends' | 'incoming' | 'outgoing') =>
    Array.isArray(data[key])
      ? data[key].map(person).filter((item): item is MemoryFriend => !!item)
      : [];
  if (
    typeof data.email !== 'string' ||
    !Array.isArray(data.sharedIds) ||
    (data.legacyIds !== undefined && !Array.isArray(data.legacyIds))
  )
    throw new Error('Chưa đọc được danh sách chia sẻ.');
  return {
    email: data.email,
    friends: people('friends'),
    incoming: people('incoming'),
    outgoing: Array.isArray(data.outgoing)
      ? data.outgoing.flatMap((value): MemoryPendingInvite[] =>
          value &&
          typeof value === 'object' &&
          typeof (value as { email?: unknown }).email === 'string' &&
          (value as { email: string }).email.length <= 254
            ? [{ email: (value as { email: string }).email }]
            : [],
        )
      : [],
    sharedIds: data.sharedIds.filter(
      (id): id is string => typeof id === 'string' && ID.test(id),
    ),
    legacyIds: Array.isArray(data.legacyIds)
      ? data.legacyIds.filter(
          (id): id is string => typeof id === 'string' && ID.test(id),
        )
      : [],
  };
}

export async function migrateLegacyMemoryPhotos(
  uid: string,
  name: string,
  ids: string[],
) {
  if (!ids.length) return 0;
  const cursorKey = `lifemate:memory-r2-migration-cursor:v1:${uid}`;
  const storedCursor = Number(await AsyncStorage.getItem(cursorKey));
  const start =
    Number.isSafeInteger(storedCursor) && storedCursor >= 0
      ? storedCursor % ids.length
      : 0;
  const batch = [...ids.slice(start), ...ids.slice(0, start)].slice(0, 10);
  await AsyncStorage.setItem(
    cursorKey,
    String((start + batch.length) % ids.length),
  );
  let failed = 0;
  for (const id of batch) {
    assertSession(uid);
    try {
      await requestMemoryAction(uid, name, { action: 'migrate', id });
    } catch {
      failed += 1;
    }
  }
  return failed;
}

export async function sendMemoryFriendInvite(
  uid: string,
  name: string,
  email: string,
) {
  const result = await requestMemoryAction(uid, name, {
    action: 'invite',
    email: email.trim().toLowerCase(),
  });
  if (result.sent !== true) throw new Error('Chưa gửi được lời mời.');
}

export async function changeMemoryFriend(
  uid: string,
  name: string,
  action: 'accept' | 'decline' | 'remove-friend',
  friendUid: string,
) {
  if (!ID.test(friendUid)) throw new Error('Bạn bè không hợp lệ.');
  const result = await requestMemoryAction(uid, name, {
    action,
    uid: friendUid,
  });
  if (result.done !== true && result.accepted !== true)
    throw new Error('Chưa cập nhật được lời mời.');
}

export async function cancelMemoryFriendInvite(
  uid: string,
  name: string,
  email: string,
) {
  const result = await requestMemoryAction(uid, name, {
    action: 'cancel',
    email,
  });
  if (result.done !== true) throw new Error('Chưa hủy được lời mời.');
}

function signedImageUrl(
  value: unknown,
  ownerId: string,
  id: string,
): string | null {
  if (value === null) return null;
  if (typeof value !== 'string')
    throw new Error('Địa chỉ ảnh chia sẻ không hợp lệ.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Địa chỉ ảnh chia sẻ không hợp lệ.');
  }
  const path = `shared/${ownerId}/${id}/photo.jpg`;
  const legacy =
    url.origin === audioCloudUrl() &&
    url.pathname === `/storage/v1/object/sign/lifemate-memories/${path}` &&
    !!url.searchParams.get('token');
  const r2 = validR2Url(url, path, 600);
  if ((!legacy && !r2) || url.username || url.password || url.hash)
    throw new Error('Địa chỉ ảnh chia sẻ không hợp lệ.');
  return url.toString();
}

function validR2Url(url: URL, path: string, maxSeconds: number) {
  const expires = Number(url.searchParams.get('X-Amz-Expires'));
  return (
    url.origin === memoryR2Origin &&
    url.pathname === `/${memoryR2Bucket}/${path}` &&
    url.searchParams.get('X-Amz-Algorithm') === 'AWS4-HMAC-SHA256' &&
    !!url.searchParams.get('X-Amz-Date') &&
    !!url.searchParams.get('X-Amz-Credential') &&
    !!url.searchParams.get('X-Amz-SignedHeaders') &&
    !!url.searchParams.get('X-Amz-Signature') &&
    Number.isInteger(expires) &&
    expires >= 1 &&
    expires <= maxSeconds &&
    !url.username &&
    !url.password &&
    !url.hash
  );
}

export async function getFriendMemories(
  uid: string,
  name: string,
  offset = 0,
): Promise<FriendMemoryPage> {
  const data = await requestMemoryAction(uid, name, { action: 'feed', offset });
  if (
    !Array.isArray(data.items) ||
    (data.nextOffset !== null &&
      (typeof data.nextOffset !== 'number' ||
        !Number.isSafeInteger(data.nextOffset) ||
        (data.nextOffset as number) <= offset))
  )
    throw new Error('Chưa đọc được ký ức của bạn bè.');
  const items = data.items.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    if (
      typeof row.id !== 'string' ||
      !ID.test(row.id) ||
      typeof row.ownerId !== 'string' ||
      !ID.test(row.ownerId) ||
      typeof row.ownerName !== 'string' ||
      row.ownerName.length > 60 ||
      typeof row.dateKey !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.dateKey) ||
      typeof row.text !== 'string' ||
      row.text.length > 2000
    )
      return [];
    return [
      {
        id: row.id,
        ownerId: row.ownerId,
        ownerName: row.ownerName,
        dateKey: row.dateKey,
        sharedAt:
          typeof row.sharedAt === 'string' &&
          Number.isFinite(Date.parse(row.sharedAt))
            ? Date.parse(row.sharedAt)
            : undefined,
        text: row.text,
        photoUrl: signedImageUrl(row.photoUrl, row.ownerId, row.id),
      },
    ];
  });
  return { items, nextOffset: data.nextOffset as number | null };
}

export async function renewFriendMemoryPhoto(
  uid: string,
  name: string,
  ownerId: string,
  id: string,
) {
  if (!ID.test(ownerId) || !ID.test(id))
    throw new Error('Ký ức của bạn bè không hợp lệ.');
  const data = await requestMemoryAction(uid, name, {
    action: 'photo',
    ownerUid: ownerId,
    id,
  });
  const url = signedImageUrl(data.photoUrl, ownerId, id);
  if (!url) throw new Error('Ảnh ký ức không còn khả dụng.');
  return url;
}

async function resizeForSharing(uri: string) {
  for (const [width, quality] of [
    [1024, 0.72],
    [760, 0.52],
  ] as const) {
    const context = ImageManipulator.manipulate(uri);
    let image: Awaited<ReturnType<typeof context.renderAsync>> | null = null;
    try {
      context.resize({ width });
      image = await context.renderAsync();
      const saved = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: quality,
      });
      const info = await FileSystem.getInfoAsync(saved.uri);
      if (
        info.exists &&
        !info.isDirectory &&
        info.size &&
        info.size <= MAX_SHARED_PHOTO_BYTES
      )
        return { uri: saved.uri, sizeBytes: info.size };
      await FileSystem.deleteAsync(saved.uri, { idempotent: true }).catch(
        () => undefined,
      );
    } finally {
      image?.release();
      context.release();
    }
  }
  throw new Error('Ảnh quá lớn để chia sẻ. Hãy chọn ảnh khác.');
}

export async function publishMemory(
  uid: string,
  name: string,
  entry: MemoryEntry,
) {
  assertSession(uid);
  const photoUri = memoryPhotoUri(uid, entry.photoFileName);
  const prepared = photoUri ? await resizeForSharing(photoUri) : null;
  try {
    const result = await requestMemoryAction(uid, name, {
      action: 'publish',
      id: entry.id,
      dateKey: entry.dateKey,
      text: entry.text,
      hasPhoto: !!prepared,
      ...(prepared ? { sizeBytes: prepared.sizeBytes } : {}),
    });
    if (!prepared) {
      if (result.shared !== true) throw new Error('Chưa chia sẻ được ký ức.');
      return;
    }
    let uploadUrl: URL;
    try {
      uploadUrl = new URL(String(result.uploadUrl));
    } catch {
      throw new Error('Địa chỉ tải ảnh lên không hợp lệ.');
    }
    const path = `shared/${uid}/${entry.id}/photo.jpg`;
    const legacy =
      uploadUrl.origin === audioCloudUrl() &&
      uploadUrl.pathname ===
        `/storage/v1/object/upload/sign/lifemate-memories/${path}` &&
      !!uploadUrl.searchParams.get('token');
    const r2 = validR2Url(uploadUrl, path, 120);
    if (
      (!legacy && !r2) ||
      uploadUrl.username ||
      uploadUrl.password ||
      uploadUrl.hash
    )
      throw new Error('Địa chỉ tải ảnh lên không hợp lệ.');
    const task = FileSystem.createUploadTask(
      uploadUrl.toString(),
      prepared.uri,
      {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
        headers: {
          'Content-Type': 'image/jpeg',
          ...(r2
            ? { 'Content-Length': String(prepared.sizeBytes) }
            : { 'x-upsert': 'true', 'Cache-Control': 'max-age=0' }),
        },
      },
    );
    let timer: ReturnType<typeof setTimeout> | null = null;
    const uploaded = await Promise.race([
      task.uploadAsync(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void task.cancelAsync().catch(() => undefined);
          reject(
            new Error('Tải ảnh lên quá lâu. Bản trên máy vẫn được giữ riêng.'),
          );
        }, 90000);
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
    assertSession(uid);
    if (!uploaded || uploaded.status < 200 || uploaded.status >= 300)
      throw new Error(
        'Ảnh chưa tải lên được. Bản trên máy vẫn được giữ riêng.',
      );
    const confirmed = await requestMemoryAction(uid, name, {
      action: 'confirm',
      id: entry.id,
    });
    if (confirmed.shared !== true)
      throw new Error('Chưa xác nhận được ảnh đã chia sẻ.');
  } finally {
    if (prepared)
      await FileSystem.deleteAsync(prepared.uri, { idempotent: true }).catch(
        () => undefined,
      );
  }
}

export async function unshareMemory(uid: string, name: string, id: string) {
  const result = await requestMemoryAction(uid, name, {
    action: 'unshare',
    id,
  });
  if (result.shared !== false)
    throw new Error('Chưa khóa được ký ức cho riêng bạn.');
}
