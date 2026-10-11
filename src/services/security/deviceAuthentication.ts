import * as LocalAuthentication from 'expo-local-authentication';

export type DeviceAuthenticationResult = {
  success: boolean;
  message: string | null;
};

let promptPending = false;

export async function authenticateDevice(
  promptMessage: string,
): Promise<DeviceAuthenticationResult> {
  if (promptPending)
    return { success: false, message: 'Đang xác thực. Hãy thử lại sau.' };
  promptPending = true;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Hủy',
      fallbackLabel: 'Dùng mật mã',
      disableDeviceFallback: false,
      biometricsSecurityLevel: 'strong',
    });
    if (result.success) return { success: true, message: null };
    const message = [
      'user_cancel',
      'app_cancel',
      'system_cancel',
      'user_fallback',
    ].includes(result.error)
      ? 'Đã hủy xác thực.'
      : result.error === 'not_enrolled' || result.error === 'passcode_not_set'
        ? 'Thiết lập Face ID, vân tay hoặc mật mã trong cài đặt thiết bị rồi thử lại.'
        : result.error === 'lockout'
          ? 'Xác thực tạm khóa. Dùng mật mã thiết bị hoặc thử lại sau.'
          : 'Chưa xác thực được. Hãy thử lại.';
    return { success: false, message };
  } catch {
    return {
      success: false,
      message: 'Chưa mở được xác thực thiết bị. Hãy thử lại.',
    };
  } finally {
    promptPending = false;
  }
}
