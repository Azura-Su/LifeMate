import { Button } from '../../../components/Button';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react-native';
import {
  Alert,
  Animated,
  BackHandler,
  Modal,
  Platform,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CardGamesScreen } from '../CardGamesScreen';
import { styles } from '../CardGamesScreen.styles';
import { useCardGame } from '../../../hooks/useCardGame';
import { useCardGameOrientation } from '../../../hooks/useCardGameOrientation';
import { useAuthStore } from '../../../store/authStore';
import { useConfigStore } from '../../../store/configStore';
import type { CardGameRoom } from '../../../types/cardGame';
import { phomRoom } from '../../../testing/phomFixture';
import { DEFAULT_PHOM_CONFIG } from '../../../services/cardGames/phomConfig';
import * as cardStorage from '../../../services/cardScore/cardScoreStorage';
import {
  getCachedRoomSnapshot,
  loadCachedRoomSnapshot,
  saveRoomSnapshot,
} from '../../../services/cardGames/roomSnapshotCache';

jest.mock('../CardGameAvatarImage', () => ({
  CardGameAvatarImage: () => null,
}));
jest.mock('../../../services/firebase/remoteConfigService', () => ({}));
jest.mock('../../../hooks/useCardGame', () => ({ useCardGame: jest.fn() }));
jest.mock('../../../hooks/useCardGameOrientation', () => ({
  useCardGameOrientation: jest.fn(),
}));
jest.mock('../../../services/cardGames/roomSnapshotCache', () => ({
  clearCachedRoomSnapshot: jest.fn(async () => undefined),
  getCachedRoomSnapshot: jest.fn(() => null),
  loadCachedRoomSnapshot: jest.fn(async () => null),
  saveRoomSnapshot: jest.fn(async () => undefined),
}));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('react-native-screens', () => ({
  Screen: jest.requireActual('react-native').View,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 12, left: 0, right: 0 }),
}));
const send = jest.fn(),
  retry = jest.fn(),
  retrySessionInitialization = jest.fn();

it('selects the South finish mode from a dropdown and creates with its independent two-cut fine', () => {
  setup();
  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn Tiến lên miền Nam' }),
  );
  fireEvent.press(
    screen.getByRole('radio', { name: 'Có người về nhất thì dừng ngay' }),
  );
  fireEvent.changeText(
    screen.getByLabelText('Số tiền phạt cho mỗi lá 2 bị chặt'),
    '2500',
  );
  fireEvent.changeText(
    screen.getByLabelText('Số tiền trừ cho mỗi lá còn lại'),
    '1000',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Tạo phòng' }));
  expect(send).toHaveBeenCalledWith({
    type: 'create',
    name: expect.any(String),
    game: 'south',
    amountPerCard: 1000,
    southConfig: { finishMode: 'first-winner', cutTwoAmount: 2500 },
  });
});

it('keeps the old South mode selected and rejects an empty or excessive two-cut fine', () => {
  setup();
  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn Tiến lên miền Nam' }),
  );
  expect(screen.getByText('Đánh tiếp đến hết ván')).toBeTruthy();
  fireEvent.changeText(
    screen.getByLabelText('Số tiền phạt cho mỗi lá 2 bị chặt'),
    '',
  );
  expect(screen.getByRole('button', { name: 'Tạo phòng' })).toBeDisabled();
  fireEvent.changeText(
    screen.getByLabelText('Số tiền phạt cho mỗi lá 2 bị chặt'),
    '1000000001',
  );
  expect(screen.getByRole('button', { name: 'Tạo phòng' })).toBeDisabled();
  fireEvent.changeText(
    screen.getByLabelText('Số tiền phạt cho mỗi lá 2 bị chặt'),
    '0',
  );
  expect(screen.getByRole('button', { name: 'Tạo phòng' })).toBeEnabled();
});

it('uses the actual legacy room defaults in rules after a different South draft was selected', () => {
  const navigation = { navigate: jest.fn() };
  const view = setup(null, false, 'a', null, navigation);
  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn Tiến lên miền Nam' }),
  );
  fireEvent.press(
    screen.getByRole('radio', { name: 'Có người về nhất thì dừng ngay' }),
  );
  fireEvent.changeText(
    screen.getByLabelText('Số tiền phạt cho mỗi lá 2 bị chặt'),
    '17',
  );
  const previous = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest.mocked(useCardGame).mockReturnValue({
    ...previous,
    state: {
      ...previous.state!,
      snapshot: {
        room: { ...base, amountPerCard: 5 },
        serverTime: Date.now(),
      },
    },
  });
  view.rerender(
    <CardGamesScreen navigation={navigation as never} route={{} as never} />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  fireEvent.press(screen.getByRole('button', { name: 'Xem luật chơi' }));
  expect(screen.getByText('Đánh tiếp đến hết ván')).toBeTruthy();
  expect(screen.getByText(/Chặt 2: 0 đ\/lá 2/)).toBeTruthy();
  expect(screen.queryByText(/Chặt 2: 17 đ\/lá 2/)).toBeNull();
});
const base: CardGameRoom = {
  id: 'room',
  code: 'ABCDEFGH',
  version: 1,
  epoch: 'epoch',
  matchId: null,
  phase: 'lobby',
  host: 'a',
  controller: true,
  topic: 'topic',
  members: [
    { uid: 'a', name: 'An', ready: false, wins: 0 },
    { uid: 'b', name: 'Bình', ready: false, wins: 0 },
  ],
  game: null,
};
function setup(
  room: CardGameRoom | null = null,
  loading = false,
  uid = 'a',
  sessionInitializationError: string | null = null,
  navigation = { navigate: jest.fn() },
) {
  jest.mocked(useCardGame).mockReturnValue({
    enabled: true,
    active: true,
    uid,
    session: { send, retry } as never,
    sessionInitializationError,
    retrySessionInitialization,
    state: {
      snapshot: { room, serverTime: Date.now() },
      loading,
      connected: true,
      busy: false,
      pending: false,
      error: null,
    },
  });
  return render(
    <CardGamesScreen navigation={navigation as never} route={{} as never} />,
  );
}

it('opens Phỏm configuration and sends all independently editable rates', () => {
  setup();
  fireEvent.press(screen.getByRole('button', { name: 'Chọn Phỏm' }));
  fireEvent.changeText(screen.getByLabelText('Mức Nhì'), '123');
  fireEvent.press(screen.getByRole('button', { name: 'Tạo phòng Phỏm' }));
  expect(send).toHaveBeenCalledWith({
    type: 'create',
    name: expect.any(String),
    game: 'phom',
    phomConfig: {
      ...DEFAULT_PHOM_CONFIG,
      second: 123,
      options: { tai: false, send: true, uDen: true },
    },
  });
});
it('renders a Phỏm snapshot using its own table, header and rules instead of South actions', () => {
  setup(phomRoom());
  expect(screen.getByTestId('phom-table')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Phỏm' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Bỏ lượt' })).toBeNull();
});

