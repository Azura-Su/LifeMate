import { readAvatar, removeAvatar, uploadAvatar } from '../avatarService';
import * as FileSystem from 'expo-file-system/legacy';
import { accountIdToken } from '../../firebase/authService';
import { useAuthStore } from '../../../store/authStore';
import { drainAccountWrites } from '../../security/accountLifecycle';

jest.mock('../../../config/audioCloud', () => ({
  audioCloudUrl: () => 'https://example.supabase.co',
  audioCloudApiKey: () => 'public-key',
}));
jest.mock('../../firebase/authService', () => ({
  accountIdToken: jest.fn().mockResolvedValue('token'),
  currentSessionUser: () => ({ uid: 'u1' }),
}));
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  createUploadTask: jest.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  FileSystemSessionType: { FOREGROUND: 0 },
}));

const originalFetch = global.fetch;
beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(accountIdToken).mockReset().mockResolvedValue('token');
  jest
    .mocked(FileSystem.getInfoAsync)
    .mockReset()
    .mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 100,
    } as never);
  jest.mocked(FileSystem.createUploadTask).mockReset();
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: null, displayName: null });
});

it.each([
  ['token', 'timeout'],
  ['token', 'abort'],
  ['token', 'logout'],
  ['file', 'abort'],
  ['upload', 'timeout'],
  ['upload', 'abort'],
] as const)(
  'settles stalled avatar %s on %s without waiting for native cancellation',
  async (stage, reason) => {
    let release = () => {};
    if (stage === 'token')
      jest.mocked(accountIdToken).mockReturnValue(
        new Promise((resolve) => {
          release = () => resolve('late-token');
        }),
      );
    if (stage === 'file')
      jest.mocked(FileSystem.getInfoAsync).mockReturnValue(
        new Promise((resolve) => {
          release = () =>
            resolve({ exists: true, isDirectory: false, size: 100 } as never);
        }),
      );
    const cancelAsync = jest.fn(() => new Promise<void>(() => {}));
    const uploadAsync = jest.fn(() =>
      stage === 'upload'
        ? new Promise((resolve) => {
            release = () =>
              resolve({ status: 200, body: '{"avatarUrl":null}' });
          })
        : Promise.resolve({ status: 200, body: '{"avatarUrl":null}' }),
    );
    jest
      .mocked(FileSystem.createUploadTask)
      .mockReturnValue({ uploadAsync, cancelAsync } as never);
    const controller = new AbortController();
    const operation = uploadAvatar(
      'u1',
      'file:///avatar.jpg',
      controller.signal,
    ).catch((error: Error) => error.message);
    try {
      await jest.advanceTimersByTimeAsync(0);
      if (reason === 'timeout') await jest.advanceTimersByTimeAsync(25001);
      else if (reason === 'abort') controller.abort();
      else useAuthStore.getState().setUser(null);
      await jest.advanceTimersByTimeAsync(0);
      expect(
        await Promise.race([operation, Promise.resolve('still pending')]),
      ).not.toBe('still pending');
      let drained = false;
      void drainAccountWrites('u1').then(() => {
        drained = true;
      });
      await jest.advanceTimersByTimeAsync(0);
      expect(drained).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
      if (stage === 'upload') expect(cancelAsync).toHaveBeenCalledTimes(1);
      else expect(FileSystem.createUploadTask).not.toHaveBeenCalled();
    } finally {
      release();
      await jest.advanceTimersByTimeAsync(0);
      await operation;
      await drainAccountWrites('u1');
    }
    if (stage !== 'upload')
      expect(FileSystem.createUploadTask).not.toHaveBeenCalled();
  },
);
afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

it('bounds a stalled response body and lets account cleanup finish', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ status: 200, text: () => new Promise(() => {}) });
  const outcome = removeAvatar('u1').catch((error: Error) => error.message);
  await jest.advanceTimersByTimeAsync(20001);
  expect(
    await Promise.race([outcome, Promise.resolve('still pending')]),
  ).toMatch(/quá lâu/i);
  await drainAccountWrites('u1');
});

it('rejects a stalled request immediately on logout', async () => {
  global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
  const outcome = readAvatar('u1').catch((error: Error) => error.message);
  await jest.advanceTimersByTimeAsync(0);
  useAuthStore.getState().setUser(null);
  await jest.advanceTimersByTimeAsync(0);
  expect(
    await Promise.race([outcome, Promise.resolve('still pending')]),
  ).toMatch(/tài khoản.*thay đổi/i);
});

it('accepts an avatar response after a same-UID profile refresh', async () => {
  let finish!: (text: string) => void;
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    text: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  });
  const outcome = readAvatar('u1');
  await jest.advanceTimersByTimeAsync(0);
  useAuthStore.getState().setUser({
    uid: 'u1',
    email: 'updated@example.com',
    displayName: 'Updated',
  });
  finish('{"avatarUrl":null}');
  expect(await outcome).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
});
