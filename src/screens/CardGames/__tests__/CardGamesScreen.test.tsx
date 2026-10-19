import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { CardGamesScreen } from '../CardGamesScreen';
import { useCardGame } from '../../../hooks/useCardGame';
import { useAuthStore } from '../../../store/authStore';
import type { CardGameRoom } from '../../../types/cardGame';

jest.mock('../../../hooks/useCardGame', () => ({ useCardGame: jest.fn() }));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 12, left: 0, right: 0 }),
}));
const send = jest.fn(),
  retry = jest.fn();
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
    { uid: 'a', name: 'An', ready: true, wins: 0 },
    { uid: 'b', name: 'Bình', ready: true, wins: 0 },
  ],
  game: null,
};
function setup(room: CardGameRoom | null = null) {
  jest.mocked(useCardGame).mockReturnValue({
    enabled: true,
    active: true,
    uid: 'a',
    session: { send, retry } as never,
    state: {
      snapshot: { room, serverTime: Date.now() },
      loading: false,
      connected: true,
      busy: false,
      pending: false,
      error: null,
    },
  });
  return render(
    <CardGamesScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{} as never}
    />,
  );
}
beforeEach(() => {
  send.mockClear();
  useAuthStore
    .getState()
    .setUser({ uid: 'a', email: 'a@example.invalid', displayName: 'An' });
});

it('creates South rooms and joins by normalized room code without offering unfinished games', () => {
  setup();
  fireEvent.press(screen.getByRole('button', { name: 'Tạo phòng miền Nam' }));
  expect(send).toHaveBeenCalledWith({
    type: 'create',
    name: 'An',
    game: 'south',
  });
  fireEvent.changeText(screen.getByLabelText('Mã phòng'), ' abcd efgh ');
  fireEvent.press(screen.getByRole('button', { name: 'Vào phòng' }));
  expect(send).toHaveBeenCalledWith({
    type: 'join',
    name: 'An',
    code: 'ABCDEFGH',
  });
  expect(screen.queryByRole('button', { name: 'Tạo phòng Phỏm' })).toBeNull();
});

it('shows seats and lets only the host start a fully ready lobby', () => {
  setup(base);
  expect(screen.getByText('Bình')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Bắt đầu ván' }));
  expect(send).toHaveBeenCalledWith({ type: 'start' });
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ sẵn sàng' }));
  expect(send).toHaveBeenCalledWith({ type: 'ready', ready: false });
});

it('always exposes recovery for an uncertain action even when a successful read cleared its error', () => {
  setup(base);
  const current = jest.mocked(useCardGame).mock.results.at(-1)!.value;
  jest
    .mocked(useCardGame)
    .mockReturnValue({
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
  expect(screen.getByText('13 lá')).toBeTruthy();
  expect(
    within(screen.getByTestId('game-table-scroll')).queryByRole('button', {
      name: 'Đánh 1 lá',
    }),
  ).toBeNull();
});