it('keeps the room visible but disables readiness until reconnect has loaded a fresh snapshot', () => {
  const view = setup(base, true);
  expect(screen.getByTestId('lobby-game-table')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Vào phòng' })).toBeNull();
  const ready = screen.getByRole('button', { name: 'Sẵn sàng' });
  expect(ready).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Quay lại Trò chơi & điểm số' }),
  ).toBeDisabled();
  fireEvent.press(ready);
  expect(send).not.toHaveBeenCalled();

  const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest.mocked(useCardGame).mockReturnValue({
    ...current,
    state: { ...current.state, loading: false },
  });
  view.rerender(
    <CardGamesScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );
  expect(screen.getByRole('button', { name: 'Sẵn sàng' })).toBeEnabled();
  expect(
    screen.getByRole('button', { name: 'Quay lại Trò chơi & điểm số' }),
  ).toBeEnabled();
  fireEvent.press(screen.getByRole('button', { name: 'Sẵn sàng' }));
  expect(send).toHaveBeenCalledWith({ type: 'ready', ready: true });
});

it.each(['header', 'hardware'])(
  'allows returning via %s after a failed reconnect without claiming a confirmed room exit',
  async (method) => {
    let hardwareBack!: () => boolean | null | undefined;
    if (method === 'hardware') {
      jest.replaceProperty(Platform, 'OS', 'android');
      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_event, handler) => {
          hardwareBack = handler;
          return { remove: jest.fn() };
        });
    }
    const alert = jest.spyOn(Alert, 'alert');
    const navigation = { navigate: jest.fn() };
    const view = setup(base, true, 'a', null, navigation);
    const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
    jest.mocked(useCardGame).mockReturnValue({
      ...current,
      state: { ...current.state!, error: 'Mất kết nối' },
    });
    view.rerender(
      <CardGamesScreen navigation={navigation as never} route={{} as never} />,
    );
    expect(screen.getByRole('button', { name: 'Sẵn sàng' })).toBeDisabled();
    const back = screen.getByRole('button', {
      name: 'Quay lại Trò chơi & điểm số',
    });
    expect(back).toBeEnabled();
    if (method === 'hardware')
      act(() => {
        expect(hardwareBack()).toBe(true);
      });
    else fireEvent.press(back);
    expect(alert).toHaveBeenCalledWith(
      'Quay lại màn trước?',
      expect.stringContaining('chưa xác nhận rời phòng'),
      expect.any(Array),
    );
    await act(async () => {
      alert.mock.calls
        .at(-1)?.[2]
        ?.find((button) => button.text === 'Quay lại')
        ?.onPress?.();
    });
    expect(navigation.navigate).toHaveBeenCalledWith('CardScore');
    expect(send).not.toHaveBeenCalled();
  },
);

it('offers a session initialization retry without retrying a missing session', () => {
  setup(null, false, 'a', 'Chưa khôi phục được phiên chơi trên thiết bị này.');

  expect(
    screen.getByText('Chưa khôi phục được phiên chơi trên thiết bị này.'),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
  expect(retrySessionInitialization).toHaveBeenCalledTimes(1);
  expect(retry).not.toHaveBeenCalled();
});
beforeEach(() => {
  useConfigStore.setState({ gameUsers: ['a@example.invalid'] });
  send.mockClear();
  jest.restoreAllMocks();
  jest.mocked(getCachedRoomSnapshot).mockReset().mockReturnValue(null);
  jest.mocked(loadCachedRoomSnapshot).mockReset().mockResolvedValue(null);
  jest.mocked(saveRoomSnapshot).mockReset().mockResolvedValue(undefined);
  useAuthStore
    .getState()
    .setUser({ uid: 'a', email: 'a@example.invalid', displayName: 'An' });
});

it('uses a compact header only for landscape game layouts', () => {
  expect(StyleSheet.flatten(styles.landscapeFixedHeader)).toMatchObject({
    paddingTop: 0,
    paddingBottom: 0,
  });
  expect(StyleSheet.flatten(styles.landscapeHeader)).toMatchObject({
    minHeight: 34,
  });
  expect(StyleSheet.flatten(styles.landscapeIconButton)).toMatchObject({
    minHeight: 34,
  });
  expect(StyleSheet.flatten(styles.landscapeTitle)).toMatchObject({
    fontSize: 18,
    lineHeight: 22,
  });
});

it('does not connect or show session loading before a room action', () => {
  setup(null, true);

  expect(useCardGame).toHaveBeenLastCalledWith(false);
  expect(screen.queryByLabelText('Đang mở phòng online')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Chọn Tiến lên miền Nam' }),
  ).toBeTruthy();

  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn Tiến lên miền Nam' }),
  );
  expect(useCardGame).toHaveBeenLastCalledWith(false);
  expect(screen.queryByLabelText('Đang mở phòng online')).toBeNull();
  expect(screen.getByRole('button', { name: 'Tạo phòng' })).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Tạo phòng' }));
  expect(useCardGame).toHaveBeenLastCalledWith(true);
});

it('keeps online mode tabs fixed while the catalog scrolls without pull refresh', () => {
  setup();
  expect(
    within(screen.getByTestId('screen-fixed-content')).getByRole('tab', {
      name: 'Chơi online',
    }),
  ).toBeTruthy();
  const body = screen.getByTestId('screen-scroll-area');
  expect(within(body).queryByRole('tablist')).toBeNull();
  expect(
    within(body).getByRole('button', { name: 'Chọn Tiến lên miền Nam' }),
  ).toBeTruthy();
  expect(body.props.refreshControl).toBeUndefined();
  expect(useCardGame).toHaveBeenLastCalledWith(false);
  expect(send).not.toHaveBeenCalled();
});

