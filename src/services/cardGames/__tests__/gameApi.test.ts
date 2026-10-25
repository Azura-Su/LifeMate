import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { useAuthStore } from '../../../store/authStore';
import { GameApiError, gameRequest } from '../gameApi';
import { DEFAULT_PHOM_CONFIG } from '../phomConfig';
import { createGameSession } from '../gameSession';
import type { GameRequest, GameSnapshot } from '../../../types/cardGame';

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
    const fetchMock = jest.fn().mockResolvedValue({
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      clientVersion: 8,
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

it('keeps an uncertain action on its negotiated protocol after an edge rollout', async () => {
  const input: GameRequest = {
    type: 'leave',
    sessionId: 'retry-session',
    actionId: 'lost-ack',
    roomId: 'room',
    expectedVersion: 1,
    matchId: null,
  };
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid-input' }),
    })
    .mockRejectedValueOnce(new Error('ACK lost'))
    .mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ room: null, serverTime: 10 }),
    });
  global.fetch = fetchMock;
  await expect(
    gameRequest('a', input, new AbortController().signal),
  ).rejects.toThrow('ACK lost');
  // Unrelated actions cannot evict the pending action's protocol.
  for (let i = 0; i < 140; i++) {
    await gameRequest(
      'a',
      { ...input, actionId: `other-${i}` },
      new AbortController().signal,
    );
  }
  await gameRequest('a', input, new AbortController().signal);
  expect(
    fetchMock.mock.calls.map(
      ([, request]) => JSON.parse(request.body).clientVersion,
    ),
  ).toEqual([8, 7, ...Array(140).fill(8), 7]);
});

it('does not reuse a negotiated protocol across account epochs or below the required capability', async () => {
  const input: GameRequest = {
    type: 'ready',
    ready: true,
    sessionId: 'fence',
    actionId: 'fence',
  };
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid-input' }),
    })
    .mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid-input' }),
    })
    .mockRejectedValueOnce(new Error('ACK lost'))
    .mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ room: null, serverTime: 10 }),
    });
  global.fetch = fetchMock;
  await expect(
    gameRequest('a', input, new AbortController().signal),
  ).rejects.toThrow('ACK lost');
  input.requiredClientVersion = 7;
  await expect(
    gameRequest('a', input, new AbortController().signal),
  ).rejects.toMatchObject({ code: 'game-update-required' });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  useAuthStore.getState().setUser(null);
  useAuthStore
    .getState()
    .setUser({ uid: 'a', email: 'a@example.invalid', displayName: 'An' });
  await gameRequest('a', input, new AbortController().signal);
  expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).clientVersion).toBe(
    8,
  );
});

it.each([
  {
    type: 'create',
    game: 'north',
    name: 'An',
    sessionId: 'session',
  },
  {
    type: 'join',
    game: 'sam',
    name: 'An',
    code: 'ABCDEFGH',
    sessionId: 'session',
    actionId: '11111111-1111-4111-8111-111111111111',
  },
  {
    type: 'game-action',
    gameAction: { type: 'call-sam' },
    sessionId: 'session',
    roomId: '11111111-1111-4111-8111-111111111111',
    actionId: '22222222-2222-4222-8222-222222222222',
    expectedVersion: 1,
    matchId: null,
  },
])('requires the variant capability for the $type flow', async (input) => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 400,
    ok: false,
    json: async () => ({ error: 'invalid-input' }),
  });
  global.fetch = fetchMock;

  await expect(
    gameRequest('a', input as GameRequest, new AbortController().signal),
  ).rejects.toMatchObject({ code: 'game-update-required' });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.clientVersion).toBe(
    input.type === 'game-action' ? 9 : input.type === 'join' ? 11 : 10,
  );
  if (input.type === 'join') expect(body.game).toBeUndefined();
});

it('negotiates protocol 10 when a configured variant room requires its settings capability', async () => {
  const versions: number[] = [];
  const fetchMock = jest
    .fn()
    .mockImplementationOnce(async (_url, request) => {
      versions.push(JSON.parse(request.body).clientVersion);
      return {
        status: 409,
        ok: false,
        json: async () => ({ error: 'game-update-required' }),
      };
    })
    .mockImplementationOnce(async (_url, request) => {
      versions.push(JSON.parse(request.body).clientVersion);
      return {
        status: 409,
        ok: false,
        json: async () => ({ error: 'game-update-required' }),
      };
    })
    .mockImplementationOnce(async (_url, request) => {
      versions.push(JSON.parse(request.body).clientVersion);
      return {
        status: 200,
        ok: true,
        json: async () => ({ room: null, serverTime: 10 }),
      };
    });
  global.fetch = fetchMock;
  await expect(
    gameRequest(
      'a',
      { type: 'bootstrap', sessionId: 'session' },
      new AbortController().signal,
    ),
  ).resolves.toMatchObject({ room: null, serverTime: 10 });
  expect(versions).toEqual([8, 9, 10]);
});

