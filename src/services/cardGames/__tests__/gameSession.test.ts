import { createGameSession } from '../gameSession';
import type { GameRequest, GameSnapshot } from '../../../types/cardGame';
const apiError = (code: string, status: number) =>
  Object.assign(new Error(code), { code, status });

const snapshot = (version = 1): GameSnapshot => ({
  serverTime: version * 100,
  room: {
    id: '11111111-1111-4111-8111-111111111111',
    epoch: '22222222-2222-4222-8222-222222222222',
    code: 'ABCDEFGH',
    version,
    matchId: null,
    phase: 'lobby',
    host: 'a',
    controller: true,
    topic: 'topic',
    members: [{ uid: 'a', name: 'An', ready: false, wins: 0 }],
    game: null,
  },
});
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it.each(['host', 'guest'])(
  'keeps the %s in the room throughout an explicit reconnect',
  async (role) => {
    const onChange = jest.fn();
    const room = snapshot();
    room.room!.members.push({ uid: 'b', name: 'Bình', ready: false, wins: 0 });
    let reads = 0;
    let finishSync!: (snapshot: GameSnapshot) => void;
    const request = jest.fn(async (input: GameRequest) => {
      if (input.type === 'sync' && ++reads === 2)
        return new Promise<GameSnapshot>((resolve) => {
          finishSync = resolve;
        });
      return room;
    });
    const controller = createGameSession({
      sessionId: role,
      request,
      onChange,
      uuid: () => 'action',
      subscribe: (_topic, _hint, status) => {
        status(true);
        return jest.fn();
      },
    });
    controller.start();
    await flush();
    const before = onChange.mock.calls.length;

    await controller.retry();
    await flush();

    expect(
      onChange.mock.calls
        .slice(before)
        .every(([state]) => state.snapshot?.room?.id === room.room!.id),
    ).toBe(true);
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
      loading: true,
      connected: true,
    });
    // Subscription alone cannot make the preserved version actionable.
    await controller.send({ type: 'ready', ready: true });
    expect(onChange.mock.calls.at(-1)?.[0].loading).toBe(true);
    expect(request.mock.calls.map(([input]) => input.type)).toEqual([
      'bootstrap',
      'sync',
      'bootstrap',
      'sync',
    ]);
    finishSync(room);
    await flush();
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
      snapshot: room,
      loading: false,
      connected: true,
    });
    expect(request.mock.calls.map(([input]) => input.type)).toEqual([
      'bootstrap',
      'sync',
      'bootstrap',
      'sync',
    ]);
    controller.stop();
    expect(onChange.mock.calls.at(-1)?.[0].snapshot).toBeNull();
    await controller.retry();
    expect(onChange.mock.calls.at(-1)?.[0].snapshot).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  },
);

it.each(['host', 'guest'])(
  'automatically resolves a stale room version for the %s without replaying the action',
  async (role) => {
    const onChange = jest.fn();
    let status!: (connected: boolean) => void;
    let current = snapshot(1);
    const request = jest.fn(async (input: GameRequest) => {
      if (input.type === 'ready') {
        current = snapshot(2);
        throw apiError('version-conflict', 409);
      }
      return current;
    });
    const controller = createGameSession({
      sessionId: role,
      request,
      onChange,
      uuid: () => 'action',
      subscribe: (_topic, _hint, callback) => {
        status = callback;
        return jest.fn();
      },
    });
    controller.start();
    await flush();
    status(true);
    await flush();
    await controller.send({ type: 'ready', ready: true });
    await flush();

    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
      snapshot: current,
      error: null,
      pending: false,
    });
    expect(
      request.mock.calls.filter(([input]) => input.type === 'ready'),
    ).toHaveLength(1);
    controller.stop();
  },
);