it('automatically joins a room opened from its score table', async () => {
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  jest.mocked(useCardGame).mockReturnValue({
    enabled: true,
    active: true,
    uid: 'a',
    session: { send, retry } as never,
    sessionInitializationError: null,
    retrySessionInitialization,
    state: {
      snapshot: { room: null, serverTime: Date.now() },
      loading: false,
      connected: true,
      busy: false,
      pending: false,
      error: null,
    },
  });
  const view = render(
    <CardGamesScreen navigation={navigation as never} route={{} as never} />,
  );

  const finishedRoom: CardGameRoom = {
    ...base,
    code: 'F96KMCTG',
    phase: 'finished',
    matchId: 'previous-match',
    members: base.members.map((member) => ({ ...member, ready: false })),
    game: {
      rulesVersion: 'south-v1',
      status: 'finished',
      hand: [],
      players: [
        { uid: 'a', count: 0, finished: true, forfeited: false },
        { uid: 'b', count: 13, finished: false, forfeited: false },
      ],
      turn: null,
      table: null,
      passed: [],
      openingCard: null,
      deadline: null,
      result: {
        reason: 'completed',
        ranking: [{ uid: 'a', rank: 1, labels: [], moneyDelta: 0 }],
      },
    },
  };
  jest.mocked(useCardGame).mockReturnValue({
    enabled: true,
    active: true,
    uid: 'a',
    session: { send, retry } as never,
    sessionInitializationError: null,
    retrySessionInitialization,
    state: {
      snapshot: { room: finishedRoom, serverTime: Date.now() },
      loading: false,
      connected: true,
      busy: false,
      pending: false,
      error: null,
    },
  });
  view.rerender(
    <CardGamesScreen navigation={navigation as never} route={{} as never} />,
  );
  expect(screen.getByTestId('hand-area')).toBeTruthy();

  jest.mocked(useCardGame).mockReturnValue({
    enabled: true,
    active: true,
    uid: 'a',
    session: { send, retry } as never,
    sessionInitializationError: null,
    retrySessionInitialization,
    state: {
      snapshot: { room: null, serverTime: Date.now() },
      loading: false,
      connected: true,
      busy: false,
      pending: false,
      error: null,
    },
  });
  view.rerender(
    <CardGamesScreen
      navigation={navigation as never}
      route={{ params: { roomCode: 'F96KMCTG' } } as never}
    />,
  );
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith({
      type: 'join',
      name: 'An',
      code: 'F96KMCTG',
    }),
  );
  expect(navigation.setParams).toHaveBeenCalledWith({ roomCode: undefined });
  expect(screen.getByTestId('hand-area')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Sẵn sàng' }).props.accessibilityState,
  ).toMatchObject({ busy: true, disabled: true });

  const playingRoom: CardGameRoom = {
    ...base,
    phase: 'playing',
    matchId: 'rejoined-match',
    game: {
      rulesVersion: 'south-v1',
      status: 'playing',
      hand: [0, 5, 10],
      players: [
        { uid: 'a', count: 3, finished: false, forfeited: false },
        { uid: 'b', count: 3, finished: false, forfeited: false },
      ],
      turn: 'a',
      table: null,
      passed: [],
      openingCard: 0,
      deadline: Date.now() + 15000,
      result: null,
    },
  };
  jest.mocked(useCardGame).mockReturnValue({
    enabled: true,
    active: true,
    uid: 'a',
    session: { send, retry } as never,
    sessionInitializationError: null,
    retrySessionInitialization,
    state: {
      snapshot: { room: playingRoom, serverTime: Date.now() },
      loading: false,
      connected: true,
      busy: false,
      pending: false,
      error: null,
    },
  });
  view.rerender(
    <CardGamesScreen
      navigation={navigation as never}
      route={{ params: { roomCode: 'F96KMCTG' } } as never}
    />,
  );
  expect(screen.getByTestId('hand-area')).toBeTruthy();
  expect(screen.queryByText('Đang vào lại bàn…')).toBeNull();
});

it('shows the ready table while rejoining when no room snapshot is cached', () => {
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  jest.mocked(useCardGame).mockReturnValue({
    enabled: true,
    active: true,
    uid: 'a',
    session: { send, retry } as never,
    sessionInitializationError: null,
    retrySessionInitialization,
    state: {
      snapshot: { room: null, serverTime: Date.now() },
      loading: false,
      connected: true,
      busy: false,
      pending: false,
      error: null,
    },
  });

  render(
    <CardGamesScreen
      navigation={navigation as never}
      route={{ params: { roomCode: 'F96KMCTG' } } as never}
    />,
  );

  expect(screen.getByTestId('lobby-game-table')).toBeTruthy();
  expect(screen.queryByText('Đang vào lại bàn…')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Sẵn sàng' }).props.accessibilityState,
  ).toMatchObject({ busy: true, disabled: true });
});

it('opens the cached table immediately when the room screen is mounted again', async () => {
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  const finishedRoom: CardGameRoom = {
    ...base,
    phase: 'finished',
    matchId: 'finished-match',
    members: base.members.map((member) => ({ ...member, ready: false })),
    game: {
      rulesVersion: 'south-v1',
      status: 'finished',
      hand: [],
      players: [
        { uid: 'a', count: 0, finished: true, forfeited: false },
        { uid: 'b', count: 13, finished: false, forfeited: false },
      ],
      turn: null,
      table: null,
      passed: [],
      openingCard: null,
      deadline: null,
      result: null,
    },
  };
  jest.mocked(getCachedRoomSnapshot).mockReturnValue({
    room: finishedRoom,
    serverTime: 100,
  });
  jest.mocked(useCardGame).mockReturnValue({
    enabled: true,
    active: true,
    uid: 'a',
    session: { send, retry } as never,
    sessionInitializationError: null,
    retrySessionInitialization,
    state: {
      snapshot: { room: null, serverTime: 101 },
      loading: false,
      connected: true,
      busy: false,
      pending: false,
      error: null,
    },
  });

  const view = render(
    <CardGamesScreen
      navigation={navigation as never}
      route={{ params: { roomCode: base.code } } as never}
    />,
  );

  expect(screen.getByTestId('hand-area')).toBeTruthy();
  expect(screen.queryByText('Đang vào lại bàn…')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Sẵn sàng' }).props.accessibilityState,
  ).toMatchObject({ busy: true, disabled: true });

  view.unmount();
  jest.mocked(getCachedRoomSnapshot).mockReturnValue(null);
  jest.mocked(loadCachedRoomSnapshot).mockResolvedValue({
    room: finishedRoom,
    serverTime: 100,
  });
  render(
    <CardGamesScreen
      navigation={navigation as never}
      route={{ params: { roomCode: base.code } } as never}
    />,
  );
  await waitFor(() => expect(screen.getByTestId('hand-area')).toBeTruthy());
});

it.each(['header', 'hardware'])(
  'clears the cached table immediately when backing out via %s of a pending rejoin',
  (method) => {
    let hardwareBack!: () => boolean | null | undefined;
    if (method === 'hardware') {
      jest.replaceProperty(Platform, 'OS', 'android');
      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_event, handler) => {
          hardwareBack = handler;
          return { remove: jest.fn() };
        });
    }
    const navigation = { navigate: jest.fn(), setParams: jest.fn() };
    const finishedRoom: CardGameRoom = {
      ...base,
      phase: 'finished',
      matchId: 'finished-match',
      members: base.members.map((member) => ({ ...member, ready: false })),
      game: {
        rulesVersion: 'south-v1',
        status: 'finished',
        hand: [],
        players: [
          { uid: 'a', count: 0, finished: true, forfeited: false },
          { uid: 'b', count: 13, finished: false, forfeited: false },
        ],
        turn: null,
        table: null,
        passed: [],
        openingCard: null,
        deadline: null,
        result: null,
      },
    };
    const view = setup(finishedRoom, false, 'a', null, navigation);
    jest.mocked(useCardGame).mockReturnValue({
      ...jest.mocked(useCardGame).mock.results.at(-1)!.value,
      state: {
        snapshot: { room: null, serverTime: Date.now() },
        loading: false,
        connected: true,
        busy: false,
        pending: false,
        error: null,
      },
    });
    view.rerender(
      <CardGamesScreen
        navigation={navigation as never}
        route={{ params: { roomCode: base.code } } as never}
      />,
    );
    expect(screen.getByTestId('hand-area')).toBeTruthy();

    const commandsBeforeBack = send.mock.calls.length;
    if (method === 'hardware')
      act(() => {
        expect(hardwareBack()).toBe(true);
      });
    else
      fireEvent.press(
        screen.getByRole('button', { name: 'Quay lại Trò chơi & điểm số' }),
      );

    expect(navigation.navigate).toHaveBeenCalledWith('CardScore');
    expect(screen.queryByTestId('hand-area')).toBeNull();
    expect(send).toHaveBeenCalledTimes(commandsBeforeBack);
    expect(send).not.toHaveBeenCalledWith({ type: 'leave' });
  },
);

