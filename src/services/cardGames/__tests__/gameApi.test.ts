import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { useAuthStore } from '../../../store/authStore';
import { GameApiError, gameRequest } from '../gameApi';
import { DEFAULT_PHOM_CONFIG } from '../phomConfig';

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(),
  getIdToken: jest.fn(),
}));
jest.mock('../../../config/audioCloud', () => ({
  audioCloudUrl: () => 'https://example.supabase.co',
  audioCloudApiKey: () => 'public-test-key',
}));
const originalFetch = global.fetch;
it.each(['create', 'set-phom-rules'] as const)(
  'never drops optional Phỏm rules when %s reaches an older server',
  async (type) => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({
        status: 400,
        ok: false,
        json: async () => ({ error: 'invalid-input' }),
      });
    global.fetch = fetchMock;
    const phomConfig = {
      ...DEFAULT_PHOM_CONFIG,
      options: { tai: true, send: false, uDen: false },
    };
    await expect(
      gameRequest(
        'a',
        {
          type,
          game: 'phom',
          phomConfig,
          name: 'An',
          sessionId: 'session',
        } as never,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'game-update-required' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      clientVersion: 7,
      phomConfig,
    });
  },
);
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
      {
        type: 'room-status',
        roomId,
        sessionId: '11111111-1111-4111-8111-111111111111',
      },
      new AbortController().signal,
    ),
  ).resolves.toMatchObject({ canReopen: true, canDelete: true, exists: true });
});

it('falls back through protocol 7 through 2 when talking to an older edge function', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({ error: 'invalid-input' }),
    })
    .mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({ error: 'invalid-input' }),
    })
    .mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({ error: 'invalid-input' }),
    })
    .mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({ error: 'invalid-input' }),
    })
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

  expect(
    fetchMock.mock.calls.map(
      (call) => JSON.parse(call[1]!.body as string).clientVersion,
    ),
  ).toEqual([7, 6, 5, 4, 3, 2]);
});

it('never retries Phỏm creation with an unsupported protocol', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 400,
    ok: false,
    json: async () => ({ error: 'invalid-input' }),
  });
  global.fetch = fetchMock;
  await expect(
    gameRequest(
      'a',
      {
        type: 'create',
        game: 'phom',
        phomConfig: {
          second: 1,
          third: 2,
          last: 3,
          eat: 1,
          chot: 4,
          mom: 4,
          u: 5,
          uTron: 10,
          den: 5,
          forfeit: 4,
        },
        name: 'An',
        sessionId: 'session',
        actionId: 'action',
      },
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: 'game-update-required' });
  expect(fetchMock).toHaveBeenCalledTimes(5);
  expect(
    fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).clientVersion),
  ).toEqual([7, 6, 5, 4, 3]);
});

it('never silently downgrades configured South or sends its local retry fence', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    status: 400,
    ok: false,
    json: async () => ({ error: 'invalid-input' }),
  });
  for (const input of [
    {
      type: 'create',
      game: 'south',
      name: 'An',
      amountPerCard: 5,
      southConfig: { finishMode: 'first-winner', cutTwoAmount: 10 },
    },
    { type: 'play', cards: [0], roomId: 'room', requiredClientVersion: 4 },
  ]) {
    await expect(
      gameRequest(
        'a',
        { ...input, sessionId: 'session' } as never,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'game-update-required' });
  }
  expect(global.fetch).toHaveBeenCalledTimes(8);
  for (const call of jest.mocked(global.fetch).mock.calls)
    expect(JSON.parse(call[1]!.body as string)).not.toHaveProperty(
      'requiredClientVersion',
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

it.each([
  {
    type: 'set-south-rules',
    roomId: 'room',
    amountPerCard: 5,
    southConfig: { finishMode: 'continue', cutTwoAmount: 0 },
  },
  { type: 'ready', roomId: 'room', ready: true, requiredClientVersion: 5 },
])(
  'never downgrades next-round rules requests to an unaware server',
  async (input) => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 400,
      ok: false,
      json: async () => ({ error: 'invalid-input' }),
    });
    global.fetch = fetchMock;
    await expect(
      gameRequest(
        'a',
        { ...input, sessionId: 'session' } as never,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'game-update-required' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      clientVersion: 7,
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty(
      'requiredClientVersion',
    );
  },
);

it.each([
  {
    type: 'set-phom-rules',
    roomId: 'room',
    phomConfig: {
      second: 1,
      third: 2,
      last: 3,
      eat: 1,
      chot: 4,
      mom: 4,
      u: 5,
      uTron: 10,
      den: 5,
      forfeit: 4,
    },
  },
  { type: 'ready', roomId: 'room', ready: true, requiredClientVersion: 6 },
])(
  'never downgrades Phỏm pending rules requests below capability6',
  async (input) => {
    const request = jest.fn().mockResolvedValue({
      status: 400,
      ok: false,
      json: async () => ({ error: 'invalid-input' }),
    });
    global.fetch = request;
    await expect(
      gameRequest(
        'a',
        { ...input, sessionId: 'session' } as never,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'game-update-required' });
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(request.mock.calls[0][1].body).clientVersion).toBe(7);
    expect(JSON.parse(request.mock.calls[0][1].body)).not.toHaveProperty(
      'requiredClientVersion',
    );
  },
);
