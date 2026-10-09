import { useAuthStore } from '../authStore';
import { useFinanceLockStore } from '../financeLockStore';
import {
  authenticateFinance,
  getFinanceBiometrics,
  readFinanceLock,
  writeFinanceLock,
} from '../../services/security/financeLock';

jest.mock('../../services/security/financeLock', () => ({
  authenticateFinance: jest.fn(),
  getFinanceBiometrics: jest.fn(),
  readFinanceLock: jest.fn(),
  writeFinanceLock: jest.fn(),
}));

beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: 'test@example.com', displayName: null });
  useFinanceLockStore.getState().lock();
  useFinanceLockStore.setState({
    uid: null,
    enabled: null,
    loading: false,
    authenticating: false,
    changing: false,
    unlocked: false,
    appActive: true,
    error: null,
  });
  jest.mocked(readFinanceLock).mockResolvedValue(true);
  jest
    .mocked(getFinanceBiometrics)
    .mockResolvedValue({ label: 'Face ID', canEnable: true });
  jest
    .mocked(authenticateFinance)
    .mockResolvedValue({ success: true, message: null });
  jest.mocked(writeFinanceLock).mockResolvedValue(undefined);
});

it('keeps protected data locked on canceled authentication and unlocks only on success', async () => {
  await useFinanceLockStore.getState().load('u1');
  expect(useFinanceLockStore.getState().unlocked).toBe(false);
  jest
    .mocked(authenticateFinance)
    .mockResolvedValueOnce({ success: false, message: 'Đã hủy xác thực.' });
  expect(await useFinanceLockStore.getState().unlock('u1')).toBe(false);
  expect(useFinanceLockStore.getState().unlocked).toBe(false);
  expect(await useFinanceLockStore.getState().unlock('u1')).toBe(true);
  expect(useFinanceLockStore.getState().unlocked).toBe(true);
  useFinanceLockStore.getState().lock();
  expect(useFinanceLockStore.getState().unlocked).toBe(false);
});

it('ignores an authentication result after the session is locked', async () => {
  await useFinanceLockStore.getState().load('u1');
  let finish!: (value: { success: boolean; message: null }) => void;
  jest.mocked(authenticateFinance).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = useFinanceLockStore.getState().unlock('u1');
  useFinanceLockStore.getState().lock();
  finish({ success: true, message: null });
  expect(await pending).toBe(false);
  expect(useFinanceLockStore.getState().unlocked).toBe(false);
});

it('ignores success for a different signed-in account, including before the new preference loads', async () => {
  await useFinanceLockStore.getState().load('u1');
  let finish!: (value: { success: boolean; message: null }) => void;
  jest.mocked(authenticateFinance).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = useFinanceLockStore.getState().unlock('u1');
  useAuthStore
    .getState()
    .setUser({ uid: 'u2', email: 'other@example.com', displayName: null });
  finish({ success: true, message: null });
  expect(await pending).toBe(false);
  expect(useFinanceLockStore.getState().unlocked).toBe(false);
});

it('requires authentication for both enabling and disabling and never changes a canceled preference', async () => {
  jest.mocked(readFinanceLock).mockResolvedValue(false);
  await useFinanceLockStore.getState().load('u1');
  await useFinanceLockStore.getState().setEnabled('u1', true);
  expect(authenticateFinance).toHaveBeenCalledTimes(1);
  expect(writeFinanceLock).toHaveBeenCalledWith('u1', true);
  expect(useFinanceLockStore.getState().enabled).toBe(true);
  jest
    .mocked(authenticateFinance)
    .mockResolvedValueOnce({ success: false, message: 'Đã hủy xác thực.' });
  await useFinanceLockStore.getState().setEnabled('u1', false);
  expect(writeFinanceLock).toHaveBeenCalledTimes(1);
  expect(useFinanceLockStore.getState().enabled).toBe(true);
  await useFinanceLockStore.getState().setEnabled('u1', false);
  expect(writeFinanceLock).toHaveBeenLastCalledWith('u1', false);
});

it('fails closed when secure preferences cannot be read or saved', async () => {
  jest
    .mocked(readFinanceLock)
    .mockRejectedValueOnce(new Error('Keychain details'));
  await useFinanceLockStore.getState().load('u1');
  expect(useFinanceLockStore.getState().enabled).toBeNull();
  expect(await useFinanceLockStore.getState().unlock('u1')).toBe(false);
  expect(authenticateFinance).not.toHaveBeenCalled();
  await useFinanceLockStore.getState().load('u1');
  jest
    .mocked(writeFinanceLock)
    .mockRejectedValueOnce(new Error('Native details'));
  await useFinanceLockStore.getState().setEnabled('u1', false);
  expect(useFinanceLockStore.getState().enabled).toBe(true);
  expect(useFinanceLockStore.getState().error).not.toContain('Native details');
});

it('shares a successful Home peek unlock with the Finance tab for this session', async () => {
  await useFinanceLockStore.getState().load('u1');
  expect(await useFinanceLockStore.getState().revealHome('u1')).toBe(true);
  expect(useFinanceLockStore.getState().unlocked).toBe(true);
  expect(await useFinanceLockStore.getState().unlock('u1')).toBe(true);
  expect(authenticateFinance).toHaveBeenCalledTimes(1);
});

it('never changes the lock preference after an authentication interrupted by backgrounding', async () => {
  await useFinanceLockStore.getState().load('u1');
  let finish!: (value: { success: boolean; message: null }) => void;
  jest.mocked(authenticateFinance).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = useFinanceLockStore.getState().setEnabled('u1', false);
  useFinanceLockStore.getState().setAppActive(false);
  useFinanceLockStore.getState().lock();
  finish({ success: true, message: null });
  await pending;
  expect(writeFinanceLock).not.toHaveBeenCalled();
  expect(useFinanceLockStore.getState().enabled).toBe(true);
});
