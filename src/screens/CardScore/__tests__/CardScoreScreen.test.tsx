import { applyTestScoreDocument } from '../../../testing/sharedScorePatch';
import * as cardStorage from '../../../services/cardScore/cardScoreStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import {
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { CardScoreRoundDialog } from '../CardScoreRoundDialog';
import { CardScoreScreen } from '../CardScoreScreen';
import { CardScoreSetupDialog } from '../CardScoreSetupDialog';
import { useAuthStore } from '../../../store/authStore';
import { useConfigStore } from '../../../store/configStore';
import { readCardScoreMatches } from '../../../services/cardScore/cardScoreStorage';
import { colors, layout } from '../../../theme';
import type { CardScoreMatch, SharedCardScore } from '../../../types/cardScore';
import type { GameRequest, GameRoomStatus } from '../../../types/cardGame';
import { gameRequest } from '../../../services/cardGames/gameApi';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('../../../services/firebase/remoteConfigService', () => ({}));
jest.mock('../../../config/cardGames', () => ({
  cardGamesEnabled: () => true,
}));
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

const uid = 'card-score-screen-test';

beforeEach(async () => {
  useConfigStore.setState({ gameUsers: ['player@example.com'] });
  jest
    .mocked(gameRequest)
    .mockReset()
    .mockImplementation(async (_uid, input) => {
      if (input.type === 'score-list') return { tables: [] } as never;
      throw new Error('offline');
    });
  await AsyncStorage.clear();
  useAuthStore.getState().setUser({
    uid,
    email: 'player@example.com',
    displayName: 'Player',
  } as never);
});

function renderScreen() {
  return render(
    <CardScoreScreen
      navigation={
        { navigate: jest.fn(), addListener: () => jest.fn() } as never
      }
      route={{} as never}
    />,
  );
}

async function exposeSharedBoard(canEdit = true) {
  const [legacy] = await readCardScoreMatches(uid);
  let board: SharedCardScore = {
    match: { ...legacy, sharedVersion: 1 },
    canEdit,
  };
  await cardStorage.cacheSharedCardScoreMatches(uid, [board.match]);
  jest
    .mocked(gameRequest)
    .mockImplementation(async (_uid, input: GameRequest) => {
      if (input.type === 'score-list') return { tables: [board] } as never;
      if (input.type === 'score-history')
        return { events: [], nextBefore: null } as never;
      if (input.type === 'score-write') {
        if (!board.canEdit)
          throw new Error(
            'Chỉ chủ phòng hiện tại mới có thể thực hiện thao tác này.',
          );
        if (input.expectedVersion !== board.match.sharedVersion)
          throw new Error(
            'Bảng điểm vừa thay đổi. Đóng và mở lại hộp sửa để cập nhật.',
          );
        const old = board.match;
        if (old.deletedAt) throw new Error('Bảng điểm đã xóa.');
        const match: CardScoreMatch = {
          ...applyTestScoreDocument(old, input.document),
          sharedVersion: old.sharedVersion! + 1,
        };
        if (input.operation === 'delete') match.deletedAt = Date.now();
        if (input.document)
          match.ignoredOnlineRoundIds = [
            ...(old.ignoredOnlineRoundIds ?? []),
            ...old.rounds
              .filter(
                (round) => !match.rounds.some((next) => next.id === round.id),
              )
              .map((round) => round.id),
          ];
        board = { match, canEdit: board.canEdit };
        return board as never;
      }
      throw new Error('offline');
    });
  return {
    get: () => board,
    set: (next: SharedCardScore) => {
      board = next;
    },
  };
}

it('keeps the shared hub visible while selecting the online tab', async () => {
  const navigate = jest.fn();
  render(
    <CardScoreScreen
      navigation={{ navigate, addListener: () => jest.fn() } as never}
      route={{} as never}
    />,
  );

  expect(await screen.findByText('Sẵn sàng ghi điểm?')).toBeTruthy();
  expect(screen.getByText('Tính điểm')).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Tính điểm' })).toBeTruthy();
  expect(
    screen.getByRole('tab', { name: 'Tính điểm' }).props.accessibilityState,
  ).toMatchObject({ selected: true });
  fireEvent.press(screen.getByRole('tab', { name: 'Chơi online' }));
  expect(navigate).toHaveBeenCalledWith('CardGames');
});

it('hides online mode for an unlisted account and updates when usergame changes', async () => {
  useConfigStore.setState({ gameUsers: [] });
  renderScreen();
  expect(await screen.findByRole('tab', { name: 'Tính điểm' })).toBeTruthy();
  expect(screen.queryByRole('tab', { name: 'Chơi online' })).toBeNull();
  act(() => useConfigStore.setState({ gameUsers: [' PLAYER@EXAMPLE.COM '] }));
  expect(screen.getByRole('tab', { name: 'Chơi online' })).toBeTruthy();
  act(() => useConfigStore.setState({ gameUsers: ['other@example.com'] }));
  expect(screen.queryByRole('tab', { name: 'Chơi online' })).toBeNull();
});

it('keeps score mode tabs outside the scrollable body', async () => {
  renderScreen();
  await screen.findByText('Sẵn sàng ghi điểm?');
  expect(
    within(screen.getByTestId('screen-fixed-content')).getByRole('tab', {
      name: 'Tính điểm',
    }),
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('screen-scroll-area')).queryByRole('tablist'),
  ).toBeNull();
});

async function seedManualBoard(title: string) {
  return cardStorage.createCardScoreMatch(uid, {
    title,
    players: [
      { id: 'p1', name: 'An' },
      { id: 'p2', name: 'Bình' },
    ],
    seatOrder: ['p1', 'p2'],
    dealerPlayerId: 'p1',
  });
}

it('pulls fresh scores without blanking content, resetting the selected table or duplicating reads', async () => {
  const first = await seedManualBoard('Bàn An');
  await seedManualBoard('Bàn Bình');
  renderScreen();
  fireEvent.press(await screen.findByRole('button', { name: 'Mở bàn Bàn An' }));
  await act(async () => {});
  let resolveList!: (value: unknown) => void;
  jest.mocked(gameRequest).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveList = resolve;
      }) as never,
  );
  const callsBefore = jest.mocked(gameRequest).mock.calls.length;
  fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
  await waitFor(() => expect(resolveList).toBeDefined());
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);
  expect(screen.queryByLabelText('Đang tải bảng điểm')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Mở bàn Bàn An' }).props
      .accessibilityState.selected,
  ).toBe(true);
  fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
  expect(jest.mocked(gameRequest).mock.calls).toHaveLength(callsBefore + 1);
  await cardStorage.updateCardScoreMatch(uid, {
    ...first,
    title: 'Bàn An mới',
  });
  await act(async () => {
    resolveList({ tables: [] });
  });
  await waitFor(() =>
    expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
      false,
    ),
  );
  expect(
    screen.getByRole('button', { name: 'Mở bàn Bàn An mới' }).props
      .accessibilityState.selected,
  ).toBe(true);
  expect(
    within(screen.getByTestId('card-score-open-table')).getByText('Bàn An mới'),
  ).toBeTruthy();
});

it('pulls authoritative shared deletions out of the local score view', async () => {
  await seedOnlineScore();
  const shared = await exposeSharedBoard();
  renderScreen();
  await screen.findByRole('button', { name: 'Thêm ván' });
  expect(screen.getByText(shared.get().match.title)).toBeTruthy();
  jest.mocked(gameRequest).mockResolvedValue({ tables: [] } as never);
  fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
  await screen.findByText('Sẵn sàng ghi điểm?');
  expect(await readCardScoreMatches(uid)).toEqual([]);
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
});

it('stops pull loading on network failure and keeps cached shared scores readable', async () => {
  await seedOnlineScore();
  await exposeSharedBoard();
  renderScreen();
  await screen.findByRole('button', { name: 'Thêm ván' });
  jest.mocked(gameRequest).mockRejectedValue(new Error('Mạng đang lỗi'));
  fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
  await screen.findByText(/Mạng đang lỗi/);
  await waitFor(() =>
    expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
      false,
    ),
  );
  expect(screen.getByTestId('card-score-table-grid')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Thêm ván' })).toBeNull();
});

it('recovers from an initial local read failure through pull refresh', async () => {
  const read = jest
    .spyOn(cardStorage, 'readCardScoreMatches')
    .mockRejectedValueOnce(new Error('Chưa đọc được dữ liệu'));
  try {
    renderScreen();
    await screen.findByText('Chưa mở được bảng điểm');
    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
    await screen.findByText('Sẵn sàng ghi điểm?');
    expect(screen.queryByText('Chưa đọc được dữ liệu')).toBeNull();
    expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
      false,
    );
  } finally {
    read.mockRestore();
  }
});

it.each(['blur', 'account'])(
  'discards a delayed local pull read after %s',
  async (event) => {
    const match = await seedManualBoard('Bàn hiện tại');
    const listeners: Record<string, (() => void)[]> = {};
    render(
      <CardScoreScreen
        navigation={
          {
            navigate: jest.fn(),
            addListener: (name: string, callback: () => void) => {
              (listeners[name] ??= []).push(callback);
              return jest.fn();
            },
          } as never
        }
        route={{} as never}
      />,
    );
    await screen.findByText('Bàn hiện tại');
    await act(async () => {});
    let resolveRead!: (value: CardScoreMatch[]) => void;
    const read = jest
      .spyOn(cardStorage, 'readCardScoreMatches')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRead = resolve;
          }),
      );
    try {
      fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
      await waitFor(() => expect(resolveRead).toBeDefined());
      act(() => {
        if (event === 'blur') listeners.blur.forEach((callback) => callback());
        else
          useAuthStore.getState().setUser({
            uid: 'another-score-user',
            email: 'another@example.com',
          } as never);
      });
      await act(async () => {
        resolveRead([{ ...match, title: 'Dữ liệu đến muộn' }]);
      });
      expect(screen.queryByText('Dữ liệu đến muộn')).toBeNull();
      expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
        false,
      );
    } finally {
      read.mockRestore();
    }
  },
);

it('ignores a native delete confirmation from a previous account session', async () => {
  const match = await cardStorage.createCardScoreMatch(uid, {
    title: 'Bàn cũ',
    players: [
      { id: 'p1', name: 'An' },
      { id: 'p2', name: 'Bình' },
    ],
    seatOrder: ['p1', 'p2'],
    dealerPlayerId: 'p1',
  });
  const finished = await cardStorage.updateCardScoreMatch(uid, {
    ...match,
    status: 'finished',
  });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const view = renderScreen();
  fireEvent.press(
    await screen.findByRole('button', { name: /Xóa lịch sử bàn/ }),
  );
  const confirm = alert.mock.calls[0][2]?.find(
    (action) => action.text === 'Xóa bàn',
  );
  view.unmount();
  useAuthStore.getState().setUser({
    uid: 'other-player',
    email: 'other@example.com',
    displayName: 'Other',
  });
  confirm?.onPress?.();
  expect(await readCardScoreMatches(uid)).toEqual([finished]);
  alert.mockRestore();
});