it('waits for a read started after the conflict before clearing its message', async () => {
  const onChange = jest.fn();
  let hint!: () => void;
  let read = 0;
  let oldRead!: (snapshot: GameSnapshot) => void,
    freshRead!: (snapshot: GameSnapshot) => void;
  const controller = createGameSession({
    sessionId: 'session',
    onChange,
    uuid: () => 'action',
    request: async (input) => {
      if (input.type === 'ready') throw apiError('version-conflict', 409);
      if (input.type === 'sync' && ++read > 1)
        return new Promise<GameSnapshot>((resolve) => {
          if (read === 2) oldRead = resolve;
          else freshRead = resolve;
        });
      return snapshot(1);
    },
    subscribe: (_topic, h, s) => {
      hint = h;
      s(true);
      return jest.fn();
    },
  });
  controller.start();
  await flush();
  hint();
  await flush();
  await controller.send({ type: 'ready', ready: true });
  oldRead(snapshot(1));
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0].error).toBe('version-conflict');
  freshRead(snapshot(2));
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0].error).toBeNull();
  controller.stop();
});

it('keeps newer invalid-play feedback when an older conflict refresh completes', async () => {
  const onChange = jest.fn();
  let read = 0,
    refresh!: (snapshot: GameSnapshot) => void;
  const controller = createGameSession({
    sessionId: 'session',
    onChange,
    uuid: () => 'action',
    request: async (input) => {
      if (input.type === 'ready') throw apiError('version-conflict', 409);
      if (input.type === 'play') throw apiError('cannot-beat', 422);
      if (input.type === 'sync' && ++read === 2)
        return new Promise<GameSnapshot>((resolve) => {
          refresh = resolve;
        });
      return snapshot(2);
    },
    subscribe: (_topic, _hint, s) => {
      s(true);
      return jest.fn();
    },
  });
  controller.start();
  await flush();
  await controller.send({ type: 'ready', ready: true });
  await flush();
  await controller.send({ type: 'play', cards: [0] });
  refresh(snapshot(2));
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0].error).toBe(
    apiError('cannot-beat', 422).message,
  );
  controller.stop();
});

it('clears a preserved room when reconnect confirms membership is gone', async () => {
  const onChange = jest.fn();
  let status!: (connected: boolean) => void;
  let closed = false;
  const controller = createGameSession({
    sessionId: 'session',
    onChange,
    uuid: () => 'action',
    request: async () =>
      closed ? { serverTime: 1000, room: null } : snapshot(1),
    subscribe: (_topic, _hint, s) => {
      status = s;
      return jest.fn();
    },
  });
  controller.start();
  await flush();
  status(true);
  await flush();
  closed = true;
  await controller.retry();
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
    snapshot: { room: null },
    loading: false,
  });
  controller.stop();
});

it('falls back to polling when realtime never reports a status', async () => {
  let status!: (value: boolean) => void;
  const onChange = jest.fn();
  const controller = createGameSession({
    sessionId: 'session',
    request: async () => snapshot(),
    subscribe: (_t, _h, s) => {
      status = s;
      return jest.fn();
    },
    onChange,
    uuid: () => 'action',
  });
  controller.start();
  await flush();
  jest.advanceTimersByTime(2000);
  await flush();
  expect(
    onChange.mock.calls.some(
      ([state]) =>
        state.error ===
        'Chưa nối được phòng online. Hãy kiểm tra kết nối rồi thử lại.',
    ),
  ).toBe(false);
  expect(onChange.mock.calls.at(-1)?.[0].error).toBeNull();
  expect(onChange.mock.calls.at(-1)?.[0].connected).toBe(true);
  expect(onChange.mock.calls.at(-1)?.[0].snapshot?.room?.version).toBe(1);
  status(true);
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0].error).toBeNull();
  expect(onChange.mock.calls.at(-1)?.[0].snapshot?.room?.version).toBe(1);
  controller.stop();
});

it('shows a connection error when the polling fallback cannot read the room', async () => {
  const onChange = jest.fn();
  const controller = createGameSession({
    sessionId: 'session',
    request: async (input) => {
      if (input.type === 'sync') throw new Error('Mất kết nối');
      return snapshot();
    },
    subscribe: () => jest.fn(),
    onChange,
    uuid: () => 'action',
  });

  controller.start();
  await flush();
  jest.advanceTimersByTime(2000);
  await flush();

  expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
    connected: true,
    error: 'Mất kết nối',
  });
  controller.stop();
});

