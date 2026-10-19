import type {
  GameIntent,
  GameRequest,
  GameSnapshot,
} from '../../types/cardGame';

export type GameSessionState = {
  snapshot: GameSnapshot | null;
  loading: boolean;
  connected: boolean;
  busy: boolean;
  pending: boolean;
  error: string | null;
};
type Dependencies = {
  sessionId: string;
  request: (input: GameRequest, signal: AbortSignal) => Promise<GameSnapshot>;
  subscribe: (
    topic: string,
    onHint: () => void,
    onStatus: (connected: boolean) => void,
  ) => () => void;
  onChange: (state: GameSessionState) => void;
  uuid: () => string;
};

// One controller per UID/session. No timers or sockets survive stop().
export function createGameSession(deps: Dependencies) {
  let active = false,
    generation = 0;
  let state: GameSessionState = {
    snapshot: null,
    loading: false,
    connected: false,
    busy: false,
    pending: false,
    error: null,
  };
  let pending: GameRequest | null = null;
  let uncertain = false;
  let topic: string | null = null,
    unsubscribe: (() => void) | null = null;
  let lease: ReturnType<typeof setTimeout> | undefined,
    joinTimeout: ReturnType<typeof setTimeout> | undefined,
    poll: ReturnType<typeof setTimeout> | undefined;
  const requests = new Set<AbortController>();
  let syncing = false,
    queued: 'sync' | 'lease' | null = null;
  let readError = false;
  const emit = (patch: Partial<GameSessionState>) => {
    state = {
      ...state,
      ...patch,
      pending: uncertain && pending !== null,
    };
    deps.onChange(state);
  };
  const call = async (input: GameRequest) => {
    const abort = new AbortController();
    requests.add(abort);
    try {
      return await deps.request(input, abort.signal);
    } finally {
      requests.delete(abort);
    }
  };
  const stopChannel = () => {
    clearTimeout(joinTimeout);
    clearTimeout(poll);
    unsubscribe?.();
    unsubscribe = null;
    topic = null;
  };
  const watchConnection = () => {
    clearTimeout(joinTimeout);
    joinTimeout = setTimeout(() => {
      if (active && !state.connected) {
        readError = true;
        emit({
          loading: false,
          error:
            'Chưa nối được phòng online. Hãy kiểm tra kết nối rồi thử lại.',
        });
        startPolling();
      }
    }, 2000);
  };
  const armLease = () => {
    clearTimeout(lease);
    if (!active || !topic) return;
    lease = setTimeout(() => {
      if (active) {
        void sync('lease');
        armLease();
      }
    }, 20000);
  };
  const startPolling = () => {
    clearTimeout(joinTimeout);
    clearTimeout(poll);
    emit({ connected: true });
    void sync('sync');
    const tick = () => {
      poll = setTimeout(() => {
        if (!active || !topic) return;
        void sync('sync');
        tick();
      }, 3000);
    };
    tick();
  };
  const connect = (next: string) => {
    stopChannel();
    topic = next;
    const current = generation;
    emit({ connected: false });
    watchConnection();
    unsubscribe = deps.subscribe(
      next,
      () => {
        if (active && generation === current) void sync('sync');
      },
      (connected) => {
        if (!active || generation !== current || topic !== next) return;
        emit({ connected });
        if (connected) {
          clearTimeout(joinTimeout);
          clearTimeout(poll);
          void sync('sync');
        } else startPolling();
      },
    );
    armLease();
  };
  const accept = (snapshot: GameSnapshot) => {
    const old = state.snapshot;
    if (
      old &&
      (snapshot.serverTime < old.serverTime ||
        (old.room &&
          snapshot.room?.id === old.room.id &&
          snapshot.room.version < old.room.version))
    )
      return;
    const roomChanged =
      !!old?.room &&
      (!snapshot.room ||
        snapshot.room.id !== old.room.id ||
        snapshot.room.matchId !== old.room.matchId);
    emit({
      snapshot,
      loading: false,
      ...(roomChanged ? { error: null } : null),
    });
    if (snapshot.room) {
      if (snapshot.room.topic !== topic) connect(snapshot.room.topic);
    } else {
      stopChannel();
      clearTimeout(lease);
      emit({ connected: true });
    }
  };
  const sync = async (type: 'sync' | 'lease') => {
    if (!active) return;
    if (type === 'sync' && !state.connected) return;
    if (syncing) {
      if (queued !== 'lease') queued = type;
      return;
    }
    syncing = true;
    const current = generation;
    try {
      const snapshot = await call({ type, sessionId: deps.sessionId });
      if (active && current === generation) {
        if (type === 'lease' && !state.connected && snapshot.room) {
          if (snapshot.room.topic !== topic) connect(snapshot.room.topic);
        } else {
          accept(snapshot);
          if (readError) {
            readError = false;
            emit({ error: null });
          }
        }
      }
    } catch (error) {
      if (active && current === generation) {
        readError = true;
        emit({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Chưa cập nhật được bàn chơi.',
        });
      }
    } finally {
      if (active && current === generation) {
        syncing = false;
        const next = queued;
        queued = null;
        if (next) void sync(next);
      }
    }
  };
  const execute = async (input: GameRequest) => {
    if (!active || state.busy) return;
    const current = generation;
    pending = input;
    uncertain = false;
    emit({ busy: true, error: null });
    try {
      const snapshot = await call(input);
      if (active && current === generation) {
        pending = null;
        uncertain = false;
        accept(snapshot);
        emit({ error: null });
      }
    } catch (error) {
      if (active && current === generation) {
        readError = false;
        const status =
          error && typeof error === 'object' && 'status' in error
            ? error.status
            : null;
        if (typeof status === 'number' && status >= 400 && status < 500)
          pending = null;
        uncertain = pending !== null;
        emit({
          error:
            error instanceof Error
              ? error.message
              : 'Chưa xác nhận được thao tác.',
        });
        void sync('sync');
      }
    } finally {
      if (active && current === generation) emit({ busy: false });
    }
  };
  const stop = () => {
    active = false;
    generation++;
    uncertain = pending !== null;
    clearTimeout(lease);
    clearTimeout(joinTimeout);
    clearTimeout(poll);
    stopChannel();
    for (const request of requests) request.abort();
    requests.clear();
    syncing = false;
    queued = null;
    emit({
      snapshot: null,
      loading: false,
      connected: false,
      busy: false,
      error: null,
    });
  };
  return {
    start() {
      if (active) return;
      active = true;
      const current = ++generation;
      readError = false;
      emit({
        loading: true,
        error: uncertain
          ? 'Thao tác trước chưa được xác nhận. Hãy kiểm tra lại để tiếp tục.'
          : null,
      });
      void call({ type: 'bootstrap', sessionId: deps.sessionId })
        .then((snapshot) => {
          if (!active || generation !== current) return;
          // Bootstrap is metadata for channel setup. Confirm the listener before
          // publishing a fresh snapshot, closing the foreground race.
          if (snapshot.room) connect(snapshot.room.topic);
          else accept(snapshot);
        })
        .catch((error) => {
          if (active && generation === current)
            emit({
              loading: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Chưa mở được phòng online.',
            });
        });
    },
    stop,
    async send(intent: GameIntent) {
      if (!active || state.busy || pending || !state.connected) return;
      const room = state.snapshot?.room;
      const input: GameRequest = { ...intent, sessionId: deps.sessionId };
      if (!['create', 'join'].includes(intent.type)) {
        if (!room) return;
        input.roomId = room.id;
      }
      if (intent.type !== 'takeover') input.actionId = deps.uuid();
      if (!['create', 'join', 'takeover'].includes(intent.type)) {
        if (!room) return;
        input.expectedVersion = room.version;
        input.matchId = room.matchId;
      }
      await execute(input);
    },
    async retry() {
      if (pending) await execute(pending);
      else {
        stop();
        this.start();
      }
    },
  };
}