it('checks an active room only when re-entry is pressed', async () => {
  const navigate = jest.fn();
  await cardStorage.createCardScoreMatch(uid, {
    title: 'Tiến lên miền Nam · ABCDEFGH',
    players: [
      { id: uid, name: 'An' },
      { id: 'friend', name: 'Bình' },
    ],
    seatOrder: [uid, 'friend'],
    dealerPlayerId: uid,
    onlineRoomId: '00000000-0000-4000-8000-000000000001',
    onlineRoomCode: 'ABCDEFGH',
  });
  await exposeSharedBoard(false);
  const sharedRequests = jest.mocked(gameRequest).getMockImplementation()!;
  jest
    .mocked(gameRequest)
    .mockImplementation(async (account, input, signal) => {
      if (input.type === 'room-status')
        return {
          roomId: input.roomId,
          exists: true,
          owner: false,
          canRejoin: true,
          canReopen: false,
          canDelete: false,
          expired: false,
          phase: 'lobby',
          version: 8,
          matchId: null,
        } as never;
      return sharedRequests(account, input, signal);
    });
  render(
    <CardScoreScreen
      navigation={{ navigate, addListener: () => jest.fn() } as never}
      route={{} as never}
    />,
  );
  const rejoin = await screen.findByRole('button', {
    name: 'Vào lại phòng ABCDEFGH',
  });
  expect(
    jest
      .mocked(gameRequest)
      .mock.calls.some(([, input]) => input.type === 'room-status'),
  ).toBe(false);
  expect(
    screen.queryByRole('button', { name: 'Kiểm tra lại phòng' }),
  ).toBeNull();
  await act(async () => fireEvent.press(rejoin));
  expect(navigate).toHaveBeenCalledWith('CardGames', { roomCode: 'ABCDEFGH' });
  expect(
    jest
      .mocked(gameRequest)
      .mock.calls.filter(([, input]) => input.type === 'room-status'),
  ).toHaveLength(1);
  expect(screen.queryByTestId('online-room-reopen')).toBeNull();
  expect(screen.queryByTestId('online-room-delete')).toBeNull();
});

async function renderRoomEntry(overrides: Partial<GameRoomStatus> = {}) {
  await seedOnlineScore();
  const [match] = await readCardScoreMatches(uid);
  const sharedMatch = { ...match, sharedVersion: 1 };
  await cardStorage.cacheSharedCardScoreMatches(uid, [sharedMatch]);
  const lookup = jest.fn<Promise<GameRoomStatus>, []>().mockResolvedValue({
    roomId: match.onlineRoomId!,
    exists: true,
    owner: false,
    canRejoin: true,
    canReopen: false,
    canDelete: false,
    expired: false,
    phase: 'lobby',
    version: 8,
    matchId: null,
    ...overrides,
  });
  const reopen = jest.fn().mockResolvedValue({ room: { code: 'ABCDEFGH' } });
  jest.mocked(gameRequest).mockImplementation(async (_account, input) => {
    if (input.type === 'score-list')
      return { tables: [{ match: sharedMatch, canEdit: false }] } as never;
    if (input.type === 'room-status') return lookup() as never;
    if (input.type === 'reopen') return reopen() as never;
    throw new Error('Unexpected room entry request');
  });
  const navigate = jest.fn();
  const callbacks = new Map<string, Set<() => void>>();
  const listeners = new Map<string, () => void>();
  const view = render(
    <CardScoreScreen
      navigation={
        {
          navigate,
          addListener: (event: string, listener: () => void) => {
            const handlers = callbacks.get(event) ?? new Set<() => void>();
            handlers.add(listener);
            callbacks.set(event, handlers);
            listeners.set(event, () =>
              handlers.forEach((callback) => callback()),
            );
            return () => {
              handlers.delete(listener);
            };
          },
        } as never
      }
      route={{} as never}
    />,
  );
  const rejoin = await screen.findByRole('button', {
    name: 'Vào lại phòng ABCDEFGH',
  });
  return { view, rejoin, lookup, reopen, navigate, listeners };
}

const expiredOwner: Partial<GameRoomStatus> = {
  owner: true,
  canRejoin: false,
  canReopen: true,
  canDelete: true,
  expired: true,
  phase: 'finished',
};

it('reopens an expired room for its owner from the single re-entry icon', async () => {
  const room = await renderRoomEntry(expiredOwner);
  expect(room.lookup).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: 'Kiểm tra lại phòng' }),
  ).toBeNull();
  expect(screen.queryByTestId('online-room-reopen')).toBeNull();
  await act(async () => fireEvent.press(room.rejoin));
  expect(gameRequest).toHaveBeenLastCalledWith(
    uid,
    expect.objectContaining({
      type: 'reopen',
      roomId: 'room-shared',
      expectedVersion: 8,
      matchId: null,
    }),
    expect.any(AbortSignal),
  );
  expect(room.navigate).toHaveBeenCalledWith('CardGames', {
    roomCode: 'ABCDEFGH',
  });
});

it.each([
  [
    { ...expiredOwner, owner: false, canReopen: false },
    'Phòng đã ngưng hoạt động. Hãy chờ chủ phòng mở lại.',
  ],
  [
    { exists: false, canRejoin: false, canReopen: false },
    'Phòng này đã bị xóa hoặc không còn tồn tại.',
  ],
])(
  'keeps entry errors actionable without reopening an unavailable room (%j)',
  async (status, message) => {
    const room = await renderRoomEntry(status);
    await act(async () => fireEvent.press(room.rejoin));
    expect(screen.getByText(message)).toBeTruthy();
    expect(room.reopen).not.toHaveBeenCalled();
    expect(room.navigate).not.toHaveBeenCalled();
    expect(room.rejoin).toBeEnabled();
  },
);

it('retries a failed room lookup by pressing the same re-entry icon', async () => {
  const room = await renderRoomEntry();
  room.lookup.mockRejectedValueOnce(new Error('Mất kết nối'));
  await act(async () => fireEvent.press(room.rejoin));
  expect(screen.getByText('Mất kết nối')).toBeTruthy();
  expect(room.navigate).not.toHaveBeenCalled();
  expect(room.rejoin).toBeEnabled();
  await act(async () => fireEvent.press(room.rejoin));
  expect(room.lookup).toHaveBeenCalledTimes(2);
  expect(room.navigate).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Mất kết nối')).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Kiểm tra lại phòng' }),
  ).toBeNull();
});

it('ignores a second re-entry tap while the first lookup is pending', async () => {
  const room = await renderRoomEntry();
  const status = await room.lookup();
  room.lookup.mockClear();
  let resolve!: (value: GameRoomStatus) => void;
  room.lookup.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  fireEvent.press(room.rejoin);
  await waitFor(() => expect(room.lookup).toHaveBeenCalledTimes(1));
  expect(room.rejoin).toBeDisabled();
  fireEvent.press(room.rejoin);
  expect(room.lookup).toHaveBeenCalledTimes(1);
  await act(async () => resolve(status));
  expect(room.navigate).toHaveBeenCalledTimes(1);
});

it.each(['blur', 'unmount', 'account change', 'access revocation'])(
  'cancels room reopening if %s occurs during the status request',
  async (event) => {
    const room = await renderRoomEntry(expiredOwner);
    const status = await room.lookup();
    room.lookup.mockClear();
    let resolve!: (value: GameRoomStatus) => void;
    room.lookup.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    fireEvent.press(room.rejoin);
    await waitFor(() => expect(room.lookup).toHaveBeenCalledTimes(1));
    const signal = jest
      .mocked(gameRequest)
      .mock.calls.find(([, input]) => input.type === 'room-status')![2];
    await act(async () => {
      if (event === 'blur') room.listeners.get('blur')?.();
      else if (event === 'unmount') room.view.unmount();
      else if (event === 'access revocation')
        useConfigStore.setState({ gameUsers: [] });
      else
        useAuthStore.getState().setUser({
          uid: 'other-account',
          email: 'other@example.com',
        } as never);
    });
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(status));
    expect(room.reopen).not.toHaveBeenCalled();
    expect(room.navigate).not.toHaveBeenCalled();
  },
);

it.each(['blur', 'access revocation'])(
  'does not navigate after %s while reopening the room',
  async (event) => {
    const room = await renderRoomEntry(expiredOwner);
    let resolve!: (value: unknown) => void;
    room.reopen.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    fireEvent.press(room.rejoin);
    await waitFor(() => expect(room.reopen).toHaveBeenCalledTimes(1));
    await act(async () => {
      if (event === 'blur') room.listeners.get('blur')?.();
      else useConfigStore.setState({ gameUsers: [] });
    });
    await act(async () => resolve({ room: { code: 'ABCDEFGH' } }));
    expect(room.navigate).not.toHaveBeenCalled();
  },
);

it('opens historical scores without showing room re-entry on the history card', async () => {
  const status = {
    roomId: '00000000-0000-4000-8000-000000000001',
    exists: true,
    owner: false,
    canRejoin: true,
    canReopen: false,
    canDelete: false,
    expired: false,
    phase: 'lobby',
    version: 1,
    matchId: null,
  };
  jest
    .mocked(gameRequest)
    .mockImplementation(
      async (_uid, input) =>
        (input.type === 'score-list' ? { tables: [] } : status) as never,
    );
  await cardStorage.createCardScoreMatch(uid, {
    title: 'Tiến lên miền Nam · F96KMCTG',
    players: [
      { id: uid, name: 'Player' },
      { id: 'friend', name: 'Friend' },
    ],
    seatOrder: [uid, 'friend'],
    dealerPlayerId: uid,
    onlineRoomId: '00000000-0000-4000-8000-000000000001',
    amountPerCard: 1,
  });
  const navigate = jest.fn();
  render(
    <CardScoreScreen
      navigation={{ navigate, addListener: () => jest.fn() } as never}
      route={{} as never}
    />,
  );

  const open = await screen.findByRole('button', {
    name: 'Xem bảng điểm bàn Tiến lên miền Nam · F96KMCTG',
  });
  await act(async () => fireEvent.press(open));
  expect(screen.getByTestId('card-score-table-grid')).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Vào lại phòng F96KMCTG' }),
  ).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
});

