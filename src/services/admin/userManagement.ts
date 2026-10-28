import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { audioCloudApiKey, audioCloudUrl } from '../../config/audioCloud';
import { useAuthStore } from '../../store/authStore';

import { isUserAdmin } from '../../config/userAdmin';
export { ADMIN_UID, ADMIN_EMAIL, isUserAdmin } from '../../config/userAdmin';
export type ManagedUser = {
  uid: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  verified: boolean;
  disabled: boolean;
  createdAt: number | null;
  lastSignInAt: number | null;
  providers: string[];
  status: 'active' | 'disabled' | 'deleting' | 'deleted';
  phase: string;
  finalAfter: string | null;
  authDeleted?: boolean;
  protected: boolean;
};
export type CleanupJob = {
  uid: string;
  status: string;
  phase: string;
  final_after: string | null;
  updated_at: string;
};
type Result = {
  users?: ManagedUser[];
  user?: ManagedUser;
  nextPageToken?: string | null;
  jobs?: CleanupJob[];
};

export async function requestAdmin(
  input: Record<string, string>,
  signal?: AbortSignal,
): Promise<unknown> {
  const user = getAuth().currentUser;
  if (!isUserAdmin(user) || !isUserAdmin(useAuthStore.getState().user))
    throw new Error('Bạn không có quyền quản lý người dùng.');
  const uid = user!.uid;
  const url = audioCloudUrl();
  const key = audioCloudApiKey();
  if (!url || !key) throw new Error('Dịch vụ quản lý chưa được kết nối.');
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
  const abort = () => cancel('Đã hủy yêu cầu quản lý người dùng.');
  signal?.addEventListener('abort', abort);
  const timer = setTimeout(
    () =>
      cancel('Yêu cầu quản lý quá lâu. Hãy tải lại để kiểm tra trạng thái.'),
    input.action === 'delete' ? 60000 : 25000,
  );
  const unsubscribe = useAuthStore.subscribe((state) => {
    if (state.user?.uid !== uid || state.sessionEpoch !== sessionEpoch)
      cancel('Phiên đăng nhập đã thay đổi.');
  });
  try {
    if (signal?.aborted) abort();
    const token = await Promise.race([interrupted, getIdToken(user!, true)]);
    if (controller.signal.aborted)
      throw new Error('Đã hủy yêu cầu quản lý người dùng.');
    const response = await Promise.race([
      interrupted,
      fetch(`${url}/functions/v1/user-admin`, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          apikey: key,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      }),
    ]);
    const result = await Promise.race([interrupted, response.json()]);
    if (!response.ok) {
      const messages: Record<string, string> = {
        'admin-required':
          'Tài khoản chưa đủ quyền admin hoặc email chưa xác nhận.',
        'protected-account': 'Không thể khóa hoặc xóa tài khoản admin.',
        'email-mismatch': 'Email xác nhận chưa khớp tài khoản cần xóa.',
        'account-busy': 'Tài khoản đang được xử lý. Hãy tải lại sau ít giây.',
        'deletion-in-progress': 'Tài khoản đang xóa và không thể mở lại.',
        'user-not-found': 'Không tìm thấy tài khoản. Hãy tải lại danh sách.',
        'pet-changed':
          'Lượt nhận nuôi đã thay đổi. Hãy tải lại trước khi thu hồi.',
        'idempotency-conflict':
          'Yêu cầu không còn khớp. Hãy tải lại danh sách.',
        'rate-limited': 'Bạn thao tác hơi nhanh. Hãy đợi một lát.',
      };
      throw new Error(
        messages[result.error] ??
          'Chưa xử lý được yêu cầu. Hãy tải lại để kiểm tra trạng thái.',
      );
    }
    if (
      getAuth().currentUser?.uid !== uid ||
      useAuthStore.getState().sessionEpoch !== sessionEpoch ||
      !isUserAdmin(useAuthStore.getState().user)
    )
      throw new Error('Phiên đăng nhập đã thay đổi.');
    return result;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    unsubscribe();
  }
}

export async function manageUsers(
  input: Record<string, string>,
  signal?: AbortSignal,
): Promise<Result> {
  return (await requestAdmin(input, signal)) as Result;
}