it('reopens the current room without sending a duplicate join', () => {
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  jest.mocked(useCardGame).mockReturnValue({
    enabled: true,
    active: true,
    uid: 'a',
    session: { send, retry } as never,
    sessionInitializationError: null,
    retrySessionInitialization,
    state: {
      snapshot: { room: base, serverTime: Date.now() },
      loading: false,
      connected: true,
      busy: false,
      pending: false,
      error: null,
    },
  });
  render(
    <CardGamesScreen
      navigation={navigation as never}
      route={{ params: { roomCode: 'ABCDEFGH' } } as never}
    />,
  );

  expect(screen.getByTestId('lobby-game-table')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sẵn sàng' })).toBeTruthy();
  expect(send).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: 'join' }),
  );
});

it('lets the current owner transfer room ownership to a seated player', () => {
  setup(base);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  render(
    <CardGamesScreen
      navigation={{ navigate: jest.fn(), setParams: jest.fn() } as never}
      route={{} as never}
    />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  fireEvent.press(screen.getByRole('button', { name: 'Chuyển chủ phòng' }));
  const transfer = alert.mock.calls[0][2]?.find(
    (button) => button.text === 'Bình',
  );
  act(() => transfer?.onPress?.());

  expect(send).toHaveBeenCalledWith({ type: 'transfer-owner', targetUid: 'b' });
  alert.mockRestore();
});

it('offers supported games, keeps unfinished games unavailable, and opens the South lobby', () => {
  setup();
  expect(
    screen.getByRole('header', { name: 'Trò chơi & điểm số' }),
  ).toBeTruthy();
  expect(screen.getByText('Chơi online')).toBeTruthy();
  expect(
    screen.getByRole('tab', { name: 'Chơi online' }).props.accessibilityState,
  ).toMatchObject({ selected: true });
  expect(screen.queryByText('Chọn trò chơi')).toBeNull();
  expect(screen.getByText('Tiến lên miền Bắc')).toBeTruthy();
  expect(screen.getByText('Phỏm')).toBeTruthy();
  expect(screen.getAllByText('Sắp ra mắt')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Xem luật chơi' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Chọn Phỏm' })).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn Tiến lên miền Nam' }),
  );
  expect(screen.getByRole('button', { name: 'Xem luật chơi' })).toBeTruthy();
  expect(screen.getByText('Chơi cùng bạn bè')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Tạo phòng mới' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Vào phòng có sẵn' })).toBeTruthy();
  expect(screen.queryByLabelText('Mã phòng')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Vào phòng có sẵn' }));
  expect(screen.getByLabelText('Mã phòng')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Vào phòng' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Mã phòng'), ' abcd efgh ');
  fireEvent.press(screen.getByRole('button', { name: 'Vào phòng' }));
  expect(send).toHaveBeenCalledWith({
    type: 'join',
    name: 'An',
    code: 'ABCDEFGH',
  });
  expect(
    screen.getByRole('button', { name: 'Chọn Tiến lên miền Nam' }),
  ).toBeTruthy();
});

it('moves into the ready table after creating a room', () => {
  const navigation = { navigate: jest.fn() };
  jest.mocked(useCardGame).mockReturnValue({
    enabled: true,
    active: true,
    uid: 'a',
    session: { send, retry } as never,
    sessionInitializationError: null,
    retrySessionInitialization,
    state: {
      snapshot: { room: null, serverTime: Date.now() },
      loading: false,
      connected: true,
      busy: false,
      pending: false,
      error: null,
    },
  });
  const view = render(
    <CardGamesScreen navigation={navigation as never} route={{} as never} />,
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn Tiến lên miền Nam' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Tạo phòng' }));

  expect(send).toHaveBeenCalledWith({
    type: 'create',
    name: 'An',
    game: 'south',
    amountPerCard: 1,
  });
  expect(screen.getByTestId('lobby-game-table')).toBeTruthy();
  expect(screen.getByTestId('lobby-deck')).toBeTruthy();
  expect(screen.queryByTestId('creating-room-shell')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Tạo phòng' })).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Sẵn sàng' }).props.accessibilityState,
  ).toMatchObject({ busy: true, disabled: true });

  const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest.mocked(useCardGame).mockReturnValue({
    ...current,
    state: {
      ...current.state!,
      snapshot: { room: base, serverTime: Date.now() },
    },
  });
  view.rerender(
    <CardGamesScreen navigation={navigation as never} route={{} as never} />,
  );
  expect(screen.getByTestId('lobby-game-table')).toBeTruthy();
  expect(screen.getByTestId('lobby-deck')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sẵn sàng' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Bắt đầu ván' })).toBeNull();
  expect(useCardGameOrientation).toHaveBeenLastCalledWith(true, true);
});

it('opens the room code popup from the help button and copies the code', async () => {
  const copy = jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
  setup(base);

  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));

  expect(screen.getByText('Mã phòng')).toBeTruthy();
  const scroll = screen.getByTestId('room-code-scroll');
  expect(StyleSheet.flatten(scroll.props.style)).toMatchObject({
    flexShrink: 1,
  });
  expect(StyleSheet.flatten(styles.roomCodeDialog).maxHeight).toBe('90%');
  expect(
    within(scroll).queryByRole('button', { name: 'Đóng mã phòng' }),
  ).toBeNull();
  expect(
    within(scroll).getByRole('button', { name: 'Chuyển chủ phòng' }),
  ).toBeTruthy();
  expect(screen.getByTestId('room-code-popup-value')).toHaveTextContent(
    'ABCDEFGH',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Sao chép mã' }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith('ABCDEFGH'));
  expect(screen.getByText('Đã sao chép mã phòng')).toBeTruthy();
  expect(within(scroll).getByText('Đã sao chép mã phòng')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Xem luật chơi' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Xem luật chơi' }));
  expect(screen.getByText('Luật miền Nam')).toBeTruthy();
  expect(screen.queryByTestId('room-code-popup-value')).toBeNull();
});

it('closes the room code popup with the header X', () => {
  setup(base);
  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  fireEvent.press(screen.getByRole('button', { name: 'Đóng mã phòng' }));
  expect(screen.queryByTestId('room-code-popup-value')).toBeNull();
});

it('closes the previous room popup when the active room changes', () => {
  const view = setup(base);
  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  expect(screen.getByTestId('room-code-popup-value')).toBeTruthy();

  const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest.mocked(useCardGame).mockReturnValue({
    ...current,
    state: {
      ...current.state!,
      snapshot: {
        room: { ...base, id: 'another-room', code: 'HGFEDCBA' },
        serverTime: Date.now(),
      },
    },
  });
  view.rerender(
    <CardGamesScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );

  expect(screen.queryByTestId('room-code-popup-value')).toBeNull();
});