it('lets the current owner recreate an expired linked room from undeleted history', async () => {
  const roomId = '00000000-0000-4000-8000-000000000002';
  jest.mocked(gameRequest).mockImplementation(async (_uid, input) => {
    if (input.type === 'score-list') return { tables: [] } as never;
    if (input.type === 'room-status')
      return {
        roomId,
        exists: true,
        owner: true,
        canRejoin: false,
        canReopen: true,
        canDelete: true,
        expired: true,
        phase: 'finished',
        version: 8,
        matchId: null,
      } as never;
    return { room: { code: 'F96KMCTG' }, serverTime: Date.now() } as never;
  });
  const match = await cardStorage.createCardScoreMatch(uid, {
    title: 'Tiến lên miền Nam · F96KMCTG',
    players: [
      { id: uid, name: 'Player' },
      { id: 'friend', name: 'Friend' },
    ],
    seatOrder: [uid, 'friend'],
    dealerPlayerId: uid,
    onlineRoomId: roomId,
  });
  await cardStorage.updateCardScoreMatch(uid, {
    ...match,
    status: 'finished',
  });
  const navigate = jest.fn();
  render(
    <CardScoreScreen
      navigation={{ navigate, addListener: () => jest.fn() } as never}
      route={{} as never}
    />,
  );
  fireEvent.press(
    await screen.findByRole('button', {
      name: `Xem bảng điểm bàn ${match.title}`,
    }),
  );
  expect(
    await screen.findByTestId(`online-room-reopen-${match.id}`),
  ).toBeTruthy();
  expect(screen.getByTestId(`online-room-delete-${match.id}`)).toBeTruthy();
  expect(screen.queryByTestId(`online-room-rejoin-${match.id}`)).toBeNull();
  fireEvent.press(screen.getByTestId(`online-room-reopen-${match.id}`));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith('CardGames', {
      roomCode: 'F96KMCTG',
    }),
  );
  expect(gameRequest).toHaveBeenLastCalledWith(
    uid,
    expect.objectContaining({
      type: 'reopen',
      roomId,
      expectedVersion: 8,
      matchId: null,
    }),
    expect.any(AbortSignal),
  );
});

it('lets only the connected owner correct and finish a shared online table', async () => {
  await cardStorage.createCardScoreMatch(uid, {
    title: 'Tiến lên miền Nam · F96KMCTG',
    players: [
      { id: uid, name: 'Player' },
      { id: 'friend', name: 'Friend' },
    ],
    seatOrder: [uid, 'friend'],
    dealerPlayerId: uid,
    onlineRoomId: 'online-room',
    onlineRoomCode: 'F96KMCTG',
    amountPerCard: 1,
  });
  const [onlineMatch] = await readCardScoreMatches(uid);
  await cardStorage.updateCardScoreMatch(uid, {
    ...onlineMatch,
    rounds: [
      {
        id: 'online-round-1',
        createdAt: Date.now(),
        scores: { [uid]: 1, friend: -1 },
      },
    ],
  });
  await exposeSharedBoard();
  renderScreen();

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Thêm ván' })).toBeEnabled(),
  );
  expect(
    screen.getByRole('button', { name: 'Bốc thăm người chia bài' }),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Kết thúc bàn chơi' }),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Sửa điểm ván 1' }));
  expect(screen.getByText('Sửa điểm ván')).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Xóa điểm người chơi đang chọn' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Số 2' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn điểm của Friend' }));
  fireEvent.press(
    screen.getByRole('button', { name: 'Xóa điểm người chơi đang chọn' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Dấu âm/dương' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 2' }));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));

  await waitFor(async () => {
    const [saved] = await readCardScoreMatches(uid);
    expect(saved.rounds[0].scores).toEqual({ [uid]: 2, friend: -2 });
  });
  await waitFor(() => expect(screen.queryByText('Sửa điểm ván')).toBeNull());

  fireEvent.press(screen.getByRole('button', { name: 'Thêm ván' }));
  expect(screen.getByText('Nhập điểm nhanh')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Số 3' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn điểm của Friend' }));
  fireEvent.press(screen.getByRole('button', { name: 'Dấu âm/dương' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 3' }));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));
  await waitFor(async () => {
    const [saved] = await readCardScoreMatches(uid);
    expect(saved.rounds).toHaveLength(2);
    expect(saved.rounds[1].scores).toEqual({ [uid]: 3, friend: -3 });
  });

  const confirmDelete = jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Xóa ván')?.onPress?.();
    });
  fireEvent.press(
    await screen.findByRole('button', { name: 'Xóa điểm ván 1' }),
  );
  await waitFor(async () => {
    const [saved] = await readCardScoreMatches(uid);
    expect(saved.rounds.map((round) => round.id)).not.toContain(
      'online-round-1',
    );
  });
  await cardStorage.syncOnlineCardScoreMatch(uid, {
    roomId: 'online-room',
    code: 'F96KMCTG',
    amountPerCard: 1,
    members: [
      { uid, name: 'Player' },
      { uid: 'friend', name: 'Friend' },
    ],
    matchId: 'online-round-1',
    result: {
      ranking: [
        { uid, moneyDelta: 1 },
        { uid: 'friend', moneyDelta: -1 },
      ],
    },
  });
  const [afterSync] = await readCardScoreMatches(uid);
  expect(afterSync.rounds.map((round) => round.id)).not.toContain(
    'online-round-1',
  );
  expect(afterSync.ignoredOnlineRoundIds).toContain('online-round-1');
  confirmDelete.mockRestore();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Kết thúc bàn chơi' }),
    ).toBeEnabled(),
  );

  fireEvent.press(screen.getByRole('button', { name: 'Kết thúc bàn chơi' }));
  fireEvent.press(
    await screen.findByRole('button', { name: 'Xác nhận kết thúc bàn' }),
  );
  await waitFor(async () =>
    expect((await readCardScoreMatches(uid))[0].status).toBe('finished'),
  );
});

it.each(['dismiss', 'fallback'] as const)(
  'preserves a newer shared score revision when finish commits through %s',
  async (method) => {
    await seedOnlineScore();
    const board = await exposeSharedBoard();
    const request = jest.mocked(gameRequest).getMockImplementation()!;
    jest.mocked(gameRequest).mockImplementation(async (...args) => {
      const response = await request(...args);
      if (args[1].type === 'score-write') {
        const updated = board.get();
        board.set({
          ...updated,
          match: {
            ...updated.match,
            title: 'Bảng điểm phiên bản mới hơn',
            sharedVersion: updated.match.sharedVersion! + 1,
          },
        });
      }
      return response;
    });
    renderScreen();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Thêm ván' })).toBeEnabled(),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Kết thúc bàn chơi' }));
    const onDismiss = screen
      .UNSAFE_getAllByType(Modal)
      .find((modal) => modal.props.onDismiss)?.props.onDismiss;
    expect(onDismiss).toBeDefined();
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
      );
    });
    await screen.findByText('Bảng điểm phiên bản mới hơn');
    if (method === 'dismiss') act(() => onDismiss());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(screen.getByText('Bảng điểm phiên bản mới hơn')).toBeTruthy();
  },
);

it.each(['dismiss', 'fallback'] as const)(
  'preserves refreshed scores when a local finish commits through %s',
  async (method) => {
    await seedOnlineScore();
    const board = await exposeSharedBoard(false);
    renderScreen();
    fireEvent.press(
      await screen.findByRole('button', { name: 'Kết thúc bàn chơi' }),
    );
    const onDismiss = screen
      .UNSAFE_getAllByType(Modal)
      .find((modal) => modal.props.onDismiss)?.props.onDismiss;
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
      );
    });
    const current = board.get();
    board.set({
      ...current,
      match: {
        ...current.match,
        title: 'Bảng điểm mới khi đóng hộp thoại',
        sharedVersion: current.match.sharedVersion! + 1,
      },
    });
    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
    await screen.findByText('Bảng điểm mới khi đóng hộp thoại');
    if (method === 'dismiss') act(() => onDismiss());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(screen.getByText('Bảng điểm mới khi đóng hộp thoại')).toBeTruthy();
    expect(screen.queryByTestId('card-score-open-table')).toBeNull();
  },
);

it('discards a queued finish when another account loads before modal dismissal', async () => {
  await seedOnlineScore();
  await cardStorage.createCardScoreMatch('other-score-account', {
    title: 'Bàn tài khoản mới',
    players: [
      { id: 'other-a', name: 'Lan' },
      { id: 'other-b', name: 'Chi' },
    ],
    seatOrder: ['other-a', 'other-b'],
    dealerPlayerId: 'other-a',
  });
  await exposeSharedBoard(false);
  const request = jest.mocked(gameRequest).getMockImplementation()!;
  jest
    .mocked(gameRequest)
    .mockImplementation(async (...args) =>
      args[0] === uid ? request(...args) : ({ tables: [] } as never),
    );
  renderScreen();
  fireEvent.press(
    await screen.findByRole('button', { name: 'Kết thúc bàn chơi' }),
  );
  const onDismiss = screen
    .UNSAFE_getAllByType(Modal)
    .find((modal) => modal.props.onDismiss)?.props.onDismiss;
  await act(async () => {
    fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
    );
  });
  act(() =>
    useAuthStore.getState().setUser({
      uid: 'other-score-account',
      email: 'player@example.com',
      displayName: 'Lan',
    }),
  );
  await screen.findByText('Bàn tài khoản mới');
  act(() => onDismiss());
  expect(screen.getByText('Bàn tài khoản mới')).toBeTruthy();
});

it('lets an explicit local resume supersede a queued finish before dismissal', async () => {
  await seedOnlineScore();
  const [original] = await readCardScoreMatches(uid);
  await exposeSharedBoard(false);
  renderScreen();
  fireEvent.press(
    await screen.findByRole('button', { name: 'Kết thúc bàn chơi' }),
  );
  const onDismiss = screen
    .UNSAFE_getAllByType(Modal)
    .find((modal) => modal.props.onDismiss)?.props.onDismiss;
  await act(async () => {
    fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
    );
  });
  fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
  await screen.findByTestId(`card-score-history-${original.id}`);
  expect(screen.queryByTestId('card-score-open-table')).toBeNull();
  await act(async () => {
    fireEvent.press(
      screen.getByRole('button', { name: `Mở lại bàn ${original.title}` }),
    );
  });
  await screen.findByTestId('card-score-open-table');
  act(() => onDismiss());
  expect(screen.getByTestId('card-score-open-table')).toBeTruthy();
});

