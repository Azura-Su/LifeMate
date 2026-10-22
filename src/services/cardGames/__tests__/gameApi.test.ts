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
  global.fetch = jest.fn().mockResolvedValue({
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

it('parses room status separately from a player room snapshot', async () => {
  const roomId = '00000000-0000-4000-8000-000000000001';
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({
      roomId,
      exists: true,
      owner: true,
      canRejoin: false,
      canReopen: true,
      canDelete: true,
      expired: true,
      phase: 'finished',
      version: 3,
      matchId: null,
    }),
  });

  await expect(
    gameRequest(
      'a',
      { type: 'room-status', roomId, sessionId: '11111111-1111-4111-8111-111111111111' },
      new AbortController().signal,
    ),
  ).resolves.toMatchObject({ canReopen: true, canDelete: true, exists: true });
});

it('falls back to the legacy request shape when talking to an older edge function', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({ error: 'invalid-input' }),
    })
    .mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ room: null, serverTime: 10 }),
    });
  global.fetch = fetchMock;

  await expect(
    gameRequest(
      'a',
      { type: 'sync', sessionId: 'session' },
      new AbortController().signal,
    ),
  ).resolves.toMatchObject({ room: null, serverTime: 10 });

  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toMatchObject({
    clientVersion: 2,
  });
  expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).not.toHaveProperty(
    'clientVersion',
  );
});

it('localizes a Firebase Secure Token connection failure without exposing host details', async () => {
  const authError = Object.assign(
    new Error(
      'An internal error has occurred. Failed to connect to securetoken.googleapis.com/[2001:db8::1]:443',
    ),
    { code: 'auth/unknown' },
  );
  jest.mocked(getIdToken).mockRejectedValue(authError);
  global.fetch = jest.fn();

  await expect(
    gameRequest(
      'a',
      { type: 'bootstrap', sessionId: 'session' },
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({
    code: 'auth-unavailable',
    status: 503,
    message: 'Không kết nối được máy chủ xác thực. Kiểm tra mạng rồi thử lại.',
  });
  expect(global.fetch).not.toHaveBeenCalled();
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
