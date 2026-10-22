import { applyTestScoreDocument } from '../../../testing/sharedScorePatch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useSharedCardScores } from '../useSharedCardScores';
import { useAuthStore } from '../../../store/authStore';
import { gameRequest } from '../../../services/cardGames/gameApi';
import { readCardScoreMatches } from '../../../services/cardScore/cardScoreStorage';
import type { SharedCardScore } from '../../../types/cardScore';

jest.mock('../../../services/cardGames/gameApi', () => ({
  gameRequest: jest.fn(),
}));
jest.mock('../../../services/cardGames/gameDeviceSession', () => ({
  getGameDeviceSessionId: jest
    .fn()
    .mockResolvedValue('11111111-1111-4111-8111-111111111111'),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
const uid = 'score-hook-user';
const board = (): SharedCardScore => ({
  canEdit: true,
  match: {
    id: 'score-1',
    title: 'Bàn chung',
    players: [
      { id: uid, name: 'An' },
      { id: 'friend', name: 'Bình' },
    ],
    seatOrder: [uid, 'friend'],
    dealerPlayerId: uid,
    rounds: [],
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    onlineRoomId: 'room-1',
    onlineRoomCode: 'ABCDEFGH',
    sharedVersion: 1,
  },
});
let appListener: (state: AppStateStatus) => void;
beforeEach(async () => {
  await AsyncStorage.clear();
  useAuthStore.getState().setUser({ uid, email: 'test@example.com' } as never);
  jest.mocked(gameRequest).mockReset();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      appListener = callback;
      return { remove: jest.fn() };
    });
});
afterEach(() => jest.restoreAllMocks());
function setup() {
  const listeners: Record<string, () => void> = {};
  const navigation = {
    addListener: jest.fn((event: string, callback: () => void) => {
      listeners[event] = callback;
      return jest.fn();
    }),
    isFocused: () => true,
  };
  const onMatches = jest.fn();
  const epoch = useAuthStore.getState().sessionEpoch;
  const hook = renderHook(() =>
    useSharedCardScores(uid, epoch, 0, navigation, onMatches),
  );
  return { ...hook, onMatches, listeners };
}
it('awaits an existing score read when refresh is pulled during synchronization', async () => {
  let resolveList!: (value: unknown) => void;
  jest.mocked(gameRequest).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveList = resolve;
      }) as never,
  );
  const hook = setup();
  await waitFor(() => expect(resolveList).toBeDefined());
  let completed = false;
  let refresh!: Promise<void>;
  act(() => {
    refresh = Promise.resolve(hook.result.current.retry()).then(() => {
      completed = true;
    });
    void hook.result.current.retry();
  });
  await act(async () => {});
  expect(completed).toBe(false);
  expect(gameRequest).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveList({ tables: [board()] });
    await refresh;
  });
  expect(completed).toBe(true);
  expect(hook.result.current.canEdit(board().match)).toBe(true);
});
it('discards a delayed pre-mutation list and retains the new score revision', async () => {
  let current = board();
  let resolveOld!: (value: unknown) => void;
  let reads = 0;
  jest.mocked(gameRequest).mockImplementation(async (_uid, input) => {
    if (input.type === 'score-list') {
      reads++;
      if (reads === 2)
        return (await new Promise<unknown>((resolve) => {
          resolveOld = resolve;
        })) as never;
      return { tables: [current] } as never;
    }
    current = {
      canEdit: true,
      match: {
        ...applyTestScoreDocument(current.match, input.document),
        sharedVersion: 2,
      },
    };
    return current as never;
  });
  const hook = setup();
  await waitFor(() =>
    expect(hook.result.current.canEdit(current.match)).toBe(true),
  );
  act(() => {
    void hook.result.current.retry();
  });
  await waitFor(() => expect(resolveOld).toBeDefined());
  await act(async () => {
    await hook.result.current.mutate(
      { ...current.match, title: 'Đã sửa' },
      'save',
      current.match,
    );
  });
  await act(async () => {
    resolveOld({ tables: [board()] });
  });
  await waitFor(() =>
    expect(hook.onMatches.mock.calls.at(-1)?.[0][0]).toMatchObject({
      title: 'Đã sửa',
      sharedVersion: 2,
    }),
  );
  expect((await readCardScoreMatches(uid))[0]).toMatchObject({
    title: 'Đã sửa',
    sharedVersion: 2,
  });
});
it('fails closed offline, on blur and across auth epochs while keeping cached scores readable', async () => {
  const current = board();
  jest.mocked(gameRequest).mockResolvedValue({ tables: [current] } as never);
  const hook = setup();
  await waitFor(() =>
    expect(hook.result.current.canEdit(current.match)).toBe(true),
  );
  jest.mocked(gameRequest).mockRejectedValue(new Error('offline'));
  act(() => {
    void hook.result.current.retry();
  });
  await waitFor(() =>
    expect(hook.result.current.canEdit(current.match)).toBe(false),
  );
  expect((await readCardScoreMatches(uid))[0].id).toBe(current.match.id);
  await expect(
    hook.result.current.mutate(current.match, 'delete'),
  ).rejects.toThrow('Chỉ chủ phòng');
  jest.mocked(gameRequest).mockResolvedValue({ tables: [current] } as never);
  act(() => {
    void hook.result.current.retry();
  });
  await waitFor(() =>
    expect(hook.result.current.canEdit(current.match)).toBe(true),
  );
  act(() => hook.listeners.blur());
  expect(hook.result.current.canEdit(current.match)).toBe(false);
  act(() => hook.listeners.focus());
  await waitFor(() =>
    expect(hook.result.current.canEdit(current.match)).toBe(true),
  );
  act(() => {
    useAuthStore.getState().setUser(null);
    useAuthStore
      .getState()
      .setUser({ uid, email: 'test@example.com' } as never);
  });
  expect(hook.result.current.canEdit(current.match)).toBe(false);
});
it('pauses access in the background and refreshes on foreground', async () => {
  const current = board();
  jest.mocked(gameRequest).mockResolvedValue({ tables: [current] } as never);
  const hook = setup();
  await waitFor(() =>
    expect(hook.result.current.canEdit(current.match)).toBe(true),
  );
  act(() => appListener('background'));
  expect(hook.result.current.canEdit(current.match)).toBe(false);
  act(() => appListener('active'));
  await waitFor(() =>
    expect(hook.result.current.canEdit(current.match)).toBe(true),
  );
});
it('removes revoked shared cache on authoritative list without deleting manual or legacy tables', async () => {
  const current = board();
  jest.mocked(gameRequest).mockResolvedValue({ tables: [current] } as never);
  const hook = setup();
  await waitFor(() =>
    expect(hook.result.current.canEdit(current.match)).toBe(true),
  );
  jest.mocked(gameRequest).mockResolvedValue({ tables: [] } as never);
  act(() => {
    void hook.result.current.retry();
  });
  await waitFor(() =>
    expect(hook.onMatches.mock.calls.at(-1)?.[0]).toEqual([]),
  );
  expect(await readCardScoreMatches(uid)).toEqual([]);
});