it('allows managing a ninth player on an online score table', async () => {
  const players = Array.from({ length: 8 }, (_, index) => ({
    id: `online-${index + 1}`,
    name: `Người chơi ${index + 1}`,
  }));
  await cardStorage.createCardScoreMatch(uid, {
    title: 'Tiến lên miền Nam · F96KMCTG',
    players,
    seatOrder: players.map(({ id }) => id),
    dealerPlayerId: players[0].id,
    onlineRoomId: 'online-room',
    onlineRoomCode: 'F96KMCTG',
    amountPerCard: 1,
  });
  await exposeSharedBoard();
  renderScreen();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Quản lý người chơi' }),
    ).toBeEnabled(),
  );
  fireEvent.press(
    await screen.findByRole('button', { name: 'Quản lý người chơi' }),
  );
  fireEvent.changeText(
    screen.getByLabelText('Tên người chơi mới'),
    'Người chơi 9',
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Thêm người chơi vào bàn' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));

  await waitFor(async () => {
    const [saved] = await readCardScoreMatches(uid);
    expect(saved.players).toHaveLength(9);
  });
});

it('keeps the save control outside the scroll area on eight-player games', () => {
  const players = Array.from({ length: 8 }, (_, index) => ({
    id: `player-${index + 1}`,
    name: `Người chơi ${index + 1}`,
  }));
  render(
    <CardScoreRoundDialog
      visible
      busy={false}
      error={null}
      match={{
        id: 'eight-player-match',
        title: 'Bàn tám người',
        players,
        seatOrder: players.map(({ id }) => id),
        dealerPlayerId: players[0].id,
        rounds: [],
        status: 'active',
        createdAt: 0,
        updatedAt: 0,
      }}
      editingRound={null}
      scores={Object.fromEntries(players.map(({ id }) => [id, '0']))}
      onClose={jest.fn()}
      onChange={jest.fn()}
      onSave={jest.fn()}
    />,
  );

  const scrollContent = screen.getByTestId('card-score-round-scroll');
  expect(
    within(scrollContent).getAllByRole('button', {
      name: /^Chọn điểm của Người chơi/,
    }),
  ).toHaveLength(8);
  expect(
    within(scrollContent).queryByRole('button', { name: 'Lưu ván' }),
  ).toBeNull();
  expect(screen.getByRole('button', { name: 'Lưu ván' })).toBeTruthy();
});

it('shows a round loading indicator instead of the create button while saving', () => {
  render(
    <CardScoreSetupDialog
      visible
      busy
      error={null}
      title=""
      onTitleChange={jest.fn()}
      playerNames={['An', 'Bình', 'Chi']}
      drawnSeats={null}
      onClose={jest.fn()}
      onCreate={jest.fn()}
      onNameChange={jest.fn()}
      onRemovePlayer={jest.fn()}
      onAddPlayer={jest.fn()}
      onDrawSeats={jest.fn()}
    />,
  );

  const loadingIndicator = screen.getByRole('progressbar', {
    name: 'Đang tạo bàn',
  });
  expect(StyleSheet.flatten(loadingIndicator.props.style)).toMatchObject({
    width: 48,
    height: 48,
    borderRadius: 24,
  });
  expect(screen.queryByRole('button', { name: 'Tạo' })).toBeNull();
  expect(screen.getByLabelText('Tên bàn chơi').props.editable).toBe(false);
  expect(screen.getByLabelText('Tên người chơi 1').props.editable).toBe(false);
  expect(
    screen.getByRole('button', { name: 'Bỏ người chơi 1' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Thêm người chơi' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Bốc thăm vị trí & người chia bài' }),
  ).toBeDisabled();
});

it('keeps the create action compact and centered in the setup dialog', () => {
  render(
    <CardScoreSetupDialog
      visible
      busy={false}
      error={null}
      title=""
      onTitleChange={jest.fn()}
      playerNames={['', '']}
      drawnSeats={null}
      onClose={jest.fn()}
      onCreate={jest.fn()}
      onNameChange={jest.fn()}
      onRemovePlayer={jest.fn()}
      onAddPlayer={jest.fn()}
      onDrawSeats={jest.fn()}
    />,
  );

  const createButton = screen.getByRole('button', { name: 'Tạo' });
  expect(StyleSheet.flatten(createButton.props.style)).toMatchObject({
    width: 120,
    height: 44,
  });

  const randomizeButton = screen.getByRole('button', {
    name: 'Bốc thăm vị trí & người chia bài',
  });
  expect(StyleSheet.flatten(randomizeButton.props.style)).toMatchObject({
    minHeight: 36,
    paddingHorizontal: 11,
  });
  expect(
    StyleSheet.flatten(
      screen.getByTestId('card-score-setup-secondary-actions').props.style,
    ),
  ).toMatchObject({
    flexDirection: 'row',
    justifyContent: 'space-between',
  });
  expect(screen.getByText('Bốc thăm')).toBeTruthy();
});

it('creates a shared game table, records and edits scores with the keypad, then keeps its history', async () => {
  const rendered = renderScreen();
  fireEvent.press(await screen.findByText('Tạo bàn chơi'));
  expect(
    within(screen.getByTestId('card-score-setup-scroll')).queryByRole(
      'button',
      { name: 'Tạo' },
    ),
  ).toBeNull();
  expect(
    within(screen.getByTestId('card-score-setup-footer')).getByRole('button', {
      name: 'Tạo',
    }),
  ).toBeTruthy();
  expect(screen.getByLabelText('Tên người chơi 4')).toBeTruthy();
  expect(screen.queryByText(/tùy chọn/)).toBeNull();
  expect(screen.queryByText(/Dùng chung cho mọi trò/)).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Tên bàn chơi'), 'Phỏm');
  const names = ['An', 'Bình', 'Chi', 'Dung'];
  for (let index = 0; index < names.length; index += 1)
    fireEvent.changeText(
      screen.getByLabelText(`Tên người chơi ${index + 1}`),
      names[index],
    );
  fireEvent.press(
    screen.getByRole('button', {
      name: 'Bốc thăm vị trí & người chia bài',
    }),
  );
  expect(screen.getByText(/1\. .*Chia bài/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
  expect(await screen.findByText('Phỏm')).toBeTruthy();
  expect(screen.getByText('4 người · bắt đầu', { exact: false })).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Thêm ván' }));
  expect(screen.getByRole('button', { name: 'Đóng nhập điểm' })).toBeTruthy();
  expect(
    screen.queryByText(
      'Chọn người chơi rồi chạm số. Có thể nhập điểm âm hoặc dương.',
    ),
  ).toBeNull();
  const playerChoices = screen.getByTestId('card-score-player-choices');
  expect(playerChoices.props.horizontal).toBeUndefined();
  expect(StyleSheet.flatten(playerChoices.props.style)).toMatchObject({
    flexDirection: 'row',
    flexWrap: 'wrap',
  });
  expect(
    StyleSheet.flatten(
      screen.getByRole('button', { name: 'Chọn điểm của An' }).props.style,
    ),
  ).toMatchObject({ width: '48%' });
  expect(screen.queryByRole('button', { name: 'Đóng' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Đóng nhập điểm' }));
  expect(screen.queryByText('Nhập điểm nhanh')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Thêm ván' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 1' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 2' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn điểm của Bình' }));
  fireEvent.press(screen.getByRole('button', { name: 'Dấu âm/dương' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 4' }));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));
  const roundNumber = await screen.findByRole('button', {
    name: 'Sửa điểm ván 1',
  });
  expect(within(roundNumber).getByText('1')).toBeTruthy();
  expect(within(roundNumber).queryByText('V1')).toBeNull();
  const roundRowActions = within(
    screen.getByTestId('card-score-round-1'),
  ).getAllByRole('button');
  expect(roundRowActions).toHaveLength(6);
  expect(roundRowActions[0].props.accessibilityLabel).toBe('Sửa điểm ván 1');
  expect(
    roundRowActions[roundRowActions.length - 1].props.accessibilityLabel,
  ).toBe('Xóa điểm ván 1');
  expect(
    StyleSheet.flatten(
      screen.getByRole('button', { name: 'Xóa điểm ván 1' }).props.style,
    ),
  ).toMatchObject({
    width: 44,
    height: 44,
    borderWidth: 0,
    backgroundColor: 'transparent',
  });
  expect(screen.queryByText('Σ')).toBeNull();
  expect(
    StyleSheet.flatten(screen.getByTestId('card-score-round-1').props.style)
      .backgroundColor,
  ).toBe(colors.dangerSoft);
  await waitFor(() =>
    expect(screen.getAllByText('+12').length).toBeGreaterThan(0),
  );
  await waitFor(() =>
    expect(screen.getAllByText('-4').length).toBeGreaterThan(0),
  );

  fireEvent.press(screen.getByRole('button', { name: 'Sửa điểm ván 1' }));
  fireEvent.press(
    screen.getByRole('button', { name: 'Xóa điểm người chơi đang chọn' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Số 3' }));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));
  await waitFor(() =>
    expect(screen.getAllByText('+3').length).toBeGreaterThan(0),
  );

  const confirm = jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Xóa ván')?.onPress?.();
    });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Xóa điểm ván 1' }),
    ).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Xóa điểm ván 1' }));
  expect(confirm).toHaveBeenCalled();
  await waitFor(async () =>
    expect((await readCardScoreMatches(uid))[0].rounds).toHaveLength(0),
  );
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Sửa điểm ván 1' })).toBeNull(),
  );
  confirm.mockRestore();

  fireEvent.press(screen.getByRole('button', { name: 'Kết thúc bàn chơi' }));
  expect(screen.getByText('Kết thúc bàn chơi?')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục chơi' }));
  expect(screen.getByText('Phỏm')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Kết thúc bàn chơi' }));
  fireEvent.press(
    screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
  );
  const historyButton = await screen.findByRole('button', {
    name: /^Xem lịch sử bàn \d{2}:/,
  });
  fireEvent.press(historyButton);
  expect(
    await screen.findByText('Bàn chưa có ván được ghi điểm.'),
  ).toBeTruthy();
  const [saved] = await readCardScoreMatches(uid);
  expect(saved.title).toBe('Phỏm');
  expect(saved.rounds).toEqual([]);
  expect(saved.players.map(({ name }) => name)).toEqual(names);
  expect(saved.status).toBe('finished');

  rendered.unmount();
  renderScreen();
  const historyCard = await screen.findByTestId(
    `card-score-history-${saved.id}`,
  );
  expect(StyleSheet.flatten(historyCard.props.style)).toMatchObject({
    flexDirection: 'column',
    alignItems: 'stretch',
  });
  const historyTitleButton = screen.getByRole('button', {
    name: `Xem lịch sử bàn ${saved.title}`,
  });
  expect(StyleSheet.flatten(historyTitleButton.props.style)).toMatchObject({
    flex: 1,
    justifyContent: 'center',
  });
  expect(
    StyleSheet.flatten(screen.getByText(saved.title).props.style),
  ).not.toHaveProperty('flex');
  const playerScores = screen.getByTestId(
    `card-score-history-scores-${saved.id}`,
  );
  expect(StyleSheet.flatten(playerScores.props.style)).toMatchObject({
    flexDirection: 'row',
    flexWrap: 'wrap',
  });
  expect(within(playerScores).getByText('An')).toBeTruthy();
  expect(within(playerScores).getByText('Bình')).toBeTruthy();
  expect(within(playerScores).getAllByText('0')).toHaveLength(4);
  expect(screen.getByText(/\d{2}:\d{2} \d+\/\d+\/\d{4} · 0 ván/)).toBeTruthy();
  const resumeButton = screen.getByRole('button', {
    name: `Mở lại bàn ${saved.title}`,
  });
  const resumeButtonStyle = StyleSheet.flatten(resumeButton.props.style);
  expect(resumeButtonStyle).toMatchObject({
    minHeight: layout.hitSize,
  });
  expect(resumeButtonStyle).not.toHaveProperty('backgroundColor');
  expect(screen.queryByText('Tiếp tục chơi')).toBeNull();
  fireEvent.press(resumeButton);
  expect(await screen.findByRole('button', { name: 'Thêm ván' })).toBeTruthy();
  expect(screen.getByText('Phỏm')).toBeTruthy();
  await waitFor(async () =>
    expect((await readCardScoreMatches(uid))[0].status).toBe('active'),
  );
});

it('closes setup with the X, keeps multiple active tables, and switches between them', async () => {
  renderScreen();
  fireEvent.press(await screen.findByText('Tạo bàn chơi'));
  expect(screen.getByLabelText('Tên bàn chơi')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Đóng tạo bàn chơi' }));
  expect(screen.queryByLabelText('Tên bàn chơi')).toBeNull();
  expect(screen.queryByText('Bỏ giấy bút, tập trung cuộc vui')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Tạo bàn chơi' }));
  fireEvent.changeText(screen.getByLabelText('Tên bàn chơi'), 'Bàn An');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'An');
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ người chơi 4' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ người chơi 3' }));
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 2'), 'Bình');
  fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
  expect(await screen.findByText('Bàn An')).toBeTruthy();
  expect(screen.getByTestId('card-score-table-grid').props.style.width).toBe(
    Math.min(Dimensions.get('window').width, layout.contentMaxWidth) -
      layout.screenGutter * 2 -
      2,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Thêm ván' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 1' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 0' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn điểm của Bình' }));
  fireEvent.press(screen.getByRole('button', { name: 'Dấu âm/dương' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 1' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 0' }));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));
  expect(
    within(
      await screen.findByRole('button', { name: 'Sửa điểm ván 1' }),
    ).getByText('1'),
  ).toBeTruthy();
  expect(screen.queryByText('Σ')).toBeNull();
  expect(
    screen.queryByText('Tổng ván cần bằng 0 · dòng đỏ đang bị lệch'),
  ).toBeNull();
  expect(
    StyleSheet.flatten(screen.getByTestId('card-score-round-1').props.style)
      .backgroundColor,
  ).not.toBe(colors.dangerSoft);

  expect(
    screen.getByRole('button', { name: 'Tạo bàn mới, giữ bàn hiện tại' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Tạo bàn chơi mới' })).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: 'Tạo bàn mới, giữ bàn hiện tại' }),
  );
  fireEvent.changeText(screen.getByLabelText('Tên bàn chơi'), 'Bàn Bình');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'Thu');
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ người chơi 4' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ người chơi 3' }));
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 2'), 'Minh');
  fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
  expect(await screen.findByText('Các bàn đang chơi · 2')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Mở bàn Bàn Bình' }).props
      .accessibilityState.selected,
  ).toBe(true);
  expect(screen.getAllByText('Bàn Bình')).toHaveLength(1);
  expect(screen.getByText(/^Bắt đầu /)).toBeTruthy();
  expect(screen.queryByText(/2 người · bắt đầu/)).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Mở bàn Bàn An' }));
  expect(
    screen.getByRole('button', { name: 'Mở bàn Bàn An' }).props
      .accessibilityState.selected,
  ).toBe(true);
  const active = await readCardScoreMatches(uid);
  expect(active.filter((match) => match.status === 'active')).toHaveLength(2);
  expect(active.find((match) => match.title === 'Bàn An')?.rounds).toHaveLength(
    1,
  );
});

