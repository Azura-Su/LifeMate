import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  authenticateDevice,
  type DeviceAuthenticationResult,
} from './deviceAuthentication';

export type FinanceAuthenticationResult = DeviceAuthenticationResult;

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
  return authenticateDevice(promptMessage);
}
