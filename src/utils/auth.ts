import { isValidEmail } from './users';

export function validateLogin(email: string, password: string): string | null {
  if (!isValidEmail(email)) return 'Vui lòng nhập địa chỉ email hợp lệ.';
  if (!password) return 'Vui lòng nhập mật khẩu.';
  return null;
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