it('adds a player to an active table without changing scores from earlier rounds', async () => {
  renderScreen();
  fireEvent.press(await screen.findByText('Tạo bàn chơi'));
  fireEvent.changeText(screen.getByLabelText('Tên bàn chơi'), 'Bàn đang chơi');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'An');
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ người chơi 4' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ người chơi 3' }));
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 2'), 'Bình');
  fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
  expect(await screen.findByText('Bàn đang chơi')).toBeTruthy();

  expect(
    within(screen.getByTestId('card-score-active-tables-heading')).queryByRole(
      'button',
      { name: 'Quản lý người chơi' },
    ),
  ).toBeNull();
  expect(
    within(screen.getByTestId('card-score-current-match-heading')).getByRole(
      'button',
      { name: 'Quản lý người chơi' },
    ),
  ).toBeTruthy();

  const dealerHeader = screen.getByTestId(
    'card-score-player-header-content-player-1',
  );
  expect(
    StyleSheet.flatten(
      screen.getByTestId('card-score-player-column-player-1').props.style,
    ),
  ).not.toHaveProperty('backgroundColor');
  expect(screen.queryByTestId('card-score-dealer-badge-player-1')).toBeNull();
  expect(dealerHeader.children).toHaveLength(1);
  expect(dealerHeader.children[0].props.children).toBe('An');
  expect(dealerHeader.children[0].props.accessibilityLabel).toBe(
    'An, người chia bài',
  );
  expect(
    StyleSheet.flatten(dealerHeader.children[0].props.style),
  ).toMatchObject({
    width: '100%',
    textAlign: 'center',
    color: colors.earth,
  });
  expect(
    StyleSheet.flatten(
      screen.getByTestId('card-score-player-header-content-player-2')
        .children[0].props.style,
    ),
  ).toMatchObject({ width: '100%', textAlign: 'center' });

  fireEvent.press(screen.getByRole('button', { name: 'Thêm ván' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 5' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn điểm của Bình' }));
  fireEvent.press(screen.getByRole('button', { name: 'Dấu âm/dương' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 5' }));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));
  expect(
    within(
      await screen.findByRole('button', { name: 'Sửa điểm ván 1' }),
    ).getByText('1'),
  ).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Quản lý người chơi' }));
  expect(screen.getByText('Quản lý người chơi')).toBeTruthy();
  expect(
    screen.getByText(
      'Khi xóa, điểm người đó trong các ván đã ghi cũng bị xóa.',
    ),
  ).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Tên người chơi mới'), 'An');
  fireEvent.press(
    screen.getByRole('button', { name: 'Thêm người chơi vào bàn' }),
  );
  expect(
    await screen.findByText('Tên người chơi không được trùng nhau.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Tên người chơi mới')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Tên người chơi mới'), 'Chi');
  fireEvent.press(
    screen.getByRole('button', { name: 'Thêm người chơi vào bàn' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));

  expect(
    await screen.findByRole('button', {
      name: 'Sửa điểm ván 1 của Chi: 0',
    }),
  ).toBeTruthy();
  const [saved] = await readCardScoreMatches(uid);
  expect(saved.players.map(({ name }) => name)).toEqual(['An', 'Bình', 'Chi']);
  expect(saved.rounds[0].scores).toEqual({ 'player-1': 5, 'player-2': -5 });
  expect(saved.rounds[0].scores).not.toHaveProperty(saved.players[2].id);
  expect(screen.getByText('An')).toBeTruthy();
  expect(screen.getByText('Chi')).toBeTruthy();
});

it('redraws only the dealer without changing player positions', async () => {
  renderScreen();
  fireEvent.press(await screen.findByText('Tạo bàn chơi'));
  fireEvent.changeText(screen.getByLabelText('Tên bàn chơi'), 'Bàn thử');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'An');
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ người chơi 4' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ người chơi 3' }));
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 2'), 'Bình');
  fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
  await screen.findByText('Bàn thử');

  const before = (await readCardScoreMatches(uid)).find(
    (match) => match.status === 'active',
  );
  expect(before?.dealerPlayerId).toBe('player-1');
  expect(before?.seatOrder).toEqual(['player-1', 'player-2']);

  const random = jest.spyOn(Math, 'random').mockReturnValue(0);
  fireEvent.press(
    screen.getByRole('button', {
      name: 'Bốc thăm người chia bài',
    }),
  );
  await waitFor(async () => {
    const after = (await readCardScoreMatches(uid)).find(
      (match) => match.status === 'active',
    );
    expect(after?.dealerPlayerId).toBe('player-2');
    expect(after?.seatOrder).toEqual(before?.seatOrder);
  });
  random.mockRestore();

  expect(
    StyleSheet.flatten(
      screen.getByTestId('card-score-player-header-content-player-1')
        .children[0].props.style,
    ),
  ).not.toMatchObject({ color: colors.earth });
  expect(
    StyleSheet.flatten(
      screen.getByTestId('card-score-player-header-content-player-2')
        .children[0].props.style,
    ),
  ).toMatchObject({ color: colors.earth });
  expect(screen.getByText(/Tên người chia bài được tô màu/)).toBeTruthy();
  expect(screen.queryByText(/Huy hiệu/)).toBeNull();
});

it('renames and removes a player without changing the remaining player IDs', async () => {
  renderScreen();
  fireEvent.press(await screen.findByText('Tạo bàn chơi'));
  fireEvent.changeText(
    screen.getByLabelText('Tên bàn chơi'),
    'Bàn có chỉnh sửa',
  );
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'An');
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ người chơi 4' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ người chơi 3' }));
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 2'), 'Bình');
  fireEvent.press(screen.getByRole('button', { name: 'Tạo' }));
  expect(await screen.findByText('Bàn có chỉnh sửa')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Thêm ván' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 5' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn điểm của Bình' }));
  fireEvent.press(screen.getByRole('button', { name: 'Dấu âm/dương' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 5' }));
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));
  expect(
    await screen.findByRole('button', { name: 'Sửa điểm ván 1' }),
  ).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Quản lý người chơi' }));
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'An mới');
  fireEvent.changeText(screen.getByLabelText('Tên người chơi mới'), 'Chi');
  fireEvent.press(
    screen.getByRole('button', { name: 'Thêm người chơi vào bàn' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Xóa người chơi Bình' }));

  const confirmRemoval = jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Xóa và lưu')?.onPress?.();
    });
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));

  await waitFor(() => expect(confirmRemoval).toHaveBeenCalled());
  expect(confirmRemoval.mock.calls[0][1]).toContain(
    'Tổng các ván này có thể không còn bằng 0',
  );
  await waitFor(async () => {
    const [saved] = await readCardScoreMatches(uid);
    expect(saved.players.map(({ name }) => name)).toEqual(['An mới', 'Chi']);
    expect(saved.rounds[0].scores).toEqual({ 'player-1': 5 });
  });
  expect(screen.getByText('An mới')).toBeTruthy();
  expect(screen.getByText('Chi')).toBeTruthy();
  expect(screen.queryByText('Bình')).toBeNull();
  expect(
    StyleSheet.flatten(screen.getByTestId('card-score-round-1').props.style)
      .backgroundColor,
  ).toBe(colors.dangerSoft);
  confirmRemoval.mockRestore();
});

