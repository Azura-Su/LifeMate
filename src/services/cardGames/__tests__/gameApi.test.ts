import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { useAuthStore } from '../../../store/authStore';
import { GameApiError, gameRequest } from '../gameApi';

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(),
  getIdToken: jest.fn(),
}));
jest.mock('../../../config/audioCloud', () => ({
  audioCloudUrl: () => 'https://example.supabase.co',
  audioCloudApiKey: () => 'public-test-key',
}));
const originalFetch = global.fetch;
beforeEach(() => {
  useAuthStore
    .getState()
    .setUser({ uid: 'a', email: 'a@example.invalid', displayName: 'An' });
  jest.mocked(getAuth).mockReturnValue({ currentUser: { uid: 'a' } } as never);
  jest.mocked(getIdToken).mockResolvedValue('token');
});
afterEach(() => {
  global.fetch = originalFetch;
});

it('turns an empty or malformed response into a recoverable localized error', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      status: 502,
      ok: false,
      json: () => Promise.reject(new SyntaxError('Unexpected end of input')),
    });
  const result = gameRequest(
    'a',
    { type: 'sync', sessionId: 'session' },
    new AbortController().signal,
  );
  await expect(result).rejects.toBeInstanceOf(GameApiError);
  await expect(result).rejects.toMatchObject({
    code: 'game-unavailable',
    status: 503,
  });
});

it('cancels waiting for a response body when the account changes', async () => {
  let started!: () => void;
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => {
      started();
      return new Promise(() => undefined);
    },
  });
  const result = gameRequest(
    'a',
    { type: 'sync', sessionId: 'session' },
    new AbortController().signal,
  );
  const assertion = expect(result).rejects.toThrow('Chưa xác nhận');
  await reading;
  useAuthStore.getState().setUser(null);
  await assertion;
});
