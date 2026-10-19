import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { useAuthStore } from '../../../store/authStore';
import { manageUsers } from '../userManagement';

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(),
  getIdToken: jest.fn(),
}));
jest.mock('../../../config/audioCloud', () => ({
  audioCloudUrl: () => 'https://example.test',
  audioCloudApiKey: () => 'public-key',
}));
jest.mock('../../../config/userAdmin', () => ({
  isUserAdmin: (user: { uid?: string } | null) => user?.uid === 'admin',
}));
const originalFetch = global.fetch;
const fetchMock = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  useAuthStore
    .getState()
    .setUser({ uid: 'admin', email: null, displayName: null });
  jest
    .mocked(getAuth)
    .mockImplementation(
      () => ({ currentUser: useAuthStore.getState().user }) as never,
    );
  jest.mocked(getIdToken).mockResolvedValue('token');
  global.fetch = fetchMock;
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

it.each([
  ['token', 'timeout', 'list'],
  ['token', 'abort', 'delete'],
  ['token', 'relogin', 'list'],
  ['json', 'timeout', 'list'],
  ['json', 'abort', 'list'],
  ['json', 'timeout', 'delete'],
] as const)(
  'settles stalled admin %s on %s for %s without retrying',
  async (stage, reason, action) => {
    let release = () => {};
    if (stage === 'token')
      jest.mocked(getIdToken).mockReturnValue(
        new Promise((resolve) => {
          release = () => resolve('late-token');
        }),
      );
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        stage === 'json'
          ? new Promise((resolve) => {
              release = () => resolve({});
            })
          : Promise.resolve({}),
    });
    const controller = new AbortController();
    const operation = manageUsers({ action }, controller.signal).catch(
      (error: Error) => error.message,
    );
    try {
      await jest.advanceTimersByTimeAsync(0);
      if (reason === 'timeout')
        await jest.advanceTimersByTimeAsync(
          action === 'delete' ? 60001 : 25001,
        );
      else if (reason === 'abort') controller.abort();
      else {
        useAuthStore.getState().setUser(null);
        useAuthStore
          .getState()
          .setUser({ uid: 'admin', email: null, displayName: null });
      }
      await jest.advanceTimersByTimeAsync(0);
      expect(
        await Promise.race([operation, Promise.resolve('still pending')]),
      ).not.toBe('still pending');
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      release();
      await jest.advanceTimersByTimeAsync(0);
      await operation;
    }
    expect(fetchMock).toHaveBeenCalledTimes(stage === 'token' ? 0 : 1);
  },
);