it('shows a failed finish inside the confirmation and allows retry', async () => {
  await cardStorage.createCardScoreMatch(uid, {
    title: 'Retry table',
    players: [
      { id: 'a', name: 'An' },
      { id: 'b', name: 'Bình' },
    ],
    seatOrder: ['a', 'b'],
    dealerPlayerId: 'a',
  });
  renderScreen();
  fireEvent.press(
    await screen.findByRole('button', { name: 'Kết thúc bàn chơi' }),
  );
  const update = jest
    .spyOn(cardStorage, 'updateCardScoreMatch')
    .mockRejectedValueOnce(new Error('Disk full'));
  try {
    fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByTestId('card-score-finish-content')).getByRole(
          'alert',
        ),
      ).toHaveTextContent('Disk full'),
    );
    expect((await readCardScoreMatches(uid))[0].status).toBe('active');
    fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
    );
    await waitFor(async () =>
      expect((await readCardScoreMatches(uid))[0].status).toBe('finished'),
    );
  } finally {
    update.mockRestore();
  }
});

async function seedOnlineScore() {
  const match = await cardStorage.createCardScoreMatch(uid, {
    title: 'Tiến lên miền Nam · ABCDEFGH',
    players: [
      { id: uid, name: 'Player' },
      { id: 'friend', name: 'Friend' },
    ],
    seatOrder: [uid, 'friend'],
    dealerPlayerId: uid,
    onlineRoomId: 'room-shared',
    onlineRoomCode: 'ABCDEFGH',
  });
  await cardStorage.updateCardScoreMatch(uid, {
    ...match,
    rounds: [
      { id: 'r-shared', createdAt: 1, scores: { [uid]: 5, friend: -5 } },
    ],
  });
}
it('keeps recovery inside an opened board and out of the history overview', async () => {
  await seedOnlineScore();
  jest.mocked(gameRequest).mockRejectedValue(new Error('Mất kết nối'));
  const [match] = await readCardScoreMatches(uid);
  renderScreen();
  const card = await screen.findByTestId(`card-score-history-${match.id}`);
  expect(
    screen.queryByRole('button', { name: 'Đồng bộ lại bảng điểm' }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Kiểm tra lại phòng' }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Vào lại phòng ABCDEFGH' }),
  ).toBeNull();
  expect(
    jest
      .mocked(gameRequest)
      .mock.calls.some(([, input]) => input.type === 'room-status'),
  ).toBe(false);
  fireEvent.press(
    within(card).getByRole('button', {
      name: `Xem bảng điểm bàn ${match.title}`,
    }),
  );
  const detail = screen.getByTestId(`card-score-history-detail-${match.id}`);
  await act(async () => undefined);
  expect(
    within(detail).queryByRole('button', { name: 'Kiểm tra lại phòng' }),
  ).toBeNull();
  expect(
    within(detail).queryByRole('button', { name: 'Đồng bộ lại bảng điểm' }),
  ).toBeNull();
});

it('shows shared sync recovery only inside the current score table', async () => {
  await seedOnlineScore();
  await exposeSharedBoard(false);
  jest.mocked(gameRequest).mockRejectedValue(new Error('Mất kết nối'));
  renderScreen();
  const table = await screen.findByTestId('card-score-open-table');
  expect(
    await within(table).findByRole('button', { name: 'Đồng bộ lại bảng điểm' }),
  ).toBeTruthy();
  expect(
    screen.getAllByRole('button', { name: 'Đồng bộ lại bảng điểm' }),
  ).toHaveLength(1);
});

function mockLegacyOwner() {
  jest.mocked(gameRequest).mockImplementation(async (_account, input) => {
    if (input.type === 'score-list') return { tables: [] } as never;
    if (input.type === 'room-status')
      return {
        ...expiredOwner,
        roomId: input.roomId,
        exists: true,
        version: 1,
        matchId: null,
      } as never;
    throw new Error('Unexpected request');
  });
}

it.each([false, true])(
  'removes a deleted online board immediately and after reload (shared: %s)',
  async (canonical) => {
    await seedOnlineScore();
    if (canonical) {
      const server = await exposeSharedBoard();
      server.set({
        ...server.get(),
        match: { ...server.get().match, status: 'finished' },
      });
    } else mockLegacyOwner();
    const [match] = await readCardScoreMatches(uid);
    const view = renderScreen();
    fireEvent.press(
      await screen.findByRole('button', {
        name: `Xem bảng điểm bàn ${match.title}`,
      }),
    );
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((button) => button.text === 'Xóa bàn')?.onPress?.();
      });
    const deleteButton = await screen.findByRole('button', {
      name: /Xóa lịch sử bàn/,
    });
    await act(async () => {
      fireEvent.press(deleteButton);
    });
    await waitFor(() =>
      expect(screen.queryByTestId(`card-score-history-${match.id}`)).toBeNull(),
    );
    expect(screen.queryByText('Khôi phục')).toBeNull();
    expect(await readCardScoreMatches(uid)).toEqual([]);
    const [deleted] = await readCardScoreMatches(uid, { includeDeleted: true });
    expect(deleted.deletedAt).toEqual(expect.any(Number));
    view.unmount();
    renderScreen();
    await screen.findByText('Sẵn sàng ghi điểm?');
    expect(screen.queryByTestId(`card-score-history-${match.id}`)).toBeNull();
    expect(screen.queryByText('Khôi phục')).toBeNull();
    expect(
      jest
        .mocked(gameRequest)
        .mock.calls.filter(([, input]) => input.type === 'score-write'),
    ).toHaveLength(canonical ? 1 : 0);
    expect(
      jest
        .mocked(gameRequest)
        .mock.calls.some(([, input]) => input.type === 'delete-room'),
    ).toBe(false);
    alert.mockRestore();
  },
);

it('reopens a legacy table out of history, edits and adds scores locally, and keeps it active after reload', async () => {
  await seedOnlineScore();
  mockLegacyOwner();
  const [original] = await readCardScoreMatches(uid);
  const view = renderScreen();
  fireEvent.press(
    await screen.findByRole('button', {
      name: `Xem bảng điểm bàn ${original.title}`,
    }),
  );
  const reopen = await screen.findByRole('button', {
    name: `Mở lại bàn ${original.title}`,
  });
  await act(async () => fireEvent.press(reopen));
  await waitFor(() =>
    expect(
      screen.queryByTestId(`card-score-history-${original.id}`),
    ).toBeNull(),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Thêm ván' })).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Sửa điểm ván 1' }));
  fireEvent.press(
    screen.getByRole('button', { name: 'Xóa điểm người chơi đang chọn' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Số 2' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn điểm của Friend' }));
  fireEvent.press(
    screen.getByRole('button', { name: 'Xóa điểm người chơi đang chọn' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Dấu âm/dương' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 2' }));
  await act(async () =>
    fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' })),
  );
  await waitFor(async () => {
    const [saved] = await readCardScoreMatches(uid);
    expect(saved.rounds[0].scores).toEqual({ [uid]: 2, friend: -2 });
  });
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Đóng nhập điểm' })).toBeNull(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Thêm ván' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 3' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chọn điểm của Friend' }));
  fireEvent.press(screen.getByRole('button', { name: 'Dấu âm/dương' }));
  fireEvent.press(screen.getByRole('button', { name: 'Số 3' }));
  await act(async () =>
    fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' })),
  );
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Đóng nhập điểm' })).toBeNull(),
  );
  const [saved] = await readCardScoreMatches(uid);
  expect(saved.id).toBe(original.id);
  expect(saved.status).toBe('active');
  expect(saved.rounds.map((round) => round.scores)).toEqual([
    { [uid]: 2, friend: -2 },
    { [uid]: 3, friend: -3 },
  ]);
  view.unmount();
  renderScreen();
  expect(await screen.findByRole('button', { name: 'Thêm ván' })).toBeEnabled();
  expect(screen.queryByTestId(`card-score-history-${original.id}`)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Kết thúc bàn chơi' }));
  await act(async () =>
    fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
    ),
  );
  expect(
    await screen.findByTestId(`card-score-history-${original.id}`),
  ).toBeTruthy();
  expect(screen.queryByTestId('card-score-open-table')).toBeNull();
  expect(
    jest
      .mocked(gameRequest)
      .mock.calls.some(([, input]) => input.type === 'score-write'),
  ).toBe(false);
});

it('does not offer shared history deletion or resume to a member without ownership', async () => {
  await seedOnlineScore();
  const server = await exposeSharedBoard(false);
  server.set({
    ...server.get(),
    match: { ...server.get().match, status: 'finished' },
  });
  renderScreen();
  const card = await screen.findByTestId(
    `card-score-history-${server.get().match.id}`,
  );
  expect(
    within(card).queryByRole('button', { name: /Xóa lịch sử bàn/ }),
  ).toBeNull();
  expect(within(card).queryByRole('button', { name: /Mở lại bàn/ })).toBeNull();
  expect(
    within(card).getByRole('button', { name: 'Lịch sử sửa/xóa' }),
  ).toBeEnabled();
});