it('negotiates protocol 9 after a room bootstrap reports that an existing variant needs an update', async () => {
  const versions: number[] = [];
  const fetchMock = jest
    .fn()
    .mockImplementationOnce(async (_url, request) => {
      versions.push(JSON.parse(request.body).clientVersion);
      return {
        status: 409,
        ok: false,
        json: async () => ({ error: 'game-update-required' }),
      };
    })
    .mockImplementationOnce(async (_url, request) => {
      versions.push(JSON.parse(request.body).clientVersion);
      return {
        status: 200,
        ok: true,
        json: async () => ({ room: null, serverTime: 10 }),
      };
    });
  global.fetch = fetchMock;

  await expect(
    gameRequest(
      'a',
      { type: 'bootstrap', sessionId: 'session' },
      new AbortController().signal,
    ),
  ).resolves.toMatchObject({ room: null, serverTime: 10 });
  expect(versions).toEqual([8, 9]);
});

it('negotiates up to protocol 11 for rooms that use v2 scoring profiles', async () => {
  const versions: number[] = [];
  const fetchMock = jest
    .fn()
    .mockImplementationOnce(async (_url, request) => {
      versions.push(JSON.parse(request.body).clientVersion);
      return { status: 409, ok: false, json: async () => ({ error: 'game-update-required' }) };
    })
    .mockImplementationOnce(async (_url, request) => {
      versions.push(JSON.parse(request.body).clientVersion);
      return { status: 409, ok: false, json: async () => ({ error: 'game-update-required' }) };
    })
    .mockImplementationOnce(async (_url, request) => {
      versions.push(JSON.parse(request.body).clientVersion);
      return { status: 409, ok: false, json: async () => ({ error: 'game-update-required' }) };
    })
    .mockImplementationOnce(async (_url, request) => {
      versions.push(JSON.parse(request.body).clientVersion);
      return { status: 200, ok: true, json: async () => ({ room: null, serverTime: 10 }) };
    });
  global.fetch = fetchMock;
  await expect(
    gameRequest('a', { type: 'bootstrap', sessionId: 'session' }, new AbortController().signal),
  ).resolves.toMatchObject({ room: null, serverTime: 10 });
  expect(versions).toEqual([8, 9, 10, 11]);
});

it('preserves the negotiated protocol through real session retries in an optional-rules room', async () => {
  const snapshot: GameSnapshot = {
    serverTime: 10,
    room: {
      id: '11111111-1111-4111-8111-111111111111',
      epoch: '22222222-2222-4222-8222-222222222222',
      code: 'ABCDEFGH',
      version: 1,
      matchId: null,
      phase: 'lobby',
      host: 'a',
      controller: true,
      topic:
        'card-room:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222',
      members: [{ uid: 'a', name: 'An', ready: false, wins: 0 }],
      game: null,
      gameKind: 'phom',
      phomConfig: {
        ...DEFAULT_PHOM_CONFIG,
        options: { tai: true, send: true, uDen: true },
      },
    },
  };
  const versions: number[] = [];
  let firstWrite = true;
  global.fetch = jest.fn(async (_url, init) => {
    const input = JSON.parse(init!.body as string);
    if (input.actionId) {
      versions.push(input.clientVersion);
      if (firstWrite && input.clientVersion === 8)
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: 'invalid-input' }),
        } as Response;
      if (firstWrite) {
        firstWrite = false;
        throw new Error('ACK lost');
      }
    }
    return { ok: true, status: 200, json: async () => snapshot } as Response;
  });
  const session = createGameSession({
    sessionId: 'option-retry',
    uuid: () => 'option-action',
    request: (input, signal) => gameRequest('a', input, signal),
    onChange: jest.fn(),
    subscribe: (_topic, _hint, status) => {
      status(true);
      return jest.fn();
    },
  });
  try {
    session.start();
    for (let i = 0; i < 50; i++) await Promise.resolve();
    await session.send({ type: 'ready', ready: true });
    for (let i = 0; i < 50; i++) await Promise.resolve();
    await session.retry();
    expect(versions).toEqual([8, 7, 7]);
  } finally {
    session.stop();
  }
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
      minClientVersion: 11,
      gameKind: 'sam',
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
  ).resolves.toMatchObject({
    minClientVersion: 11,
    gameKind: 'sam',
    canReopen: true,
    canDelete: true,
    exists: true,
  });
});

it('falls back through protocol 8 through 2 when talking to an older edge function', async () => {
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
  ).toEqual([8, 7, 6, 5, 4, 3, 2]);
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
  expect(fetchMock).toHaveBeenCalledTimes(6);
  expect(
    fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).clientVersion),
  ).toEqual([8, 7, 6, 5, 4, 3]);
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
  expect(global.fetch).toHaveBeenCalledTimes(10);
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
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      clientVersion: 8,
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
    expect(request).toHaveBeenCalledTimes(3);
    expect(JSON.parse(request.mock.calls[0][1].body).clientVersion).toBe(8);
    expect(JSON.parse(request.mock.calls[0][1].body)).not.toHaveProperty(
      'requiredClientVersion',
    );
  },
);