it('returns to the create form if the server rejects room creation', () => {
  jest.mocked(useCardGame).mockReturnValue({
    enabled: true,
    active: true,
    uid: 'a',
    session: { send, retry } as never,
    sessionInitializationError: null,
    retrySessionInitialization,
    state: {
      snapshot: { room: null, serverTime: Date.now() },
      loading: false,
      connected: true,
      busy: false,
      pending: false,
      error: null,
    },
  });
  const navigation = { navigate: jest.fn() };
  const view = render(
    <CardGamesScreen navigation={navigation as never} route={{} as never} />,
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Chọn Tiến lên miền Nam' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Tạo phòng' }));
  const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest.mocked(useCardGame).mockReturnValue({
    ...current,
    state: { ...current.state!, error: 'room-full' },
  });
  view.rerender(
    <CardGamesScreen navigation={navigation as never} route={{} as never} />,
  );

  expect(screen.queryByTestId('creating-room-shell')).toBeNull();
  expect(screen.getByRole('button', { name: 'Tạo phòng' })).toBeTruthy();
});

it('shows the ready table when a new room has only one player', () => {
  const onePlayer = { ...base, members: [base.members[0]] };
  setup(onePlayer);
  expect(screen.getByTestId('lobby-game-table')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sẵn sàng' })).toBeEnabled();
  expect(screen.getByText('Mời bạn bè vào phòng')).toBeTruthy();
  expect(screen.queryByText('0 ván thắng')).toBeNull();
  expect(screen.queryByText('0 đ')).toBeNull();
});

it('lets the host toggle ready while waiting for the other players', () => {
  setup({
    ...base,
    members: base.members.map((member) => ({ ...member, ready: false })),
  });
  fireEvent.press(screen.getByRole('button', { name: 'Sẵn sàng' }));
  expect(send).toHaveBeenCalledWith({ type: 'ready', ready: true });
});

it('lets each player mark ready and waits for the server to start the match', () => {
  setup(base);
  expect(screen.getByText('Bình')).toBeTruthy();
  expect(screen.queryByText('Phòng online')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Rời phòng' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Sẵn sàng' }));
  expect(send).toHaveBeenCalledWith({ type: 'ready', ready: true });
});

it('stagger reveals the hand only after a lobby starts a new match', async () => {
  const view = setup(base);
  const timing = jest.spyOn(Animated, 'timing');
  const startedRoom: CardGameRoom = {
    ...base,
    phase: 'playing',
    matchId: 'dealt-match',
    game: {
      rulesVersion: 'south-v1',
      status: 'playing',
      hand: [0, 5, 10],
      players: [
        { uid: 'a', count: 3, finished: false, forfeited: false },
        { uid: 'b', count: 3, finished: false, forfeited: false },
      ],
      turn: 'a',
      table: null,
      passed: [],
      openingCard: 0,
      deadline: Date.now() + 15000,
      result: null,
    },
  };
  const makeGameState = (room: CardGameRoom) => ({
    enabled: true,
    active: true,
    uid: 'a',
    session: { send, retry } as never,
    sessionInitializationError: null,
    retrySessionInitialization,
    state: {
      snapshot: { room, serverTime: Date.now() },
      loading: false,
      connected: true,
      busy: false,
      pending: false,
      error: null,
    },
  });
  jest.mocked(useCardGame).mockReturnValue(makeGameState(startedRoom));
  const screenProps = {
    navigation: { navigate: jest.fn() } as never,
    route: {} as never,
  };
  view.rerender(<CardGamesScreen {...screenProps} />);

  await waitFor(() =>
    expect(
      timing.mock.calls.filter(([, config]) => config.duration === 240),
    ).toHaveLength(3),
  );
  expect(screen.getByTestId('shuffle-deck')).toBeTruthy();
  expect(screen.getAllByTestId(/^deal-flight-/)).toHaveLength(6);
  const dealTimingCount = timing.mock.calls.filter(
    ([, config]) => config.duration === 240,
  ).length;

  jest
    .mocked(useCardGame)
    .mockReturnValue(
      makeGameState({ ...startedRoom, members: [...startedRoom.members] }),
    );
  view.rerender(<CardGamesScreen {...screenProps} />);
  expect(
    timing.mock.calls.filter(([, config]) => config.duration === 240),
  ).toHaveLength(dealTimingCount);
});

it('celebrates a new instant result announced directly from the lobby', async () => {
  const view = setup(base);
  const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  const instantRoom: CardGameRoom = {
    ...base,
    matchId: 'lobby-instant-ui',
    phase: 'finished',
    game: {
      rulesVersion: 'south-v1',
      status: 'finished',
      hand: [],
      players: [
        { uid: 'a', count: 13, finished: true, forfeited: false },
        { uid: 'b', count: 13, finished: false, forfeited: false },
      ],
      turn: null,
      table: null,
      passed: [],
      openingCard: null,
      deadline: null,
      result: {
        reason: 'dragon',
        ranking: [
          { uid: 'a', rank: 1, labels: ['instant-win'], moneyDelta: 0 },
          { uid: 'b', rank: 2, labels: [], moneyDelta: 0 },
        ],
      },
    },
  };
  jest.mocked(useCardGame).mockReturnValue({
    ...current,
    state: {
      ...current.state!,
      snapshot: { room: instantRoom, serverTime: Date.now() },
    },
  });
  view.rerender(
    <CardGamesScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId('winner-fireworks')).toBeTruthy(),
  );
});

it('lets a non-host toggle ready', () => {
  setup(
    {
      ...base,
      members: base.members.map((member) => ({ ...member, ready: false })),
    },
    false,
    'b',
  );
  expect(screen.queryByRole('button', { name: 'Bắt đầu ván' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Sẵn sàng' }));
  expect(send).toHaveBeenCalledWith({ type: 'ready', ready: true });
});

it('lets a ready non-host cancel readiness', () => {
  setup(
    {
      ...base,
      members: base.members.map((member) => ({
        ...member,
        ready: member.uid === 'b',
      })),
    },
    false,
    'b',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ sẵn sàng' }));
  expect(send).toHaveBeenCalledWith({ type: 'ready', ready: false });
});

it('asks before leaving and returns to card score after leaving the room', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const navigation = { navigate: jest.fn() };
  setup(base, false, 'a', null, navigation);

  fireEvent.press(
    screen.getByRole('button', { name: 'Quay lại Trò chơi & điểm số' }),
  );

  expect(alert).toHaveBeenCalledWith(
    'Rời phòng?',
    'Bạn có thể vào lại bằng mã nếu phòng còn chỗ.',
    expect.any(Array),
  );
  const actions = alert.mock.calls[0][2];
  await act(async () => {
    actions?.find((action) => action.text === 'Rời phòng')?.onPress?.();
    await Promise.resolve();
  });
  expect(send).toHaveBeenCalledWith({ type: 'leave' });
  await waitFor(() =>
    expect(navigation.navigate).toHaveBeenCalledWith('CardScore'),
  );
});

it.each(['lobby', 'playing'] as const)(
  'confirms Android hardware back before leaving a %s room',
  async (phase) => {
    jest.replaceProperty(Platform, 'OS', 'android');
    let back!: () => boolean | null | undefined;
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        back = handler;
        return { remove: jest.fn() };
      });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const navigation = { navigate: jest.fn() };
    setup(
      phase === 'lobby'
        ? base
        : {
            ...base,
            phase,
            matchId: 'match',
            game: {
              rulesVersion: 'south-v1',
              status: 'playing',
              hand: [0, 5],
              players: [
                { uid: 'a', count: 2, finished: false, forfeited: false },
                { uid: 'b', count: 13, finished: false, forfeited: false },
              ],
              turn: 'a',
              table: null,
              passed: [],
              openingCard: 0,
              deadline: Date.now() + 40000,
              result: null,
            },
          },
      false,
      'a',
      null,
      navigation,
    );
    expect(BackHandler.addEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    );
    act(() => {
      expect(back()).toBe(true);
    });
    expect(alert).toHaveBeenCalledWith(
      phase === 'lobby' ? 'Rời phòng?' : 'Rời ván đang chơi?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Ở lại', style: 'cancel' }),
      ]),
    );
    expect(send).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    await act(async () => {
      alert.mock.calls
        .at(-1)?.[2]
        ?.find((action) => action.text === 'Rời phòng')
        ?.onPress?.();
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: 'leave' });
    expect(navigation.navigate).toHaveBeenCalledWith('CardScore');
  },
);