it('keeps members read-only while allowing room entry and shared audit lookup', async () => {
  await seedOnlineScore();
  await exposeSharedBoard(false);
  renderScreen();
  await screen.findByTestId('card-score-open-table');
  for (const name of [
    'Thêm ván',
    'Bốc thăm người chia bài',
    'Quản lý người chơi',
    'Xóa điểm ván 1',
    'Thêm người chơi vào bàn',
  ]) {
    expect(screen.queryByRole('button', { name })).toBeNull();
  }
  expect(screen.queryByText('Nhập điểm nhanh')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Vào lại phòng ABCDEFGH' }),
  ).toBeEnabled();
  fireEvent.press(screen.getByRole('button', { name: 'Lịch sử sửa/xóa' }));
  await waitFor(() =>
    expect(gameRequest).toHaveBeenCalledWith(
      uid,
      expect.objectContaining({ type: 'score-history' }),
      expect.any(AbortSignal),
    ),
  );
  expect(
    jest
      .mocked(gameRequest)
      .mock.calls.filter(([, input]) => input.type === 'score-write'),
  ).toHaveLength(0);
});
it('waits for the owner of an empty live room without navigating or reopening', async () => {
  await seedOnlineScore();
  await exposeSharedBoard(false);
  const sharedRequests = jest.mocked(gameRequest).getMockImplementation()!;
  jest
    .mocked(gameRequest)
    .mockImplementation(async (account, input, signal) => {
      if (input.type === 'room-status')
        return {
          roomId: input.roomId,
          exists: true,
          owner: false,
          canRejoin: false,
          canReopen: false,
          canDelete: false,
          expired: false,
          phase: 'lobby',
          version: 4,
          matchId: null,
        } as never;
      return sharedRequests(account, input, signal);
    });
  const navigation = { navigate: jest.fn(), addListener: () => jest.fn() };
  render(
    <CardScoreScreen navigation={navigation as never} route={{} as never} />,
  );
  const rejoin = await screen.findByRole('button', {
    name: 'Vào lại phòng ABCDEFGH',
  });
  fireEvent.press(rejoin);
  expect(
    await screen.findByText('Phòng đang chờ chủ phòng vào lại.'),
  ).toBeTruthy();
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(
    jest
      .mocked(gameRequest)
      .mock.calls.some(([, input]) => input.type === 'reopen'),
  ).toBe(false);
  expect(rejoin).toBeEnabled();
});

it('renames the sole player on a shared score board', async () => {
  await seedOnlineScore();
  const server = await exposeSharedBoard();
  const before = server.get();
  server.set({
    ...before,
    match: {
      ...before.match,
      players: [before.match.players[0]],
      seatOrder: [uid],
      rounds: [],
    },
  });
  renderScreen();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Quản lý người chơi' }),
    ).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Quản lý người chơi' }));
  expect(
    screen.getByRole('button', { name: 'Xóa người chơi Player' }),
  ).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), 'Chủ phòng');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() =>
    expect(server.get().match.players).toEqual([
      { id: uid, name: 'Chủ phòng' },
    ]),
  );
});

it('removes the second player from a shared score board while retaining one', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  await seedOnlineScore();
  const server = await exposeSharedBoard();
  renderScreen();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Quản lý người chơi' }),
    ).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Quản lý người chơi' }));
  const remove = screen.getByRole('button', { name: 'Xóa người chơi Friend' });
  expect(remove).toBeEnabled();
  fireEvent.press(remove);
  expect(
    screen.getByRole('button', { name: 'Xóa người chơi Player' }),
  ).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  expect(alert).toHaveBeenCalledWith(
    'Xóa người chơi và điểm?',
    expect.any(String),
    expect.any(Array),
  );
  await act(async () => {
    alert.mock.calls
      .at(-1)?.[2]
      ?.find((action) => action.text === 'Xóa và lưu')
      ?.onPress?.();
  });
  await waitFor(() => expect(server.get().match.players).toHaveLength(1));
  expect(server.get().match.rounds[0].scores).toEqual({ [uid]: 5 });
  alert.mockRestore();
});

it('limits both shared name inputs to 30 and saves the boundary name', async () => {
  await seedOnlineScore();
  const server = await exposeSharedBoard();
  renderScreen();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Quản lý người chơi' }),
    ).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Quản lý người chơi' }));
  expect(screen.getByLabelText('Tên người chơi 1').props.maxLength).toBe(30);
  expect(screen.getByLabelText('Tên người chơi mới').props.maxLength).toBe(30);
  fireEvent.changeText(
    screen.getByLabelText('Tên người chơi 1'),
    'A'.repeat(30),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() =>
    expect(server.get().match.players[0].name).toBe('A'.repeat(30)),
  );
  await waitFor(() =>
    expect(screen.queryByText('Quản lý người chơi')).toBeNull(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Quản lý người chơi' }));
  fireEvent.changeText(
    screen.getByLabelText('Tên người chơi mới'),
    'B'.repeat(30),
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Thêm người chơi vào bàn' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() =>
    expect(server.get().match.players[2].name).toBe('B'.repeat(30)),
  );
});

it.each([
  ['rename', 'A'.repeat(31)],
  ['add', 'A'.repeat(31)],
  ['rename', 'An\u200b'],
  ['add', 'Chi\u200b'],
])(
  'rejects an invalid shared name on %s (%s) before sending a write',
  async (operation, name) => {
    await seedOnlineScore();
    await exposeSharedBoard();
    renderScreen();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Quản lý người chơi' }),
      ).toBeEnabled(),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Quản lý người chơi' }));
    if (operation === 'rename') {
      fireEvent.changeText(screen.getByLabelText('Tên người chơi 1'), name);
      fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    } else {
      fireEvent.changeText(screen.getByLabelText('Tên người chơi mới'), name);
      fireEvent.press(
        screen.getByRole('button', { name: 'Thêm người chơi vào bàn' }),
      );
    }
    expect(
      await screen.findByText(
        name.length > 30 ? /Tên người chơi.*30/ : /ký tự điều khiển/,
      ),
    ).toBeTruthy();
    expect(
      jest
        .mocked(gameRequest)
        .mock.calls.some(([, input]) => input.type === 'score-write'),
    ).toBe(false);
  },
);

it.each([false, true])(
  'preserves two-player minimum and 32-character names on non-shared tables (legacy: %s)',
  async (legacy) => {
    const match = await cardStorage.createCardScoreMatch(uid, {
      title: 'Bàn cũ',
      players: [
        { id: 'a', name: 'An' },
        { id: 'b', name: 'Bình' },
      ],
      seatOrder: ['a', 'b'],
      dealerPlayerId: 'a',
      ...(legacy
        ? { onlineRoomId: 'room-legacy', onlineRoomCode: 'ABCDEFGH' }
        : {}),
    });
    if (legacy) {
      await cardStorage.updateCardScoreMatch(uid, {
        ...match,
        localScoreEditable: true,
      });
      mockLegacyOwner();
    }
    renderScreen();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Quản lý người chơi' }),
      ).toBeEnabled(),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Quản lý người chơi' }));
    expect(screen.getByLabelText('Tên người chơi 1').props.maxLength).toBe(32);
    expect(screen.getByLabelText('Tên người chơi mới').props.maxLength).toBe(
      32,
    );
    expect(
      screen.getByRole('button', { name: 'Xóa người chơi Bình' }),
    ).toBeDisabled();
    fireEvent.changeText(
      screen.getByLabelText('Tên người chơi 1'),
      'A'.repeat(32),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(async () =>
      expect((await readCardScoreMatches(uid))[0].players[0].name).toBe(
        'A'.repeat(32),
      ),
    );
  },
);

it('keeps the editor player list and revision fixed across a refresh', async () => {
  await seedOnlineScore();
  const server = await exposeSharedBoard();
  const focus: (() => void)[] = [];
  render(
    <CardScoreScreen
      navigation={
        {
          navigate: jest.fn(),
          addListener: (event: string, callback: () => void) => {
            if (event === 'focus') focus.push(callback);
            return jest.fn();
          },
        } as never
      }
      route={{} as never}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Thêm ván' })).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Sửa điểm ván 1' }));
  const before = server.get();
  server.set({
    ...before,
    match: {
      ...before.match,
      sharedVersion: 2,
      players: before.match.players.map((player) => ({
        ...player,
        name: player.id === uid ? 'Tên mới' : player.name,
      })),
      rounds: [
        { ...before.match.rounds[0], scores: { [uid]: 99, friend: -99 } },
      ],
    },
  });
  await act(async () => {
    focus.forEach((callback) => callback());
  });
  await waitFor(() =>
    expect(
      within(screen.getByTestId('card-score-table-grid')).getByText('Tên mới'),
    ).toBeTruthy(),
  );
  expect(
    screen.getByRole('button', { name: 'Chọn điểm của Player' }),
  ).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Chọn điểm của Tên mới' }),
  ).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Lưu ván' }));
  expect(await screen.findAllByText(/Bảng điểm vừa thay đổi/)).not.toHaveLength(
    0,
  );
  expect(screen.getByText('Sửa điểm ván')).toBeTruthy();
  expect(server.get().match.rounds[0].scores[uid]).toBe(99);
  expect(
    jest
      .mocked(gameRequest)
      .mock.calls.find(([, input]) => input.type === 'score-write')?.[1]
      .expectedVersion,
  ).toBe(1);
});
it('rechecks server ownership when an already-open finish confirmation is accepted', async () => {
  await seedOnlineScore();
  const server = await exposeSharedBoard();
  renderScreen();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Thêm ván' })).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Kết thúc bàn chơi' }));
  server.set({ ...server.get(), canEdit: false });
  fireEvent.press(
    screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
  );
  expect(await screen.findAllByText(/Chỉ chủ phòng hiện tại/)).not.toHaveLength(
    0,
  );
  expect(server.get().match.status).toBe('active');
  expect(screen.getByText('Kết thúc bàn chơi?')).toBeTruthy();
});
it('shows manual score corrections and preserves audit after deleting the table', async () => {
  let match = await cardStorage.createCardScoreMatch(uid, {
    title: 'Bàn có lịch sử',
    players: [
      { id: 'p1', name: 'An' },
      { id: 'p2', name: 'Bình' },
    ],
    seatOrder: ['p1', 'p2'],
    dealerPlayerId: 'p1',
  });
  match = await cardStorage.updateCardScoreMatch(
    uid,
    {
      ...match,
      rounds: [{ id: 'r1', createdAt: 1, scores: { p1: 5, p2: -5 } }],
    },
    { actorName: 'Player' },
  );
  await cardStorage.updateCardScoreMatch(
    uid,
    {
      ...match,
      rounds: [{ ...match.rounds[0], scores: { p1: 9, p2: -9 } }],
      status: 'finished',
    },
    { actorName: 'Player' },
  );
  renderScreen();
  fireEvent.press(
    await screen.findByRole('button', { name: 'Lịch sử sửa/xóa' }),
  );
  expect(await screen.findByLabelText('An: 5 → 9')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Đóng lịch sử sửa/xóa' }));
  const confirm = jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) =>
      buttons?.find((button) => button.text === 'Xóa bàn')?.onPress?.(),
    );
  fireEvent.press(screen.getByRole('button', { name: /Xóa lịch sử bàn/ }));
  await waitFor(() =>
    expect(screen.queryByTestId(`card-score-history-${match.id}`)).toBeNull(),
  );
  expect(screen.queryByRole('button', { name: 'Lịch sử sửa/xóa' })).toBeNull();
  expect(screen.queryByText('Khôi phục')).toBeNull();
  const [deleted] = await readCardScoreMatches(uid, { includeDeleted: true });
  expect(
    deleted.audit?.flatMap((event) =>
      event.changes.map((change) => change.kind),
    ),
  ).toEqual(expect.arrayContaining(['round-edit', 'table-delete']));
  confirm.mockRestore();
});

