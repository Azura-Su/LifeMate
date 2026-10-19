import { createGameSession } from '../gameSession';
import type { GameRequest, GameSnapshot } from '../../../types/cardGame';

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
  expect(onChange.mock.calls.at(-1)?.[0].error).toBeNull();
  expect(onChange.mock.calls.at(-1)?.[0].connected).toBe(true);
  expect(onChange.mock.calls.at(-1)?.[0].snapshot?.room?.version).toBe(1);
  status(true);
  await flush();
  expect(onChange.mock.calls.at(-1)?.[0].error).toBeNull();
  expect(onChange.mock.calls.at(-1)?.[0].snapshot?.room?.version).toBe(1);
  controller.stop();
});

it('waits for subscription confirmation before syncing and stops all work when suspended', async () => {
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
  expect(calls).toEqual(['bootstrap', 'subscribe']);
  status(true);
  await flush();
  expect(calls).toEqual(['bootstrap', 'subscribe', 'sync']);
  controller.stop();
  jest.advanceTimersByTime(120000);
  await flush();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(2);
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

  jest.advanceTimersByTime(3000);
  await flush();
  expect(calls).toEqual(['bootstrap', 'sync', 'sync']);

  controller.stop();
  jest.advanceTimersByTime(30000);
  await flush();
  expect(calls).toEqual(['bootstrap', 'sync', 'sync']);
  expect(jest.getTimerCount()).toBe(0);
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
