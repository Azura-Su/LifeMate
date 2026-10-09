import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  authenticateFinance,
  getFinanceBiometrics,
  readFinanceLock,
  writeFinanceLock,
} from '../financeLock';

it('keeps a separate secure preference for each UID, including custom UID characters', async () => {
  await writeFinanceLock('a/b', true);
  await writeFinanceLock('a_b', false);
  const calls = jest.mocked(SecureStore.setItemAsync).mock.calls;
  expect(calls[0][0]).not.toBe(calls[1][0]);
  expect(calls[0][0]).toMatch(/^[A-Za-z0-9_.-]+$/);
  expect(calls[0][2]?.keychainAccessible).toBe(
    SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  );
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('broken');
  await expect(readFinanceLock('a/b')).rejects.toThrow();
});

it('uses strong biometrics with system passcode fallback and keeps cancellation an explicit failure', async () => {
  jest
    .mocked(LocalAuthentication.authenticateAsync)
    .mockResolvedValueOnce({ success: false, error: 'user_cancel' });
  expect((await authenticateFinance('Mở khóa Tài chính')).success).toBe(false);
  expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      biometricsSecurityLevel: 'strong',
      disableDeviceFallback: false,
    }),
  );
});

it('does not offer enabling protection with unenrolled or weak-only biometrics', async () => {
  jest
    .mocked(LocalAuthentication.getEnrolledLevelAsync)
    .mockResolvedValueOnce(LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK);
  expect((await getFinanceBiometrics()).canEnable).toBe(false);
});
