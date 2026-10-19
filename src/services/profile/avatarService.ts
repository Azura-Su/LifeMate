import * as FileSystem from 'expo-file-system/legacy';
import { audioCloudUrl, audioCloudApiKey } from '../../config/audioCloud';
import { useAuthStore } from '../../store/authStore';
import { accountIdToken, currentSessionUser } from '../firebase/authService';
import {
  accountTask,
  assertAccountWritable,
} from '../security/accountLifecycle';

function assertSession(uid: string) {
  if (useAuthStore.getState().user?.uid !== uid || !currentSessionUser(uid))
    throw new Error('Phiên tài khoản đã thay đổi.');
  assertAccountWritable(uid);
}
async function connection(uid: string) {
  assertSession(uid);
  const origin = audioCloudUrl(),
    key = audioCloudApiKey();
  if (!origin || !key) throw new Error('Ảnh đại diện chưa được kết nối.');
  const token = await accountIdToken(uid);
  assertSession(uid);
  return {
    origin,
    url: `${origin}/functions/v1/profile-access`,
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  };
}
function result(
  uid: string,
  origin: string,
  status: number,
  body: string,
): string | null {
  assertSession(uid);
  if (status < 200 || status >= 300)
    throw new Error(
      status === 401
        ? 'Phiên đăng nhập không còn hợp lệ. Hãy đăng nhập lại.'
        : 'Chưa lưu hoặc tải được ảnh đại diện. Hãy thử lại.',
    );
  const value = JSON.parse(body);
  if (value.avatarUrl === null) return null;
  const target = new URL(value.avatarUrl);
  if (
    target.origin !== origin ||
    target.pathname !==
      `/storage/v1/object/sign/lifemate-avatars/profiles/${uid}/avatar.jpg` ||
    !target.searchParams.get('token') ||
    target.username ||
    target.password ||
    target.hash
  )
    throw new Error('Địa chỉ ảnh đại diện không hợp lệ.');
  return target.toString();
}
export function readAvatar(uid: string) {
  return avatarAction(uid, 'avatar-url');
}
export function removeAvatar(uid: string) {
  return accountTask(uid, () => avatarAction(uid, 'remove-avatar'));
}
async function avatarAction(uid: string, action: string) {
  const { sessionEpoch } = useAuthStore.getState();
  const controller = new AbortController();
  let rejectPending!: (cause: Error) => void;
  const interrupted = new Promise<never>((_, reject) => {
    rejectPending = reject;
  });
  const cancel = (message: string) => {
    rejectPending(new Error(message));
    controller.abort();
  };
  const timer = setTimeout(
    () => cancel('Tải ảnh đại diện quá lâu. Hãy thử lại.'),
    20000,
  );
  const unsubscribe = useAuthStore.subscribe((state) => {
    if (state.user?.uid !== uid || state.sessionEpoch !== sessionEpoch)
      cancel('Phiên tài khoản đã thay đổi.');
  });
  try {
    // Race token retrieval, fetch and body decoding: abort alone may not settle
    // a native request or a stalled response body.
    return await Promise.race([
      interrupted,
      (async () => {
        const { origin, url, headers } = await connection(uid);
        if (controller.signal.aborted)
          throw new Error('Phiên tài khoản đã thay đổi.');
        const response = await fetch(url, {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        const body = await response.text();
        if (controller.signal.aborted)
          throw new Error('Phiên tài khoản đã thay đổi.');
        return result(uid, origin, response.status, body);
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    unsubscribe();
  }
}
export function uploadAvatar(uid: string, uri: string, signal: AbortSignal) {
  return accountTask(uid, async () => {
    const { sessionEpoch } = useAuthStore.getState();
    let task: ReturnType<typeof FileSystem.createUploadTask> | undefined;
    let cancelled = false;
    let rejectPending!: (cause: Error) => void;
    const interrupted = new Promise<never>((_, reject) => {
      rejectPending = reject;
    });
    const cancel = (message: string) => {
      if (cancelled) return;
      cancelled = true;
      rejectPending(new Error(message));
      if (task) void task.cancelAsync().catch(() => undefined);
    };
    const abort = () => cancel('Đã hủy tải ảnh.');
    const timer = setTimeout(
      () => cancel('Tải ảnh đại diện quá lâu. Hãy thử lại.'),
      25000,
    );
    signal.addEventListener('abort', abort);
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state.user?.uid !== uid || state.sessionEpoch !== sessionEpoch)
        cancel('Phiên tài khoản đã thay đổi.');
    });
    const assertActive = () => {
      if (cancelled) throw new Error('Đã hủy tải ảnh.');
      assertSession(uid);
    };
    try {
      if (signal.aborted) abort();
      return await Promise.race([
        interrupted,
        (async () => {
          assertActive();
          const { origin, url, headers } = await connection(uid);
          assertActive();
          const info = await FileSystem.getInfoAsync(uri);
          assertActive();
          if (
            !info.exists ||
            info.isDirectory ||
            !info.size ||
            info.size > 524288
          )
            throw new Error('Ảnh đại diện cần nhỏ hơn 512 KB.');
          task = FileSystem.createUploadTask(url, uri, {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
            headers: { ...headers, 'Content-Type': 'image/jpeg' },
          });
          const response = await task.uploadAsync();
          assertActive();
          if (!response)
            throw new Error('Chưa xác nhận được ảnh mới. Hãy thử lưu lại.');
          return result(uid, origin, response.status, response.body);
        })(),
      ]);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      unsubscribe();
    }
  });
}