it('reads immediately after installing the listener and stops all work when suspended', async () => {
  const calls: string[] = [];
  let status!: (value: boolean) => void;
  const unsubscribe = jest.fn();
  const request = jest.fn(async (input: GameRequest) => {
    calls.push(input.type);
    return snapshot();
  });
  const controller = createGameSession({
    sessionId: 'session',
    request,
    subscribe: (_topic, _hint, onStatus) => {
      status = onStatus;
      calls.push('subscribe');
      return unsubscribe;
    },
    onChange: jest.fn(),
    uuid: () => 'action',
  });
  controller.start();
  await flush();
  expect(calls).toEqual(['bootstrap', 'subscribe', 'sync']);
  status(true);
  await flush();
  expect(calls).toEqual(['bootstrap', 'subscribe', 'sync', 'sync']);
  controller.stop();
  jest.advanceTimersByTime(120000);
  await flush();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(3);
  expect(jest.getTimerCount()).toBe(0);
});

it('falls back to foreground polling when the private realtime channel is unavailable', async () => {
  const calls: string[] = [];
  let status!: (value: boolean) => void;
  const onChange = jest.fn();
  const controller = createGameSession({
    sessionId: 'session',
    request: async (input) => {
      calls.push(input.type);
      return snapshot();
    },
    subscribe: (_topic, _hint, onStatus) => {
      status = onStatus;
      return jest.fn();
    },
    onChange,
    uuid: () => 'action',
  });

  controller.start();
  await flush();
  status(false);
  await flush();

  expect(calls).toEqual(['bootstrap', 'sync']);
  expect(onChange.mock.calls.at(-1)?.[0].connected).toBe(true);
  expect(onChange.mock.calls.at(-1)?.[0].snapshot?.room?.version).toBe(1);

  jest.advanceTimersByTime(999);
  await flush();
  expect(calls).toEqual(['bootstrap', 'sync']);
  jest.advanceTimersByTime(1);
  await flush();
  expect(calls).toEqual(['bootstrap', 'sync', 'sync']);

  controller.stop();
  jest.advanceTimersByTime(30000);
  await flush();
  expect(calls).toEqual(['bootstrap', 'sync', 'sync']);
  expect(jest.getTimerCount()).toBe(0);
});

it('pauses fallback room reads while this device is committing an action', async () => {
  let finishReady!: (value: GameSnapshot) => void;
  const request = jest.fn((input: GameRequest) => {
    if (input.type === 'ready')
      return new Promise<GameSnapshot>((resolve) => {
        finishReady = resolve;
      });
    return Promise.resolve(snapshot());
  });
  const controller = createGameSession({
    sessionId: 'session',
    request,
    subscribe: () => jest.fn(),
    onChange: jest.fn(),
    uuid: () => 'action',
  });

  controller.start();
  await flush();
  const sending = controller.send({ type: 'ready', ready: true });
  await flush();
  expect(request.mock.calls.map(([input]) => input.type)).toEqual([
    'bootstrap',
    'sync',
    'ready',
  ]);

  jest.advanceTimersByTime(1000);
  await flush();
  expect(request.mock.calls.map(([input]) => input.type)).toEqual([
    'bootstrap',
    'sync',
    'ready',
  ]);

  finishReady(snapshot(2));
  await sending;
  jest.advanceTimersByTime(1000);
  await flush();
  expect(request.mock.calls.map(([input]) => input.type)).toEqual([
    'bootstrap',
    'sync',
    'ready',
    'sync',
  ]);
  controller.stop();
});

it('stops fallback polling after realtime reconnects', async () => {
  const calls: string[] = [];
  let status!: (value: boolean) => void;
  const controller = createGameSession({
    sessionId: 'session',
    request: async (input) => {
      calls.push(input.type);
      return snapshot();
    },
    subscribe: (_topic, _hint, onStatus) => {
      status = onStatus;
      return jest.fn();
    },
    onChange: jest.fn(),
    uuid: () => 'action',
  });

  controller.start();
  await flush();
  status(false);
  await flush();
  status(true);
  await flush();
  const callsAfterReconnect = calls.length;

  jest.advanceTimersByTime(6000);
  await flush();
  expect(calls).toHaveLength(callsAfterReconnect);
  controller.stop();
});