it('sends a bounded patch for a large board and refuses saves without the editor base', async () => {
  let current = board();
  current.match.rounds = Array.from({ length: 2101 }, (_, index) => ({
    id: `round-${index}`,
    createdAt: index + 1,
    scores: { [uid]: 1, friend: -1 },
  }));
  jest.mocked(gameRequest).mockImplementation(async (_uid, input) => {
    if (input.type === 'score-list') return { tables: [current] } as never;
    current = {
      canEdit: true,
      match: {
        ...applyTestScoreDocument(current.match, input.document),
        sharedVersion: 2,
      },
    };
    return current as never;
  });
  const hook = setup();
  await waitFor(() =>
    expect(hook.result.current.canEdit(current.match)).toBe(true),
  );
  await expect(hook.result.current.mutate(current.match)).rejects.toThrow(
    'Thiếu bản gốc',
  );
  expect(gameRequest).toHaveBeenCalledTimes(1);
  await act(async () => {
    await hook.result.current.mutate(
      { ...current.match, title: 'Tên mới' },
      'save',
      current.match,
    );
  });
  const write = jest
    .mocked(gameRequest)
    .mock.calls.find(([, input]) => input.type === 'score-write')![1];
  expect(write).toMatchObject({
    operation: 'patch',
    expectedVersion: 1,
    document: { upsertRounds: [], deleteRoundIds: [] },
  });
  expect(JSON.stringify(write).length).toBeLessThan(1000);
  expect((await readCardScoreMatches(uid))[0]).toMatchObject({
    title: 'Tên mới',
    sharedVersion: 2,
  });
});

it('does not contact online services when online games are disabled', async () => {
  const navigation = { addListener: jest.fn(() => jest.fn()) };
  const onMatches = jest.fn();
  const epoch = useAuthStore.getState().sessionEpoch;
  const hook = renderHook(() =>
    useSharedCardScores(uid, epoch, 0, navigation, onMatches, false),
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(gameRequest).not.toHaveBeenCalled();
  expect(hook.result.current.canEdit(board().match)).toBe(false);
  expect(hook.result.current.error).toBeNull();
});

it('allows resumed local score edits offline without granting canonical shared access', async () => {
  jest.mocked(gameRequest).mockRejectedValue(new Error('offline'));
  const hook = setup();
  await waitFor(() => expect(hook.result.current.error).toBe('offline'));
  const canonical = { ...board().match, localScoreEditable: true };
  const legacy = { ...canonical, sharedVersion: undefined };
  expect(hook.result.current.canEdit(canonical)).toBe(false);
  expect(
    hook.result.current.canEdit({ ...legacy, localScoreEditable: false }),
  ).toBe(false);
  expect(hook.result.current.canEdit(legacy)).toBe(true);
  await expect(hook.result.current.mutate(canonical)).rejects.toThrow(
    'Chỉ chủ phòng',
  );
});
