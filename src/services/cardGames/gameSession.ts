import type {
  GameIntent,
  GameRequest,
  GameSnapshot,
  VariantGameConfig,
} from '../../types/cardGame';

const requiresVariantV11 = (config?: VariantGameConfig) =>
  !!config &&
  'rulesVersion' in config &&
  (config.rulesVersion === 'north-v2' || config.rulesVersion === 'sam-v2');

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
  let realtimeConnected = false;
  let lease: ReturnType<typeof setTimeout> | undefined,
    poll: ReturnType<typeof setTimeout> | undefined;
  const requests = new Set<AbortController>();
  let syncing = false,
    queued: 'sync' | 'lease' | null = null;
  let readError = false;
  let refreshConflict: GameRequest | null = null;
  let lastRemovalId: string | null = null;
  let optionsKnown = false;
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
      const room = state.snapshot?.room;
      const needsOptions =
        optionsKnown ||
        room?.phomConfig?.options ||
        room?.nextPhomConfig?.options;
      // Keep the pending request's identity so its negotiated HTTP protocol
      // survives retries. This local fence is stripped by gameRequest.
      if (['north', 'sam', 'tan'].includes(room?.gameKind ?? ''))
        input.requiredClientVersion =
          requiresVariantV11(room?.variantConfig) ||
          requiresVariantV11(room?.nextVariantConfig)
            ? 11
            : 10;
      else if (needsOptions) input.requiredClientVersion = 7;
      const snapshot = await deps.request(input, abort.signal);
      optionsKnown = !!(
        snapshot.room?.phomConfig?.options ||
        snapshot.room?.nextPhomConfig?.options
      );
      return snapshot;
    } finally {
      requests.delete(abort);
    }
  };
  const stopPolling = () => {
    clearTimeout(poll);
    poll = undefined;
  };
  const stopChannel = () => {
    const previous = unsubscribe;
    unsubscribe = null;
    topic = null;
    realtimeConnected = false;
    stopPolling();
    previous?.();
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
    if (!active || !topic || realtimeConnected || poll !== undefined) return;
    emit({ connected: true });
    void sync('sync');
    const tick = () => {
      poll = setTimeout(() => {
        poll = undefined;
        if (!active || !topic || realtimeConnected) return;
        // Avoid locking the same room row with a background read while this
        // device is waiting for its own write to commit.
        if (!state.busy) void sync('sync');
        tick();
      }, 1000);
    };
    tick();
  };
  const connect = (next: string) => {
    stopChannel();
    topic = next;
    const current = generation;
    emit({ connected: false });
    unsubscribe = deps.subscribe(
      next,
      () => {
        if (active && generation === current && topic === next)
          void sync('sync');
      },
      (connected) => {
        if (!active || generation !== current || topic !== next) return;
        realtimeConnected = connected;
        if (connected) {
          stopPolling();
          emit({ connected: true });
          void sync('sync');
        } else startPolling();
      },
    );
    // Install the listener first, then read through the authorized HTTP path.
    // Loading still fences actions until that fresh snapshot arrives; a slow
    // Realtime handshake must not hold the room behind a separate timeout.
    if (!realtimeConnected) startPolling();
    armLease();
  };
  const accept = (snapshot: GameSnapshot) => {
    const old = state.snapshot;
    const sameRoom = !!old?.room && snapshot.room?.id === old.room.id;
    if (old && sameRoom) {
      if (snapshot.room!.version < old.room!.version) return false;
      if (
        snapshot.room!.version === old.room!.version &&
        snapshot.serverTime < old.serverTime
      )
        return false;
    }
    if (old && !sameRoom && snapshot.serverTime < old.serverTime) return false;
    if (
      snapshot.removal &&
      old?.room &&
      (snapshot.removal.roomId !== old.room.id ||
        snapshot.removal.id === lastRemovalId)
    )
      return false;
    if (snapshot.removal) {
      lastRemovalId = snapshot.removal.id;
      // Removal is authoritative. Fence late writes/reads before clearing the
      // room so an old ready/play response cannot put the kicked player back.
      generation++;
      for (const request of requests) request.abort();
      requests.clear();
      pending = null;
      uncertain = false;
      refreshConflict = null;
      syncing = false;
      queued = null;
      stopChannel();
      clearTimeout(lease);
      emit({
        snapshot,
        loading: false,
        busy: false,
        connected: true,
        error: null,
      });
      return true;
    }
    const pendingRoomId = pending?.roomId ?? old?.room?.id;
    const pendingResolved =
      (pending?.type === 'leave' && snapshot.room === null) ||
      (pending?.expectedVersion !== undefined &&
        !!snapshot.room &&
        snapshot.room.id === pendingRoomId &&
        (snapshot.room.version > pending.expectedVersion ||
          snapshot.room.matchId !== pending.matchId));
    if (pendingResolved) {
      pending = null;
      uncertain = false;
    }
    const roomChanged =
      !!old?.room &&
      (!snapshot.room ||
        snapshot.room.id !== old.room.id ||
        snapshot.room.matchId !== old.room.matchId);
    emit({
      snapshot,
      loading: false,
      ...(roomChanged || pendingResolved ? { error: null } : null),
    });
    if (snapshot.room) {
      if (snapshot.room.topic !== topic) connect(snapshot.room.topic);
    } else {
      stopChannel();
      clearTimeout(lease);
      emit({ connected: true });
    }
    return true;
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
    const conflict = refreshConflict;
    try {
      const snapshot = await call({ type, sessionId: deps.sessionId });
      if (active && current === generation) {
        if (type === 'lease' && !state.connected && snapshot.room) {
          if (snapshot.room.topic !== topic) connect(snapshot.room.topic);
        } else {
          const accepted = accept(snapshot);
          if (
            accepted &&
            (readError || (conflict && refreshConflict === conflict))
          ) {
            readError = false;
            refreshConflict = null;
            emit({ error: null });
          }
        }
      }
    } catch (error) {
      if (active && current === generation) {
        readError = true;
        emit({
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
    if (!active || state.busy) return false;
    const current = generation;
    pending = input;
    refreshConflict = null;
    uncertain = false;
    emit({ busy: true, error: null });
    try {
      const snapshot = await call(input);
      if (active && current === generation) {
        pending = null;
        uncertain = false;
        const accepted = accept(snapshot);
        emit({ error: null });
        return accepted && (input.type !== 'leave' || snapshot.room === null);
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
        const code =
          error && typeof error === 'object' && 'code' in error
            ? error.code
            : null;
        refreshConflict =
          input.expectedVersion !== undefined &&
          typeof code === 'string' &&
          ['version-conflict', 'match-conflict', 'turn-expired'].includes(code)
            ? input
            : null;
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
    return false;
  };
  const stop = (clearSnapshot = true) => {
    active = false;
    generation++;
    uncertain = pending !== null;
    clearTimeout(lease);
    stopChannel();
    for (const request of requests) request.abort();
    requests.clear();
    syncing = false;
    queued = null;
    refreshConflict = null;
    emit({
      ...(clearSnapshot ? { snapshot: null } : null),
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
          // Bootstrap is metadata for channel setup. Install the listener before
          // publishing a fresh authorized snapshot, closing the foreground race.
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
    stop: () => stop(),
    async send(intent: GameIntent) {
      if (!active || state.loading || state.busy || pending || !state.connected)
        return false;
      const room = state.snapshot?.room;
      const input: GameRequest = { ...intent, sessionId: deps.sessionId };
      if (!['create', 'join'].includes(intent.type)) {
        if (!room) return false;
        input.roomId = room.id;
        if (['north', 'sam', 'tan'].includes(room.gameKind ?? ''))
          input.requiredClientVersion =
            requiresVariantV11(room.variantConfig) ||
            requiresVariantV11(room.nextVariantConfig) ||
            (intent.type === 'set-variant-rules' &&
              requiresVariantV11(intent.variantConfig))
              ? 11
              : 10;
        else if (
          room.phomConfig?.options ||
          room.nextPhomConfig?.options ||
          (intent.type === 'set-phom-rules' && intent.phomConfig.options)
        )
          input.requiredClientVersion = 7;
        else if (room.nextPhomConfig || intent.type === 'set-phom-rules')
          input.requiredClientVersion = 6;
        else if (room.nextSouthRules || intent.type === 'set-south-rules')
          input.requiredClientVersion = 5;
        else if (room.southConfig) input.requiredClientVersion = 4;
      }
      if (
        intent.type === 'join' &&
        ['north', 'sam', 'tan'].includes(intent.game ?? '')
      )
        input.requiredClientVersion = intent.game === 'tan' ? 10 : 11;
      if (intent.type !== 'takeover') input.actionId = deps.uuid();
      if (!['create', 'join', 'takeover'].includes(intent.type)) {
        if (!room) return false;
        input.expectedVersion = room.version;
        input.matchId = room.matchId;
      }
      return execute(input);
    },
    async retry() {
      if (!active || state.busy) return;
      if (pending) await execute(pending);
      else {
        // A reconnect is transport recovery, not a room exit. Keep the last
        // snapshot disabled until a fresh authorized read confirms membership.
        stop(false);
        this.start();
      }
    },
  };
}
