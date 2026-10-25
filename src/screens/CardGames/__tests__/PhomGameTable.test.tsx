import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import { PhomGameTable } from '../PhomGameTable';
import { PhomMiniCards } from '../PhomTableParts';
import { PlayingCard, cardLabel } from '../PlayingCard';
import { phomRoom } from '../../../testing/phomFixture';
jest.mock('../CardGameAvatarImage', () => ({
  CardGameAvatarImage: () => null,
}));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
const props = {
  uid: 'a',
  serverTime: Date.now(),
  active: true,
  disabled: false,
  busy: false,
  onAction: jest.fn(),
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

function resultRoom() {
  const room = phomRoom();
  room.phase = 'finished';
  room.game.status = 'finished';
  room.game.turn = null;
  room.game.deadline = null;
  room.game.hand = [12, 16];
  room.game.players = room.game.players.map((p, i) => ({
    ...p,
    name: `Bạn ${p.uid}`,
    count: 2,
    laid: true,
    eaten: [8 + i],
    melds: [[i, 4 + i, 8 + i]],
    discards: [],
    resultCards: { discards: [44 + i], remaining: [12 + i, 16 + i] },
  }));
  room.game.result = {
    reason: 'phom-points',
    ranking: room.game.players.map((p, i) => ({
      uid: p.uid,
      name: p.name,
      rank: i + 1,
      labels: [],
      deadwoodPoints: 10,
      moneyDelta: 0,
    })),
  };
  return room;
}

it.each([false, true])(
  'opens each result with separate card groups in landscape=%s, including departed participants',
  (landscape) => {
    Dimensions.set({
      window: {
        width: landscape ? 932 : 390,
        height: landscape ? 430 : 844,
        scale: 3,
        fontScale: 1,
      },
      screen: {
        width: landscape ? 932 : 390,
        height: landscape ? 430 : 844,
        scale: 3,
        fontScale: 1,
      },
    });
    const room = resultRoom();
    room.members = room.members.filter((p) => p.uid !== 'b');
    render(<PhomGameTable room={room} {...props} />);
    fireEvent.press(screen.getByRole('button', { name: 'Xem bài của Bạn b' }));
    expect(
      within(screen.getByTestId('phom-result-discards')).getByLabelText(
        cardLabel(45),
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('phom-result-eaten')).getByLabelText(
        cardLabel(9),
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('phom-result-melds')).getByLabelText(
        cardLabel(5),
      ),
    ).toBeTruthy();
    const remaining = within(screen.getByTestId('phom-result-remaining'));
    expect(remaining.getByLabelText(cardLabel(13))).toBeTruthy();
    expect(remaining.getByLabelText(cardLabel(17))).toBeTruthy();
    expect(remaining.queryByLabelText(cardLabel(12))).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Đóng chi tiết bài' }));
    expect(screen.queryByTestId('phom-result-remaining')).toBeNull();
  },
);

it('distinguishes missing legacy result data from an empty remaining hand', () => {
  const room = resultRoom();
  delete room.game.players[1].resultCards;
  room.game.players[0].count = 0;
  room.game.players[0].resultCards!.remaining = [];
  render(<PhomGameTable room={room} {...props} />);
  fireEvent.press(screen.getByRole('button', { name: 'Xem bài của Bạn b' }));
  expect(
    screen.getByText('Chưa có dữ liệu bài còn lại của ván này.'),
  ).toBeTruthy();
  const legacyDiscards = within(screen.getByTestId('phom-result-discards'));
  expect(legacyDiscards.getByText('Bài đã đánh còn trên bàn')).toBeTruthy();
  expect(
    legacyDiscards.getByText('Chưa có đầy đủ lịch sử đánh bài của ván này.'),
  ).toBeTruthy();
  expect(
    legacyDiscards.getByText('Không có lá đã đánh còn trên bàn.'),
  ).toBeTruthy();
  expect(legacyDiscards.queryByText('Chưa đánh lá nào.')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Đóng chi tiết bài' }));
  fireEvent.press(screen.getByRole('button', { name: 'Xem bài của Bạn a' }));
  expect(screen.getByText('Không còn bài trên tay.')).toBeTruthy();
});

it('closes result details on a new match or when the table loses focus', () => {
  const room = resultRoom();
  const view = render(<PhomGameTable room={room} {...props} />);
  fireEvent.press(screen.getByRole('button', { name: 'Xem bài của Bạn b' }));
  view.rerender(
    <PhomGameTable room={{ ...room, matchId: 'new-match' }} {...props} />,
  );
  expect(screen.queryByTestId('phom-result-remaining')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Xem bài của Bạn a' }));
  view.rerender(
    <PhomGameTable
      room={{ ...room, matchId: 'new-match' }}
      {...props}
      active={false}
    />,
  );
  expect(screen.queryByTestId('phom-result-remaining')).toBeNull();
});
it('keeps the hand at the bottom in landscape and submits a selected discard without hiding it early', () => {
  Dimensions.set({
    window: { width: 932, height: 430, scale: 3, fontScale: 1 },
    screen: { width: 932, height: 430, scale: 3, fontScale: 1 },
  });
  const room = phomRoom();
  render(<PhomGameTable room={room} {...props} />);
  expect(
    StyleSheet.flatten(screen.getByTestId('phom-table').props.style)
      .flexDirection,
  ).not.toBe('row');
  expect(screen.getByTestId('phom-hand-panel')).toBeTruthy();
  fireEvent(screen.getByTestId('phom-table'), 'layout', {
    nativeEvent: { layout: { width: 740, height: 268 } },
  });
  expect(
    StyleSheet.flatten(screen.getByTestId('phom-hand-panel').props.style)
      .maxHeight,
  ).toBeLessThan(172);
  expect(screen.getByText('Bạn đang đánh')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Đánh 1 lá' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: '3 bích' }));
  fireEvent.press(screen.getByRole('button', { name: 'Đánh 1 lá' }));
  expect(props.onAction).toHaveBeenCalledWith({
    type: 'play',
    phomAction: 'discard',
    cards: [0],
  });
  expect(screen.getByRole('button', { name: '3 bích' })).toBeTruthy();
});

it('retains own discarded cards and sorting without a table-cards button', () => {
  const room = phomRoom();
  room.game.players[0].discards = [44];
  render(<PhomGameTable room={room} {...props} />);
  expect(screen.getByTestId('phom-own-public-cards')).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Bài đã đánh và phỏm trên bàn' }),
  ).toBeNull();
  expect(screen.getByRole('button', { name: 'Xếp chất' })).toBeTruthy();
});
it('shows eat/draw only for the draw step and fences stale/background turns', () => {
  const room = phomRoom();
  room.game.step = 'draw';
  room.game.canEat = true;
  room.game.hand.pop();
  const view = render(<PhomGameTable room={room} {...props} />);
  fireEvent.press(screen.getByText('Ăn bài'));
  expect(props.onAction).toHaveBeenCalledWith({
    type: 'play',
    phomAction: 'eat',
    cards: [],
  });
  expect(screen.queryByRole('button', { name: 'Đánh 1 lá' })).toBeNull();
  view.rerender(<PhomGameTable room={room} {...props} active={false} />);
  expect(screen.getByRole('button', { name: 'Bốc bài' })).toBeDisabled();
});
it('lets players lay automatically or build meld groups and choose a target when sending', () => {
  const room = phomRoom();
  room.game.step = 'lay';
  room.game.players[0].turns = 3;
  const view = render(<PhomGameTable room={room} {...props} />);
  fireEvent.press(screen.getByText('Hạ tự động'));
  expect(props.onAction).toHaveBeenLastCalledWith({
    type: 'play',
    phomAction: 'lay',
    cards: [],
  });
  room.game = {
    ...room.game,
    step: 'discard',
    hand: [12, 40],
    players: room.game.players.map((p) => ({
      ...p,
      laid: true,
      melds: p.uid === 'b' ? [[0, 4, 8]] : [[16, 20, 24]],
    })),
  };
  view.rerender(<PhomGameTable room={room} {...props} />);
  fireEvent.press(screen.getByRole('button', { name: '6 bích' }));
  fireEvent.press(screen.getByText('Gửi bài'));
  fireEvent.press(
    screen.getByRole('button', { name: 'Gửi vào phỏm 1 của Bạn b' }),
  );
  expect(props.onAction).toHaveBeenLastCalledWith({
    type: 'play',
    phomAction: 'send',
    cards: [12],
    targetUid: 'b',
    meldIndex: 0,
  });
});
it('hides sending when room rules disable it', () => {
  const room = phomRoom();
  room.phomConfig = {
    ...room.phomConfig!,
    options: { tai: true, send: false, uDen: true },
  };
  room.game.players[0].laid = true;
  room.game.players[0].melds = [[16, 20, 24]];
  render(<PhomGameTable room={room} {...props} />);
  expect(screen.queryByRole('button', { name: 'Gửi bài' })).toBeNull();
});

it('keeps all ten-rank mini cards on one line', () => {
  render(<PhomMiniCards cards={[28, 29, 30, 31]} />);
  for (const suit of ['♠', '♣', '♦', '♥']) {
    const label = screen.getByText(`10${suit}`);
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.adjustsFontSizeToFit).toBe(true);
  }
});

it('explains manual grouping and submits the grouped cards only when laying', () => {
  const room = phomRoom();
  room.game.step = 'lay';
  room.game.players[0].turns = 3;
  render(<PhomGameTable room={room} {...props} />);
  expect(screen.queryByText('Xếp phỏm đã chọn')).toBeNull();
  expect(screen.getByRole('button', { name: 'Gom phỏm' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Hạ tự động' })).toBeEnabled();
  for (const label of ['3 bích', '4 bích', '5 bích']) {
    fireEvent.press(screen.getByRole('button', { name: label }));
  }
  fireEvent.press(screen.getByRole('button', { name: 'Gom phỏm' }));
  expect(props.onAction).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Bỏ phỏm đã gom 1' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Hạ phỏm' }));
  expect(props.onAction).toHaveBeenCalledWith({
    type: 'play',
    phomAction: 'lay',
    cards: [],
    melds: [[0, 4, 8]],
  });
});

function eatRoom() {
  const room = phomRoom();
  room.game.step = 'draw';
  room.game.canEat = true;
  room.game.hand = [0, 4, 8, 16, 20, 24, 28, 31, 44];
  room.game.lastDiscard = { uid: 'd', card: 29, chot: false };
  return room;
}
const hintedCards = () =>
  screen
    .UNSAFE_getAllByType(PlayingCard)
    .filter((card) => card.props.hinted)
    .map((card) => card.props.card)
    .sort((a, b) => a - b);

it('preserves the chốt warning when suggesting an edible final discard', () => {
  const room = eatRoom();
  room.game.lastDiscard!.chot = true;
  render(<PhomGameTable room={room} {...props} />);
  expect(screen.getByText('Ăn chốt được')).toBeTruthy();
  expect(hintedCards()).toEqual([28, 29, 31]);
});

it.each([false, true])(
  'highlights an edible discard and its matching hand cards in landscape=%s',
  (landscape) => {
    const size = {
      width: landscape ? 932 : 375,
      height: landscape ? 430 : 667,
      scale: 2,
      fontScale: 1,
    };
    Dimensions.set({ window: size, screen: size });
    const room = eatRoom(),
      before = JSON.stringify(room);
    const view = render(<PhomGameTable room={room} {...props} />);
    expect(screen.getByText('Ăn được')).toBeTruthy();
    expect(hintedCards()).toEqual([28, 29, 31]);
    expect(
      screen.getByRole('button', { name: '10 cơ' }).props.accessibilityHint,
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ăn bài' })).toBeEnabled();
    expect(props.onAction).not.toHaveBeenCalled();
    expect(JSON.stringify(room)).toBe(before);
    fireEvent.press(screen.getByRole('button', { name: 'Ăn bài' }));
    expect(props.onAction).toHaveBeenCalledWith({
      type: 'play',
      phomAction: 'eat',
      cards: [],
    });
    room.game = {
      ...room.game,
      step: 'discard',
      canEat: false,
      lastDiscard: null,
      hand: [...room.game.hand, 29],
    };
    view.rerender(<PhomGameTable room={room} {...props} />);
    expect(screen.queryByText('Ăn được')).toBeNull();
    expect(hintedCards()).toEqual([]);
  },
);

it.each([
  'server-denied',
  'other-turn',
  'inactive',
  'disabled',
  'busy',
  'read-only',
  'expired',
  'not-draw',
  'finished',
])('does not suggest eating for %s', (condition) => {
  const room = eatRoom();
  if (condition === 'server-denied') room.game.canEat = false;
  if (condition === 'other-turn') room.game.turn = 'b';
  if (condition === 'read-only') room.controller = false;
  if (condition === 'expired') room.game.deadline = props.serverTime - 1;
  if (condition === 'not-draw') room.game.step = 'discard';
  if (condition === 'finished') room.game.status = 'finished';
  render(
    <PhomGameTable
      room={room}
      {...props}
      active={condition !== 'inactive'}
      disabled={condition === 'disabled'}
      busy={condition === 'busy'}
    />,
  );
  expect(screen.queryByText('Ăn được')).toBeNull();
  expect(
    screen
      .UNSAFE_queryAllByType(PlayingCard)
      .filter((card) => card.props.hinted),
  ).toEqual([]);
  expect(props.onAction).not.toHaveBeenCalled();
});
