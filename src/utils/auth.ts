import { isValidEmail } from './users';

export function validateLogin(email: string, password: string): string | null {
  if (!isValidEmail(email)) return 'Vui lòng nhập địa chỉ email hợp lệ.';
  if (!password) return 'Vui lòng nhập mật khẩu.';
  return null;
}

export function validateRegistration(
  name: string,
  email: string,
  password: string,
  confirmation: string,
): string | null {
  const displayName = name.trim();
  if (
    !displayName ||
    displayName.length > 60 ||
    /[\u0000-\u001f\u007f-\u009f]/.test(displayName)
  )
    return 'Tên hiển thị phải có từ 1 đến 60 ký tự hợp lệ.';
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