it('consumes hardware back while reconnecting and removes the listener when inactive', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  let back!: () => boolean | null | undefined;
  const remove = jest.fn();
  const add = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, handler) => {
      back = handler;
      return { remove };
    });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const navigation = { navigate: jest.fn() };
  const view = setup(base, true, 'a', null, navigation);
  expect(add).toHaveBeenCalled();
  act(() => {
    expect(back()).toBe(true);
  });
  expect(alert).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
  const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest.mocked(useCardGame).mockReturnValue({ ...current, active: false });
  add.mockClear();
  view.rerender(
    <CardGamesScreen navigation={navigation as never} route={{} as never} />,
  );
  expect(remove).toHaveBeenCalled();
  expect(add).not.toHaveBeenCalled();
});

it('leaves room scoring active until the user explicitly finishes the local table', async () => {
  const finish = jest.spyOn(cardStorage, 'finishOnlineCardScoreMatch');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  setup(base);
  fireEvent.press(
    screen.getByRole('button', { name: 'Quay lại Trò chơi & điểm số' }),
  );
  await act(async () => {
    const leaveAction = alert.mock.calls[0][2]?.find(
      (action) => action.text === 'Rời phòng',
    );
    if (leaveAction?.onPress) leaveAction.onPress();
    await Promise.resolve();
  });
  expect(send).toHaveBeenCalledWith({ type: 'leave' });
  expect(finish).not.toHaveBeenCalled();
});

it('always exposes recovery for an uncertain action even when a successful read cleared its error', () => {
  setup(base);
  const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest.mocked(useCardGame).mockReturnValue({
    ...current,
    state: { ...current.state, pending: true, error: null },
  });
  render(
    <CardGamesScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Kiểm tra lại thao tác' }),
  );
  expect(retry).toHaveBeenCalled();
});

it('selects cards, submits only selected IDs and never renders opponent hands', () => {
  setup({
    ...base,
    phase: 'playing',
    matchId: 'match',
    game: {
      rulesVersion: 'south-v1',
      status: 'playing',
      hand: [0, 5],
      players: [
        { uid: 'a', count: 2, finished: false, forfeited: false },
        { uid: 'b', count: 13, finished: false, forfeited: false },
      ],
      turn: 'a',
      table: null,
      passed: [],
      openingCard: 0,
      deadline: Date.now() + 30000,
      result: null,
    },
  });
  fireEvent.press(screen.getByRole('button', { name: '3 bích' }));
  fireEvent.press(screen.getByRole('button', { name: 'Đánh 1 lá' }));
  expect(send).toHaveBeenCalledWith({ type: 'play', cards: [0] });
  expect(
    screen.getAllByRole('button', { name: /^(3 bích|4 chuồn)$/ }),
  ).toHaveLength(2);
  expect(screen.queryByText('13 lá')).toBeNull();
  expect(useCardGameOrientation).toHaveBeenLastCalledWith(true, true);
  expect(
    within(screen.getByTestId('game-table-scroll')).queryByRole('button', {
      name: 'Đánh 1 lá',
    }),
  ).toBeNull();
});

it('keeps a finished match on the game table for an in-room rematch', () => {
  setup({
    ...base,
    phase: 'finished',
    matchId: 'match',
    members: base.members.map((member) => ({ ...member, ready: false })),
    game: {
      rulesVersion: 'south-v1',
      status: 'finished',
      hand: [],
      players: [
        { uid: 'a', count: 0, finished: true, forfeited: false },
        { uid: 'b', count: 13, finished: false, forfeited: false },
      ],
      turn: null,
      table: null,
      passed: [],
      openingCard: null,
      deadline: null,
      result: {
        reason: 'completed',
        ranking: [{ uid: 'a', rank: 1, labels: [], moneyDelta: 0 }],
      },
    },
  });

  expect(screen.getByTestId('game-table-scroll')).toBeTruthy();
  expect(screen.getByTestId('collected-deck')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sẵn sàng' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Bắt đầu ván mới' })).toBeNull();
  expect(useCardGameOrientation).toHaveBeenLastCalledWith(true, true);
});

it('explains when another device controls the room and keeps recovery actions in the header', () => {
  setup({
    ...base,
    controller: false,
    phase: 'playing',
    matchId: 'match',
    game: {
      rulesVersion: 'south-v1',
      status: 'playing',
      hand: [0, 5],
      players: [
        { uid: 'a', count: 2, finished: false, forfeited: false },
        { uid: 'b', count: 13, finished: false, forfeited: false },
      ],
      turn: 'a',
      table: null,
      passed: [],
      openingCard: 0,
      deadline: Date.now() + 30000,
      result: null,
    },
  });

  expect(
    screen.getByText('Bàn này đang được mở trên thiết bị khác.'),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Chơi trên thiết bị này' }),
  ).toBeTruthy();
  expect(screen.queryByText('Phòng online')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Rời phòng' })).toBeNull();
});

it('does not manufacture a device-only score copy when a new room starts playing', async () => {
  const sync = jest
    .spyOn(cardStorage, 'syncOnlineCardScoreMatch')
    .mockResolvedValue(null);
  setup({
    ...base,
    matchId: 'new-shared-match',
    phase: 'playing',
    game: {
      rulesVersion: 'south-v1',
      status: 'playing',
      hand: [0, 5, 10],
      players: base.members.map((member) => ({
        uid: member.uid,
        count: 13,
        finished: false,
        forfeited: false,
      })),
      turn: 'a',
      table: null,
      passed: [],
      openingCard: 0,
      deadline: Date.now() + 30000,
      result: null,
    },
  } as CardGameRoom);
  await act(async () => {
    await Promise.resolve();
  });
  expect(sync).not.toHaveBeenCalled();
});

it('opens player details from the lobby and only kicks after owner confirmation', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  setup({ ...base, ownerUid: 'a' });
  fireEvent.press(
    screen.getByRole('button', { name: 'Thông tin người chơi Bình' }),
  );
  expect(screen.getByText('Số ván thắng: 0')).toBeTruthy();
  expect(screen.getByTestId('player-info-scroll')).toBeTruthy();
  for (const modal of screen.UNSAFE_getAllByType(Modal)) {
    expect(modal.props.supportedOrientations).toEqual([
      'portrait',
      'landscape-left',
      'landscape-right',
    ]);
  }
  fireEvent.press(screen.getByRole('button', { name: 'Kích người chơi' }));
  expect(send).not.toHaveBeenCalled();
  const confirm = alert.mock.calls
    .at(-1)?.[2]
    ?.find((button) => button.text === 'Kích người chơi');
  act(() => confirm?.onPress?.());
  expect(send).toHaveBeenCalledWith({ type: 'kick', targetUid: 'b' });
});