it('does not start polling when subscription succeeds synchronously', async () => {
  const request = jest.fn(async () => snapshot());
  const controller = createGameSession({
    sessionId: 'session',
    request,
    subscribe: (_topic, _hint, status) => {
      status(true);
      return jest.fn();
    },
    onChange: jest.fn(),
    uuid: () => 'action',
  });
  controller.start();
  await flush();
  expect(request).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(10000);
  await flush();
  expect(request).toHaveBeenCalledTimes(2);
  controller.stop();
});

it('keeps resumed actions disabled until a fresh read succeeds after a read failure', async () => {
  const onChange = jest.fn();
  let fail = false;
  const request = jest.fn(async (input: GameRequest) => {
    if (input.type === 'sync' && fail) throw new Error('Mất kết nối');
    return snapshot();
  });
  const controller = createGameSession({
    sessionId: 'session',
    request,
    subscribe: () => jest.fn(),
    onChange,
    uuid: () => 'action',
  });
  controller.start();
  await flush();
  fail = true;
  await controller.retry();
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
    snapshot: snapshot(),
    connected: true,
    loading: true,
    error: 'Mất kết nối',
  });
  await controller.send({ type: 'ready', ready: true });
  expect(request.mock.calls.some(([input]) => input.type === 'ready')).toBe(
    false,
  );
  fail = false;
  jest.advanceTimersByTime(1000);
  await flush();
  await controller.send({ type: 'ready', ready: true });
  expect(
    request.mock.calls.filter(([input]) => input.type === 'ready'),
  ).toHaveLength(1);
  controller.stop();
});

it('serializes slow fallback reads and aborts them when stopped', async () => {
  let finish!: (value: GameSnapshot) => void;
  let readSignal!: AbortSignal;
  const request = jest.fn((input: GameRequest, signal: AbortSignal) => {
    if (input.type !== 'sync') return Promise.resolve(snapshot());
    readSignal = signal;
    return new Promise<GameSnapshot>((resolve) => {
      finish = resolve;
    });
  });
  const onChange = jest.fn();
  const controller = createGameSession({
    sessionId: 'session',
    request,
    onChange,
    subscribe: () => jest.fn(),
    uuid: () => 'action',
  });
  controller.start();
  await flush();
  jest.advanceTimersByTime(5000);
  await flush();
  expect(request).toHaveBeenCalledTimes(2);
  controller.stop();
  expect(readSignal.aborted).toBe(true);
  finish(snapshot(2));
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0].snapshot).toBeNull();
  expect(request).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});

it('ignores old channel hints and teardown statuses after topic rotation', async () => {
  const callbacks: {
    hint: () => void;
    status: (connected: boolean) => void;
  }[] = [];
  const rotated = snapshot(2);
  rotated.room!.topic = 'new-topic';
  const request = jest.fn(async (input: GameRequest) =>
    input.type === 'bootstrap' ? snapshot(1) : rotated,
  );
  const unsubscribe = jest.fn();
  const controller = createGameSession({
    sessionId: 'session',
    request,
    onChange: jest.fn(),
    uuid: () => 'action',
    subscribe: (_topic, hint, status) => {
      callbacks.push({ hint, status });
      return () => {
        unsubscribe();
        status(false);
        hint();
      };
    },
  });
  controller.start();
  await flush();
  expect(callbacks).toHaveLength(2);
  expect(request).toHaveBeenCalledTimes(3);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  callbacks[1].status(true);
  await flush();
  const reads = request.mock.calls.length;
  callbacks[0].status(false);
  callbacks[0].hint();
  jest.advanceTimersByTime(5000);
  await flush();
  expect(request).toHaveBeenCalledTimes(reads);
  controller.stop();
  expect(unsubscribe).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});

