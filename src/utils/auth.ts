import { isValidEmail } from './users';

export function validateLogin(email: string, password: string): string | null {
  if (!isValidEmail(email)) return 'Vui lòng nhập địa chỉ email hợp lệ.';
  if (!password) return 'Vui lòng nhập mật khẩu.';
  return null;
}

export function validateDisplayName(name: string): string | null {
  const value = name.trim();
  return !value ||
    value.length > 60 ||
    /[\u0000-\u001f\u007f-\u009f]/.test(value)
    ? 'Tên hiển thị phải có từ 1 đến 60 ký tự hợp lệ.'
    : null;
}

export function validateRegistration(
  name: string,
  email: string,
  password: string,
  confirmation: string,
): string | null {
  const nameError = validateDisplayName(name);
  if (nameError) return nameError;
  if (!isValidEmail(email)) return 'Vui lòng nhập địa chỉ email hợp lệ.';
  if (password.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
  if (password !== confirmation) return 'Mật khẩu xác nhận chưa khớp.';
  return null;
}

export function getRegistrationErrorMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? error.code : null;
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Không thể đăng ký với email này. Hãy thử đăng nhập hoặc dùng email khác.';
    case 'auth/invalid-email':
      return 'Vui lòng kiểm tra lại địa chỉ email.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Mật khẩu chưa đáp ứng yêu cầu bảo mật. Hãy chọn mật khẩu mạnh hơn.';
    case 'auth/network-request-failed':
      return 'Chưa có kết nối mạng. Vui lòng thử lại.';
    case 'auth/too-many-requests':
      return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.';
    case 'auth/operation-not-allowed':
      return 'Đăng ký hiện chưa được mở. Vui lòng thử lại sau.';
    default:
      return 'Chưa thể tạo tài khoản lúc này. Vui lòng thử lại sau.';
  }
}

export function getAuthErrorMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? error.code : null;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.';
    case 'auth/invalid-email':
      return 'Vui lòng kiểm tra lại địa chỉ email.';
    case 'auth/network-request-failed':
      return 'Chưa có kết nối mạng. Vui lòng thử lại.';
    case 'auth/too-many-requests':
      return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.';
    case 'auth/user-disabled':
      return 'Tài khoản đang bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.';
    default:
      return 'Chưa thể đăng nhập lúc này. Vui lòng thử lại sau.';
  }
}

export function validatePasswordChange(
  current: string,
  next: string,
  confirmation: string,
): string | null {
  if (!current) return 'Vui lòng nhập mật khẩu hiện tại.';
  if (next.length < 8) return 'Mật khẩu mới cần ít nhất 8 ký tự.';
  if (next === current) return 'Mật khẩu mới cần khác mật khẩu hiện tại.';
  if (next !== confirmation) return 'Mật khẩu xác nhận chưa khớp.';
  return null;
}
export function getPasswordChangeErrorMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? error.code : null;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
      return 'Mật khẩu hiện tại chưa đúng. Hãy kiểm tra lại.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Mật khẩu mới chưa đáp ứng yêu cầu bảo mật. Hãy chọn mật khẩu mạnh hơn.';
    case 'auth/requires-recent-login':
    case 'auth/user-token-expired':
    case 'auth/session-changed':
      return 'Phiên đăng nhập đã thay đổi hoặc hết hạn. Hãy đăng nhập lại.';
    case 'auth/password-provider-required':
      return 'Tài khoản này không đăng nhập bằng email và mật khẩu.';
    case 'auth/network-request-failed':
      return 'Chưa kết nối được Firebase. Hãy thử lại; nếu lần trước đã đổi thành công, dùng mật khẩu mới để đăng nhập.';
    case 'auth/too-many-requests':
      return 'Bạn đã thử quá nhiều lần. Hãy đợi rồi thử lại.';
    case 'auth/user-disabled':
    case 'auth/user-not-found':
      return 'Tài khoản không còn khả dụng. Hãy đăng nhập lại.';
    default:
      return 'Chưa xác nhận được việc đổi mật khẩu. Hãy thử lại; nếu cần, đăng nhập bằng mật khẩu mới.';
  }
}