it('does not expose kick for a regular member or the owner viewing themself', () => {
  setup({ ...base, ownerUid: 'b' });
  fireEvent.press(
    screen.getByRole('button', { name: 'Thông tin người chơi Bình' }),
  );
  expect(screen.queryByRole('button', { name: 'Kích người chơi' })).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: 'Đóng thông tin người chơi' }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Thông tin người chơi An' }),
  );
  expect(screen.queryByRole('button', { name: 'Kích người chơi' })).toBeNull();
});

it('manages the current replacement member after Phỏm finishes without targeting a historical participant', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const room = phomRoom();
  room.phase = 'finished';
  room.game.status = 'finished';
  room.game.turn = null;
  room.game.deadline = null;
  room.members = [
    ...room.members.filter((m) => m.uid !== 'b'),
    { uid: 'e', name: 'Người mới', ready: false, wins: 7, balance: 99 },
  ];
  const history = JSON.stringify(room.game);
  const view = setup(room);
  fireEvent.press(
    screen.getByRole('button', { name: 'Thông tin người chơi Người mới' }),
  );
  expect(screen.getByText('Số ván thắng: 7')).toBeTruthy();
  expect(screen.getByText('Số dư bàn: 99 đ')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Kích người chơi' }));
  const confirm = alert.mock.calls
    .at(-1)?.[2]
    ?.find((button) => button.text === 'Kích người chơi');
  act(() => confirm?.onPress?.());
  expect(send).toHaveBeenLastCalledWith({ type: 'kick', targetUid: 'e' });
  send.mockClear();
  // An old confirmation must not target a later occupant of the same visible slot.
  const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest.mocked(useCardGame).mockReturnValue({
    ...current,
    state: {
      ...current.state!,
      snapshot: {
        ...current.state!.snapshot!,
        room: {
          ...room,
          version: room.version + 1,
          members: room.members.filter((m) => m.uid !== 'e'),
        },
      },
    },
  });
  view.rerender(
    <CardGamesScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );
  act(() => confirm?.onPress?.());
  expect(send).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: 'Thông tin người chơi Người mới' }),
  ).toBeNull();
  expect(JSON.stringify(room.game)).toBe(history);
});

it('invalidates a pending kick confirmation when room ownership changes', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const navigation = { navigate: jest.fn() };
  const view = setup({ ...base, ownerUid: 'a' }, false, 'a', null, navigation);
  fireEvent.press(
    screen.getByRole('button', { name: 'Thông tin người chơi Bình' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Kích người chơi' }));
  const confirm = alert.mock.calls
    .at(-1)?.[2]
    ?.find((button) => button.text === 'Kích người chơi');
  const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest.mocked(useCardGame).mockReturnValue({
    ...current,
    state: {
      ...current.state!,
      snapshot: { room: { ...base, ownerUid: 'b' }, serverTime: Date.now() },
    },
  });
  view.rerender(
    <CardGamesScreen navigation={navigation as never} route={{} as never} />,
  );
  act(() => confirm?.onPress?.());
  expect(send).not.toHaveBeenCalled();
  expect(screen.queryByText('Thông tin người chơi')).toBeNull();
});

it('clears the old room and shows a deduplicated removal notice', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  const view = setup(base, false, 'a', null, navigation);
  const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  const removal = {
    id: 'removal-ui-once',
    roomId: base.id,
    reason: 'kicked' as const,
  };
  jest.mocked(useCardGame).mockReturnValue({
    ...current,
    state: {
      ...current.state!,
      snapshot: { room: null, serverTime: Date.now(), removal },
    },
  });
  view.rerender(
    <CardGamesScreen
      navigation={navigation as never}
      route={{ params: { roomCode: base.code } } as never}
    />,
  );
  expect(alert).toHaveBeenCalledWith(
    'Thông báo',
    'Bạn đã bị chủ phòng mời ra khỏi phòng.',
  );
  expect(send).not.toHaveBeenCalled();
  view.rerender(
    <CardGamesScreen navigation={navigation as never} route={{} as never} />,
  );
  expect(screen.queryByTestId('lobby-game-table')).toBeNull();
  expect(alert).toHaveBeenCalledTimes(1);
});

it('allows deliberate history rejoin after a handled kick notice', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  const view = setup(base, false, 'a', null, navigation);
  const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest.mocked(useCardGame).mockReturnValue({
    ...current,
    state: {
      ...current.state!,
      snapshot: {
        room: null,
        serverTime: Date.now(),
        removal: {
          id: 'removal-history-rejoin',
          roomId: base.id,
          reason: 'kicked',
        },
      },
    },
  });
  view.rerender(
    <CardGamesScreen navigation={navigation as never} route={{} as never} />,
  );
  expect(send).not.toHaveBeenCalled();
  view.rerender(
    <CardGamesScreen
      navigation={navigation as never}
      route={{ params: { roomCode: base.code } } as never}
    />,
  );
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith({
      type: 'join',
      name: 'An',
      code: base.code,
    }),
  );
});

it('does not let an explicitly ownerless room fall back to its host for kicking', () => {
  setup({ ...base, ownerUid: null });
  fireEvent.press(
    screen.getByRole('button', { name: 'Thông tin người chơi Bình' }),
  );
  expect(screen.queryByRole('button', { name: 'Kích người chơi' })).toBeNull();
});