it.each([false, null])(
  'hides owner controls on reopened device-only online scores (owner: %s)',
  async (owner) => {
    await seedOnlineScore();
    const [match] = await readCardScoreMatches(uid);
    await cardStorage.updateCardScoreMatch(uid, {
      ...match,
      localScoreEditable: true,
    });
    jest.mocked(gameRequest).mockImplementation(async (_account, input) => {
      if (input.type === 'score-list') return { tables: [] } as never;
      if (input.type === 'room-status' && owner !== null)
        return {
          ...expiredOwner,
          roomId: match.onlineRoomId,
          owner,
          canReopen: false,
          expired: false,
          canRejoin: true,
        } as never;
      throw new Error('offline');
    });
    renderScreen();
    await screen.findByTestId('card-score-open-table');
    await waitFor(() =>
      expect(gameRequest).toHaveBeenCalledWith(
        uid,
        expect.objectContaining({ type: 'room-status' }),
        expect.any(AbortSignal),
      ),
    );
    for (const name of [
      'Bốc thăm người chia bài',
      'Thêm ván',
      'Quản lý người chơi',
      'Xóa điểm ván 1',
      'Thêm người chơi vào bàn',
    ])
      expect(screen.queryByRole('button', { name })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Lịch sử sửa/xóa' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Vào lại phòng ABCDEFGH' }),
    ).toBeEnabled();
  },
);

it('rejects a legacy delete confirmation after the room owner changes', async () => {
  await seedOnlineScore();
  mockLegacyOwner();
  const [match] = await readCardScoreMatches(uid);
  renderScreen();
  fireEvent.press(
    await screen.findByRole('button', {
      name: `Xem bảng điểm bàn ${match.title}`,
    }),
  );
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  fireEvent.press(
    await screen.findByRole('button', { name: /Xóa lịch sử bàn/ }),
  );
  jest.mocked(gameRequest).mockImplementation(async (_account, input) => {
    if (input.type === 'score-list') return { tables: [] } as never;
    if (input.type === 'room-status')
      return { ...expiredOwner, roomId: input.roomId, owner: false } as never;
    throw new Error('Unexpected request');
  });
  await act(async () => {
    alert.mock.calls[0][2]
      ?.find((button) => button.text === 'Xóa bàn')
      ?.onPress?.();
  });
  expect(
    await screen.findByText(
      'Chỉ chủ phòng hiện tại mới được sửa/xóa bảng điểm.',
    ),
  ).toBeTruthy();
  expect((await readCardScoreMatches(uid))[0].rounds).toEqual(match.rounds);
  expect((await readCardScoreMatches(uid))[0].deletedAt).toBeUndefined();
  alert.mockRestore();
});

it.each(['not-owner', 'offline'])(
  'hides legacy owner controls after a rejected permission recheck (%s)',
  async (failure) => {
    await seedOnlineScore();
    mockLegacyOwner();
    const [match] = await readCardScoreMatches(uid);
    await cardStorage.updateCardScoreMatch(uid, {
      ...match,
      localScoreEditable: true,
    });
    renderScreen();
    await screen.findByRole('button', { name: 'Thêm ván' });
    fireEvent.press(
      screen.getByRole('button', { name: 'Bốc thăm người chia bài' }),
    );
    const lookup = jest.mocked(gameRequest).getMockImplementation()!;
    // The ownership check has not started until the device session promise resolves.
    jest
      .mocked(gameRequest)
      .mockImplementation(async (account, input, signal) => {
        if (input.type === 'room-status') {
          if (failure === 'offline') throw new Error('offline');
          return {
            ...expiredOwner,
            roomId: input.roomId,
            owner: false,
          } as never;
        }
        return lookup(account, input, signal);
      });
    await screen.findByText(
      failure === 'offline'
        ? 'offline'
        : 'Chỉ chủ phòng hiện tại mới được sửa/xóa bảng điểm.',
    );
    for (const name of [
      'Bốc thăm người chia bài',
      'Thêm ván',
      'Quản lý người chơi',
      'Xóa điểm ván 1',
    ])
      expect(screen.queryByRole('button', { name })).toBeNull();
    expect((await readCardScoreMatches(uid))[0].rounds).toEqual(match.rounds);
  },
);

it.each([false, true])(
  'lets a member finish locally and reopen read-only (shared: %s)',
  async (canonical) => {
    await seedOnlineScore();
    const [original] = await readCardScoreMatches(uid);
    if (canonical) await exposeSharedBoard(false);
    else
      await cardStorage.updateCardScoreMatch(uid, {
        ...original,
        localScoreEditable: true,
      });
    const view = renderScreen();
    fireEvent.press(
      await screen.findByRole('button', { name: 'Kết thúc bàn chơi' }),
    );
    expect(
      screen.getByText(
        'Bảng điểm sẽ được lưu vào lịch sử trên thiết bị này. Phòng và bảng điểm chung vẫn tiếp tục.',
      ),
    ).toBeTruthy();
    fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
    );
    const history = await screen.findByTestId(
      `card-score-history-${original.id}`,
    );
    expect(screen.queryByTestId('card-score-open-table')).toBeNull();
    expect((await readCardScoreMatches(uid))[0]).toMatchObject({
      localFinished: true,
      status: 'active',
      rounds: original.rounds,
    });
    // A fresh server read may update content, but cannot undo a local finish.
    if (canonical)
      await cardStorage.cacheSharedCardScoreMatches(
        uid,
        [{ ...original, sharedVersion: 2 }],
        true,
      );
    view.unmount();
    renderScreen();
    const reloaded = await screen.findByTestId(
      `card-score-history-${original.id}`,
    );
    expect(screen.queryByTestId('card-score-open-table')).toBeNull();
    expect(
      within(reloaded).queryByRole('button', { name: /Xóa lịch sử bàn/ }),
    ).toBeNull();
    fireEvent.press(
      within(reloaded).getByRole('button', {
        name: `Mở lại bàn ${original.title}`,
      }),
    );
    expect(
      await screen.findByRole('button', { name: 'Kết thúc bàn chơi' }),
    ).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Thêm ván' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa điểm ván 1' })).toBeNull();
    expect(
      jest
        .mocked(gameRequest)
        .mock.calls.filter(([, input]) => input.type === 'score-write'),
    ).toHaveLength(0);
    expect(history).toBeTruthy();
  },
);

it('clears local finish when an owner resumes a remotely finished board', async () => {
  await seedOnlineScore();
  const server = await exposeSharedBoard();
  const original = server.get().match;
  await cardStorage.setCardScoreLocalFinished(uid, original.id, true);
  const remote = { ...original, status: 'finished' as const };
  delete remote.localFinished;
  server.set({ ...server.get(), match: remote });
  renderScreen();
  fireEvent.press(
    await screen.findByRole('button', { name: `Mở lại bàn ${original.title}` }),
  );
  expect(await screen.findByRole('button', { name: 'Thêm ván' })).toBeEnabled();
  const [saved] = await readCardScoreMatches(uid);
  expect(saved.status).toBe('active');
  expect(saved.localFinished).toBeUndefined();
  expect(
    jest
      .mocked(gameRequest)
      .mock.calls.filter(([, input]) => input.type === 'score-write'),
  ).toHaveLength(1);
});
it.each([false, true])(
  'hides previously cached and remotely deleted boards (owner: %s)',
  async (owner) => {
    await seedOnlineScore();
    const server = await exposeSharedBoard(owner);
    const original = server.get().match;
    await cardStorage.setCardScoreLocalFinished(uid, original.id, true);
    const remote = { ...original, status: 'finished' as const, deletedAt: 123 };
    delete remote.localFinished;
    await cardStorage.cacheSharedCardScoreMatches(uid, [remote]);
    server.set({ ...server.get(), match: remote });
    renderScreen();
    await screen.findByText('Sẵn sàng ghi điểm?');
    await waitFor(() =>
      expect(gameRequest).toHaveBeenCalledWith(
        uid,
        expect.objectContaining({ type: 'score-list' }),
        expect.any(AbortSignal),
      ),
    );
    expect(
      screen.queryByTestId(`card-score-history-${original.id}`),
    ).toBeNull();
    expect(screen.queryByTestId('card-score-open-table')).toBeNull();
    expect(screen.queryByText('Khôi phục')).toBeNull();
    expect(
      jest
        .mocked(gameRequest)
        .mock.calls.some(([, input]) => input.type === 'score-write'),
    ).toBe(false);
  },
);
it('keeps a failed local finish open for retry without changing shared scores', async () => {
  await seedOnlineScore();
  await exposeSharedBoard(false);
  renderScreen();
  fireEvent.press(
    await screen.findByRole('button', { name: 'Kết thúc bàn chơi' }),
  );
  const save = jest
    .spyOn(cardStorage, 'setCardScoreLocalFinished')
    .mockRejectedValueOnce(new Error('Disk full'));
  fireEvent.press(
    screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
  );
  expect(await screen.findAllByText('Disk full')).not.toHaveLength(0);
  expect(screen.getByText('Kết thúc bàn chơi?')).toBeTruthy();
  expect((await readCardScoreMatches(uid))[0].localFinished).toBeUndefined();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
    ).toBeEnabled(),
  );
  await act(async () => {
    fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận kết thúc bàn' }),
    );
  });
  await waitFor(() =>
    expect(screen.queryByTestId('card-score-open-table')).toBeNull(),
  );
  expect((await readCardScoreMatches(uid))[0].localFinished).toBe(true);
  expect(
    jest
      .mocked(gameRequest)
      .mock.calls.filter(([, input]) => input.type === 'score-write'),
  ).toHaveLength(0);
  save.mockRestore();
});

it('hides online entry after allowlist access is revoked without hiding the score board', async () => {
  await seedOnlineScore();
  await exposeSharedBoard(false);
  renderScreen();
  await screen.findByTestId('card-score-open-table');
  expect(
    screen.getByRole('button', { name: 'Vào lại phòng ABCDEFGH' }),
  ).toBeTruthy();
  act(() => useConfigStore.setState({ gameUsers: [] }));
  expect(
    screen.queryByRole('button', { name: 'Vào lại phòng ABCDEFGH' }),
  ).toBeNull();
  expect(screen.getByTestId('card-score-open-table')).toBeTruthy();
});
