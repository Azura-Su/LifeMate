import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type FinanceAuthenticationResult = {
  success: boolean;
  message: string | null;
};
let promptPending = false;

function lockKey(uid: string) {
  if (!uid) throw new Error('Bạn cần đăng nhập.');
  const encoded = Array.from(uid, (character) =>
    character.codePointAt(0)!.toString(16),
  ).join('_');
  return `lifemate.financeLock.v1.${encoded}`;
}

export async function readFinanceLock(uid: string) {
  const value = await SecureStore.getItemAsync(lockKey(uid));
  if (value === null || value === 'off') return false;
  if (value === 'on') return true;
  throw new Error('Thiết lập khóa không hợp lệ.');
}

export async function writeFinanceLock(uid: string, enabled: boolean) {
  await SecureStore.setItemAsync(lockKey(uid), enabled ? 'on' : 'off', {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getFinanceBiometrics() {
  const [types, level] = await Promise.all([
    LocalAuthentication.supportedAuthenticationTypesAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
  ]);
  const label =
    Platform.OS === 'ios'
      ? types.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
        )
        ? 'Face ID'
        : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
          ? 'Touch ID'
          : 'Face ID / Touch ID'
      : 'Vân tay / khuôn mặt';
  return {
    label,
    canEnable: level >= LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG,
  };
}

export async function authenticateFinance(
  promptMessage: string,
): Promise<FinanceAuthenticationResult> {
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