it('lets only the controlling South owner edit next-round rules from the room menu', () => {
  setup({ ...base, amountPerCard: 5 });
  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  fireEvent.press(screen.getByRole('button', { name: 'Sửa luật ván tới' }));
  expect(screen.getByText(/Chỉ áp dụng khi chia ván mới/)).toBeTruthy();
  expect(screen.getByLabelText('Số tiền trừ cho mỗi lá còn lại')).toHaveProp(
    'value',
    '5',
  );
  fireEvent.changeText(
    screen.getByLabelText('Số tiền trừ cho mỗi lá còn lại'),
    '9',
  );
  fireEvent.changeText(
    screen.getByLabelText('Số tiền phạt cho mỗi lá 2 bị chặt'),
    '17',
  );
  fireEvent.press(
    screen.getByRole('radio', { name: 'Có người về nhất thì dừng ngay' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu luật ván tới' }));
  expect(send).toHaveBeenCalledWith({
    type: 'set-south-rules',
    amountPerCard: 9,
    southConfig: { finishMode: 'first-winner', cutTwoAmount: 17 },
  });
});

it.each([
  { ...base, host: 'b', ownerUid: 'b' },
  { ...base, controller: false },
])('hides rule editing without South owner control', (room) => {
  setup(room);
  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  expect(screen.queryByRole('button', { name: 'Sửa luật ván tới' })).toBeNull();
});

it('shows pending rules to members and keeps the active rules separate', () => {
  setup(
    {
      ...base,
      amountPerCard: 5,
      nextSouthRules: {
        amountPerCard: 9,
        southConfig: { finishMode: 'first-winner', cutTwoAmount: 17 },
      },
    },
    false,
    'b',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  fireEvent.press(screen.getByRole('button', { name: 'Xem luật chơi' }));
  expect(screen.getByText('Luật ván tới')).toBeTruthy();
  expect(screen.getByText(/9 đ\/lá còn · Chặt 2: 17 đ\/lá 2/)).toBeTruthy();
  expect(screen.getByText(/Chặt 2: 0 đ\/lá 2/)).toBeTruthy();
});

it('blocks a stale rules draft when the room changes and can reload it', () => {
  const view = setup({ ...base, amountPerCard: 5 });
  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  fireEvent.press(screen.getByRole('button', { name: 'Sửa luật ván tới' }));
  const hook = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest.mocked(useCardGame).mockReturnValue({
    ...hook,
    state: {
      ...hook.state!,
      snapshot: {
        room: {
          ...base,
          version: 2,
          amountPerCard: 5,
          nextSouthRules: {
            amountPerCard: 10,
            southConfig: { finishMode: 'continue', cutTwoAmount: 0 },
          },
        },
        serverTime: Date.now(),
      },
    },
  });
  view.rerender(
    <CardGamesScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Lưu luật ván tới' }),
  ).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Tải lại luật' }));
  expect(screen.getByLabelText('Số tiền trừ cho mỗi lá còn lại')).toHaveProp(
    'value',
    '10',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu luật ván tới' }));
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({ amountPerCard: 10 }),
  );
});

it('edits each Phỏm rate in the room and submits only next-round configuration', () => {
  const room = phomRoom();
  room.nextPhomConfig = { ...DEFAULT_PHOM_CONFIG, second: 23 };
  setup(room);
  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  fireEvent.press(screen.getByRole('button', { name: 'Sửa luật ván tới' }));
  expect(screen.getByLabelText('Mức Nhì')).toHaveProp('value', '23');
  for (const [key, label] of [
    ['second', 'Nhì'],
    ['third', 'Ba'],
    ['last', 'Bét (hạng 4)'],
    ['eat', 'Ăn thường'],
    ['chot', 'Ăn chốt'],
    ['mom', 'Móm'],
    ['u', 'Ù'],
    ['uTron', 'Ù tròn'],
    ['den', 'Đền (mỗi người)'],
    ['forfeit', 'Bỏ cuộc'],
  ] as const)
    fireEvent.changeText(
      screen.getByLabelText(`Mức ${label}`),
      String(Object.keys(DEFAULT_PHOM_CONFIG).indexOf(key) * 10),
    );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu luật ván tới' }));
  expect(send).toHaveBeenCalledWith({
    type: 'set-phom-rules',
    phomConfig: {
      ...Object.fromEntries(
        Object.keys(DEFAULT_PHOM_CONFIG).map((key, i) => [key, i * 10]),
      ),
      options: { tai: false, send: true, uDen: true },
    },
  });
  expect(room.phomConfig).toEqual(DEFAULT_PHOM_CONFIG);
});

it('validates Phỏm edits and can reset all next-round rates without changing saved current rules', () => {
  setup(phomRoom());
  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  fireEvent.press(screen.getByRole('button', { name: 'Sửa luật ván tới' }));
  for (const value of ['', '1000000001']) {
    fireEvent.changeText(screen.getByLabelText('Mức Ù'), value);
    expect(
      screen.getByRole('button', { name: 'Lưu luật ván tới' }),
    ).toBeDisabled();
  }
  fireEvent.press(
    screen.getByRole('button', { name: 'Khôi phục mức mặc định' }),
  );
  expect(screen.getByLabelText('Mức Ù')).toHaveProp(
    'value',
    String(DEFAULT_PHOM_CONFIG.u),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Lưu luật ván tới' }));
  expect(send).toHaveBeenCalledWith({
    type: 'set-phom-rules',
    phomConfig: {
      ...DEFAULT_PHOM_CONFIG,
      options: { tai: false, send: true, uDen: true },
    },
  });
});

it('shows current Phỏm rates and the next-round rates to all members', () => {
  const room = phomRoom();
  room.nextPhomConfig = { ...DEFAULT_PHOM_CONFIG, u: 123 };
  setup(room, false, 'b');
  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  expect(screen.queryByRole('button', { name: 'Sửa luật ván tới' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Xem luật chơi' }));
  expect(screen.getByText('Luật ván tới')).toBeTruthy();
  expect(screen.getByText('Ù: 5')).toBeTruthy();
  expect(screen.getByText('Ù: 123')).toBeTruthy();
});

it('reloads a stale Phỏm draft from pending rates before saving', () => {
  const room = phomRoom();
  const view = setup(room);
  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  fireEvent.press(screen.getByRole('button', { name: 'Sửa luật ván tới' }));
  fireEvent.changeText(screen.getByLabelText('Mức Ù'), '321');
  const hook = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  const next = { ...DEFAULT_PHOM_CONFIG, u: 123, den: 0 };
  jest.mocked(useCardGame).mockReturnValue({
    ...hook,
    state: {
      ...hook.state!,
      snapshot: {
        room: { ...room, version: room.version + 1, nextPhomConfig: next },
        serverTime: Date.now(),
      },
    },
  });
  view.rerender(
    <CardGamesScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Lưu luật ván tới' }),
  ).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Tải lại luật' }));
  expect(screen.getByLabelText('Mức Ù')).toHaveProp('value', '123');
  expect(screen.getByLabelText('Mức Đền (mỗi người)')).toHaveProp('value', '0');
  fireEvent.press(screen.getByRole('button', { name: 'Lưu luật ván tới' }));
  expect(send).toHaveBeenCalledWith({
    type: 'set-phom-rules',
    phomConfig: { ...next, options: { tai: false, send: true, uDen: true } },
  });
});

it('a stale Phỏm save callback cannot write after the controlling account changes', () => {
  const room = phomRoom();
  const view = setup(room);
  fireEvent.press(screen.getByRole('button', { name: 'Mã phòng' }));
  fireEvent.press(screen.getByRole('button', { name: 'Sửa luật ván tới' }));
  const save = view
    .UNSAFE_getAllByType(Button)
    .find((button) => button.props.title === 'Lưu luật ván tới')!.props.onPress;
  expect(typeof save).toBe('function');
  const hook = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest.mocked(useCardGame).mockReturnValue({ ...hook, uid: 'b' });
  view.rerender(
    <CardGamesScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Lưu luật ván tới' })).toBeNull();
  save();
  expect(send).not.toHaveBeenCalled();
});