it('keeps one intent ID across an ambiguous acknowledgement failure', async () => {
  const sent: GameRequest[] = [];
  const request = jest.fn(async (input: GameRequest) => {
    if (input.type === 'ready') {
      sent.push(input);
      if (sent.length === 1) throw new Error('network');
    }
    return snapshot();
  });
  let status!: (value: boolean) => void;
  const onChange = jest.fn();
  const controller = createGameSession({
    sessionId: 'session',
    request,
    subscribe: (_t, _h, s) => {
      status = s;
      return jest.fn();
    },
    onChange,
    uuid: () => 'one-intent',
  });
  controller.start();
  await flush();
  status(true);
  await flush();
  await controller.send({ type: 'ready', ready: true });
  expect(onChange.mock.calls.at(-1)?.[0].pending).toBe(true);
  await controller.retry();
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual(sent[0]);
  expect(sent[0].actionId).toBe('one-intent');
  expect(onChange.mock.calls.at(-1)?.[0].pending).toBe(false);
  controller.stop();
});

it('reconciles a lost play response from a newer room version despite a skewed server clock', async () => {
  let status!: (value: boolean) => void;
  let readyCalls = 0;
  const request = jest.fn(async (input: GameRequest) => {
    if (input.type === 'ready') {
      readyCalls += 1;
      if (readyCalls === 1) throw new Error('network');
      return snapshot(3);
    }
    if (input.type === 'sync') {
      return readyCalls === 0 ? snapshot(1) : { ...snapshot(2), serverTime: 1 };
    }
    return snapshot();
  });
  const onChange = jest.fn();
  const controller = createGameSession({
    sessionId: 'session',
    request,
    subscribe: (_topic, _hint, onStatus) => {
      status = onStatus;
      return jest.fn();
    },
    onChange,
    uuid: () => 'stable-action',
  });
  controller.start();
  await flush();
  status(true);
  await flush();
  await controller.send({ type: 'ready', ready: true });
  await flush();

  expect(onChange.mock.calls.at(-1)?.[0].snapshot?.room?.version).toBe(2);
  expect(onChange.mock.calls.at(-1)?.[0].pending).toBe(false);
  expect(onChange.mock.calls.at(-1)?.[0].error).toBeNull();

  await controller.send({ type: 'ready', ready: true });
  expect(readyCalls).toBe(2);
  controller.stop();
});

it('keeps an ambiguous create pending across unrelated reads and retries its receipt ID', async () => {
  const creates: GameRequest[] = [];
  const request = jest.fn(async (input: GameRequest) => {
    if (input.type === 'bootstrap') return { serverTime: 10, room: null };
    if (input.type === 'create') {
      creates.push(input);
      if (creates.length === 1) throw new Error('network');
      return snapshot(2);
    }
    return snapshot(1);
  });
  const onChange = jest.fn();
  const controller = createGameSession({
    sessionId: 'session',
    request,
    subscribe: () => jest.fn(),
    onChange,
    uuid: () => 'stable-create',
  });
  controller.start();
  await flush();
  await controller.send({
    type: 'create',
    name: 'An',
    game: 'south',
    amountPerCard: 1,
  });
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0].pending).toBe(true);

  await controller.retry();

  expect(creates).toHaveLength(2);
  expect(creates[1]).toEqual(creates[0]);
  expect(creates[0].actionId).toBe('stable-create');
  expect(onChange.mock.calls.at(-1)?.[0].pending).toBe(false);
  controller.stop();
});

it('does not expose an in-flight action as an uncertain action', async () => {
  let status!: (value: boolean) => void;
  let resolveReady!: (value: GameSnapshot) => void;
  const onChange = jest.fn();
  const controller = createGameSession({
    sessionId: 'session',
    request: (input) =>
      input.type === 'ready'
        ? new Promise<GameSnapshot>((resolve) => {
            resolveReady = resolve;
          })
        : Promise.resolve(snapshot()),
    subscribe: (_topic, _hint, onStatus) => {
      status = onStatus;
      return jest.fn();
    },
    onChange,
    uuid: () => 'action',
  });

  controller.start();
  await flush();
  status(true);
  await flush();

  const sending = controller.send({ type: 'ready', ready: true });
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
    busy: true,
    pending: false,
    error: null,
  });

  resolveReady(snapshot(2));
  await sending;
  expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
    busy: false,
    pending: false,
    error: null,
  });
  controller.stop();
});

it('clears an action error when a fresh sync shows the room has closed', async () => {
  let status!: (value: boolean) => void;
  let roomClosed = false;
  const onChange = jest.fn();
  const controller = createGameSession({
    sessionId: 'session',
    request: async (input) => {
      if (input.type === 'ready') {
        roomClosed = true;
        throw Object.assign(
          new Error('Bộ đã chọn chưa chặn được bộ trên bàn.'),
          {
            status: 422,
          },
        );
      }
      return roomClosed
        ? { serverTime: 300, room: null }
        : snapshot(input.type === 'bootstrap' ? 1 : 2);
    },
    subscribe: (_topic, _hint, onStatus) => {
      status = onStatus;
      return jest.fn();
    },
    onChange,
    uuid: () => 'action',
  });

  controller.start();
  await flush();
  status(true);
  await flush();
  await controller.send({ type: 'ready', ready: true });
  await flush();

  expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
    error: null,
    pending: false,
    snapshot: { room: null },
  });
  controller.stop();
});

it('ignores responses from a stopped generation and older room versions', async () => {
  let resolve!: (value: GameSnapshot) => void;
  const request = jest.fn(
    () =>
      new Promise<GameSnapshot>((r) => {
        resolve = r;
      }),
  );
  const subscribe = jest.fn();
  const onChange = jest.fn();
  const controller = createGameSession({
    sessionId: 'session',
    request,
    subscribe,
    onChange,
    uuid: () => 'action',
  });
  controller.start();
  controller.stop();
  resolve(snapshot());
  await flush();
  expect(subscribe).not.toHaveBeenCalled();
  expect(onChange.mock.calls.at(-1)?.[0].snapshot).toBeNull();
});

it('keeps an aborted intent recoverable after foreground resume with the original action ID', async () => {
  let status!: (value: boolean) => void;
  const inputs: GameRequest[] = [];
  const request = jest.fn((input: GameRequest, signal: AbortSignal) => {
    if (input.type === 'ready') {
      inputs.push(input);
      if (inputs.length === 1)
        return new Promise<GameSnapshot>((_, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted'))),
        );
    }
    return Promise.resolve(snapshot());
  });
  const onChange = jest.fn();
  const controller = createGameSession({
    sessionId: 'session',
    request,
    subscribe: (_t, _h, s) => {
      status = s;
      return jest.fn();
    },
    onChange,
    uuid: () => 'stable-intent',
  });
  controller.start();
  await flush();
  status(true);
  await flush();
  const sending = controller.send({ type: 'ready', ready: true });
  controller.stop();
  await sending;
  controller.start();
  await flush();
  status(true);
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0].pending).toBe(true);
  expect(onChange.mock.calls.at(-1)?.[0].error).toBeTruthy();
  await controller.retry();
  expect(inputs[1]).toEqual(inputs[0]);
  expect(onChange.mock.calls.at(-1)?.[0].pending).toBe(false);
  controller.stop();
});

it('fences a delayed action after a removal snapshot and clears pending retry state', async () => {
  let hint!: () => void;
  let finish!: (value: GameSnapshot) => void;
  let removed = false;
  const onChange = jest.fn();
  const removal = {
    room: null,
    serverTime: 1000,
    removal: {
      id: '33333333-3333-4333-8333-333333333333',
      roomId: snapshot().room!.id,
      reason: 'kicked' as const,
    },
  };
  const request = jest.fn(async (input: GameRequest) => {
    if (input.type === 'ready')
      return new Promise<GameSnapshot>((resolve) => {
        finish = resolve;
      });
    return removed ? removal : snapshot();
  });
  const session = createGameSession({
    sessionId: 'session',
    request,
    onChange,
    uuid: () => 'action',
    subscribe: (_topic, onHint, status) => {
      hint = onHint;
      status(true);
      return jest.fn();
    },
  });
  session.start();
  await flush();
  const action = session.send({ type: 'ready', ready: true });
  await flush();
  removed = true;
  hint();
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
    snapshot: removal,
    busy: false,
    pending: false,
  });
  finish(snapshot(999));
  await action;
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0].snapshot).toEqual(removal);
  await session.retry();
  await flush();
  expect(
    request.mock.calls.filter(([input]) => input.type === 'ready'),
  ).toHaveLength(1);
  session.stop();
});
