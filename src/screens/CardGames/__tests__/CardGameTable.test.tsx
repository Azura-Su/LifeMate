import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react-native';
import {
  Animated,
  Dimensions,
  LayoutAnimation,
  StyleSheet,
} from 'react-native';
import type {
  CardGameRoom as AnyCardGameRoom,
  TienLenView,
} from '../../../types/cardGame';

import { colors } from '../../../theme';
import { CardGameTable, getPassCardFlightOffsets } from '../CardGameTable';
import { styles } from '../CardGamesScreen.styles';
import { cardLabel } from '../PlayingCard';

// These fixtures exercise Tiến lên; keep their game type precise after adding Phỏm.
type CardGameRoom = Omit<AnyCardGameRoom, 'game'> & {
  game: TienLenView | null;
};

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('../CardGameAvatarImage', () => ({
  CardGameAvatarImage: () => null,
}));
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const room: CardGameRoom = {
  id: 'room',
  code: 'ABCDEFGH',
  version: 2,
  epoch: 'epoch',
  matchId: 'match',
  phase: 'playing',
  host: 'a',
  controller: true,
  topic: 'topic',
  members: [
    { uid: 'a', name: 'An', ready: false, wins: 0 },
    { uid: 'b', name: 'Bình', ready: false, wins: 0 },
  ],
  game: {
    rulesVersion: 'south-v1',
    status: 'playing',
    hand: [0, 5, 10],
    players: [
      { uid: 'a', count: 3, finished: false, forfeited: false },
      { uid: 'b', count: 12, finished: false, forfeited: false },
    ],
    turn: 'a',
    table: { uid: 'b', cards: [1] },
    passed: [],
    openingCard: null,
    deadline: Date.now() + 30000,
    result: null,
  },
};

it('uses the wide table layout when the match is in landscape', () => {
  Dimensions.set({
    window: { width: 932, height: 430, scale: 3, fontScale: 1 },
    screen: { width: 932, height: 430, scale: 3, fontScale: 1 },
  });

  render(
    <CardGameTable
      room={room}
      uid="a"
      serverTime={Date.now()}
      active={false}
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  expect(screen.getByTestId('game-table-landscape')).toBeTruthy();
  expect(screen.queryByTestId('game-table-scroll')).toBeNull();
  expect(screen.getByText('Bình')).toBeTruthy();
  expect(screen.getByText('Bài 3 · Dư')).toBeTruthy();
  expect(screen.getByTestId('own-balance')).toHaveTextContent('0 đ');
  expect(screen.getByText('Xếp chất')).toBeTruthy();
  expect(screen.queryByText('Chọn bài để mở vòng')).toBeNull();
  expect(screen.queryByText(/Số dư bàn:/)).toBeNull();
  expect(
    StyleSheet.flatten(
      screen.getByRole('button', { name: '3 bích' }).props.style,
    ),
  ).toMatchObject({ minHeight: 84, minWidth: 56 });
  const identity = within(screen.getByTestId('opponent-identity-b'));
  expect(identity.getByText('Bình')).toBeTruthy();
  expect(identity.queryByText('12 lá')).toBeNull();
  expect(screen.getByTestId('opponent-balance-b')).toHaveTextContent('0 đ');
  expect(screen.getByTestId('opponent-balance-b')).toBeTruthy();
  expect(
    within(screen.getByTestId('landscape-pass-action')).getByRole('button', {
      name: 'Bỏ lượt',
    }),
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('landscape-play-action')).getByRole('button', {
      name: 'Đánh 0 lá',
    }),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: '3 bích' })).toBeTruthy();
  expect(StyleSheet.flatten(styles.landscapeStackedHand)).toMatchObject({
    justifyContent: 'center',
  });
  expect(StyleSheet.flatten(styles.opponentIdentityRow)).toMatchObject({
    flexDirection: 'row',
    alignItems: 'stretch',
  });
  expect(StyleSheet.flatten(styles.opponentCopy)).toMatchObject({
    alignItems: 'flex-start',
  });
  expect(StyleSheet.flatten(styles.opponent)).toMatchObject({
    flex: 0,
    maxWidth: '48%',
    backgroundColor: colors.surface,
    borderColor: colors.line,
  });
  expect(StyleSheet.flatten(styles.opponentBalance)).toMatchObject({
    alignSelf: 'flex-start',
    textAlign: 'left',
  });
  expect(StyleSheet.flatten(styles.board)).toMatchObject({
    justifyContent: 'center',
  });
  expect(StyleSheet.flatten(styles.turnIndicator)).toMatchObject({
    flexDirection: 'row',
    alignItems: 'center',
  });
  expect(StyleSheet.flatten(styles.landscapeOpponent)).toMatchObject({
    flexDirection: 'row',
    width: 196,
    minWidth: 156,
    maxWidth: 220,
  });
  expect(StyleSheet.flatten(styles.landscapeOpponentCopy).minWidth).toBe(84);
  expect(screen.getByTestId('remaining-cards-b')).toHaveTextContent(
    'Còn 12 lá',
  );
  expect(StyleSheet.flatten(styles.landscapeBoard)).toMatchObject({
    justifyContent: 'center',
  });
  expect(StyleSheet.flatten(styles.landscapeHandSection)).toMatchObject({
    backgroundColor: colors.surface,
    borderColor: colors.line,
    height: 124,
    paddingHorizontal: 8,
  });
  expect(StyleSheet.flatten(styles.landscapeStackedHand)).toMatchObject({
    minHeight: 84,
  });
});

it('keeps the full opponent name available and permits two readable lines', () => {
  const longName = 'Ngọc Minh Nguyễn';
  const longNameRoom = {
    ...room,
    members: room.members.map((member) =>
      member.uid === 'b' ? { ...member, name: longName } : member,
    ),
  };

  render(
    <CardGameTable
      room={longNameRoom}
      uid="a"
      serverTime={Date.now()}
      active={false}
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  const name = screen.getByTestId('opponent-name-b');
  expect(name.props.children).toBe(longName);
  expect(name.props.numberOfLines).toBe(2);
  expect(name.props.accessibilityLabel).toBe(longName);
});

it('keeps a full landscape hand inside the measured hand slot on a wide device', () => {
  Dimensions.set({
    window: { width: 956, height: 440, scale: 3, fontScale: 1 },
    screen: { width: 956, height: 440, scale: 3, fontScale: 1 },
  });
  const fullHandRoom: CardGameRoom = {
    ...room,
    game: {
      ...room.game!,
      hand: Array.from({ length: 13 }, (_, index) => index),
    },
  };

  render(
    <CardGameTable
      room={fullHandRoom}
      uid="a"
      serverTime={Date.now()}
      active={false}
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  fireEvent(screen.getByTestId('outgoing-hand'), 'layout', {
    nativeEvent: { layout: { width: 382, height: 84, x: 0, y: 0 } },
  });
  const cards = fullHandRoom.game!.hand.map((card) =>
    screen.getByRole('button', { name: cardLabel(card) }),
  );
  const handWidth = cards.reduce((width, card) => {
    const style = StyleSheet.flatten(card.props.style);
    return width + 56 + (style.marginRight ?? 0);
  }, 0);

  expect(handWidth).toBeLessThanOrEqual(382 - 4);
});

it('places three opponents around the landscape table for four players', () => {
  Dimensions.set({
    window: { width: 932, height: 430, scale: 3, fontScale: 1 },
    screen: { width: 932, height: 430, scale: 3, fontScale: 1 },
  });
  const fourPlayerRoom: CardGameRoom = {
    ...room,
    members: [
      { uid: 'a', name: 'An', ready: false, wins: 0 },
      { uid: 'b', name: 'Bình', ready: false, wins: 0 },
      { uid: 'c', name: 'Chi', ready: false, wins: 0 },
      { uid: 'd', name: 'Dũng', ready: false, wins: 0 },
    ],
    game: {
      ...room.game!,
      players: [
        { uid: 'a', count: 3, finished: false, forfeited: false },
        { uid: 'b', count: 13, finished: false, forfeited: false },
        { uid: 'c', count: 13, finished: false, forfeited: false },
        { uid: 'd', count: 13, finished: false, forfeited: false },
      ],
    },
  };

  render(
    <CardGameTable
      room={fourPlayerRoom}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  expect(
    within(screen.getByTestId('landscape-opponent-left')).getByText('Bình'),
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('landscape-opponent-top')).getByText('Chi'),
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('landscape-opponent-right')).getByText('Dũng'),
  ).toBeTruthy();
  expect(StyleSheet.flatten(styles.landscapeOpponent)).toMatchObject({
    borderColor: colors.line,
  });
  expect(StyleSheet.flatten(styles.opponentAvatar)).toMatchObject({
    backgroundColor: colors.primary,
    borderColor: colors.primaryBorder,
  });
  expect(StyleSheet.flatten(styles.opponentMeta)).toMatchObject({
    color: colors.ink,
    fontWeight: '600',
    textAlign: 'center',
  });
  expect(StyleSheet.flatten(styles.landscapeFourOpponent)).toMatchObject({
    minWidth: 112,
    maxWidth: 164,
  });
});

it('stacks a full hand in portrait to fit the screen width', () => {
  Dimensions.set({
    window: { width: 390, height: 844, scale: 3, fontScale: 1 },
    screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
  });

  render(
    <CardGameTable
      room={{
        ...room,
        game: {
          ...room.game!,
          hand: Array.from({ length: 13 }, (_, card) => card),
        },
      }}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  expect(screen.queryByTestId('game-table-landscape')).toBeNull();
  expect(screen.getByTestId('game-table-scroll')).toBeTruthy();
  const heading = within(screen.getByTestId('hand-heading'));
  expect(heading.getByText('Bài 13 · Dư')).toBeTruthy();
  expect(heading.getByTestId('own-balance')).toHaveTextContent('0 đ');
  expect(heading.getByText('Xếp chất')).toBeTruthy();
  expect(screen.queryByText('Số dư bàn:')).toBeNull();
  expect(screen.getAllByTestId('own-balance')).toHaveLength(1);
  const firstCard = screen.getByRole('button', { name: '3 bích' });
  expect(StyleSheet.flatten(firstCard.props.style).marginRight).toBe(-32);
});

it('groups the last play and turn countdown into a compact board status', () => {
  Dimensions.set({
    window: { width: 390, height: 844, scale: 3, fontScale: 1 },
    screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
  });

  render(
    <CardGameTable
      room={room}
      uid="a"
      serverTime={Date.now()}
      active={false}
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  expect(screen.getByText('Bình vừa đánh')).toBeTruthy();
  expect(screen.getByTestId('hand-turn-timer')).toBeTruthy();
  expect(screen.queryByTestId('board-turn-indicator')).toBeNull();
  const heading = screen.getByTestId('hand-heading');
  const headingChildren = heading.props.children as {
    props?: { testID?: string };
  }[];
  const headerIds = headingChildren.map((child) => child.props?.testID);
  expect(headerIds.indexOf('hand-summary')).toBeLessThan(
    headerIds.indexOf('hand-turn-timer'),
  );
  expect(headerIds.indexOf('hand-turn-timer')).toBeLessThan(
    headerIds.indexOf('hand-sort'),
  );
});

it('shows the active opponent countdown below that player', () => {
  Dimensions.set({
    window: { width: 390, height: 844, scale: 3, fontScale: 1 },
    screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
  });
  render(
    <CardGameTable
      room={{ ...room, game: { ...room.game!, turn: 'b' } }}
      uid="a"
      serverTime={Date.now()}
      active={false}
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  expect(
    within(screen.getByTestId('opponent-avatar-column-b')).getByTestId(
      'opponent-turn-timer-b',
    ),
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('opponent-copy-b')).getByTestId(
      'opponent-balance-b',
    ),
  ).toBeTruthy();
  expect(screen.getByTestId('active-player-b')).toHaveTextContent('Đang đánh');
  expect(
    StyleSheet.flatten(screen.getByTestId('opponent-b').props.style)
      .borderWidth,
  ).toBe(2);
  expect(screen.queryByTestId('hand-turn-timer')).toBeNull();
  expect(screen.queryByText('Chọn bài để mở vòng')).toBeNull();
});

it('keeps selected cards selected when the hand is sorted', () => {
  Dimensions.set({
    window: { width: 390, height: 844, scale: 3, fontScale: 1 },
    screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
  });
  render(
    <CardGameTable
      room={room}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  const timing = jest.spyOn(Animated, 'timing');
  const configureNext = jest.spyOn(LayoutAnimation, 'configureNext');
  fireEvent.press(screen.getByRole('button', { name: '3 bích' }));
  expect(
    timing.mock.calls.some(
      ([, config]) => config.duration === 150 && config.useNativeDriver,
    ),
  ).toBe(true);
  const selectedCard = screen.getByRole('button', { name: '3 bích' });
  expect(selectedCard.props.accessibilityState.selected).toBe(true);
  expect(StyleSheet.flatten(selectedCard.props.style).zIndex).toBe(1);
  fireEvent.press(screen.getByTestId('hand-sort'));
  expect(configureNext).toHaveBeenCalledWith(
    LayoutAnimation.Presets.easeInEaseOut,
  );
  expect(
    screen.getByRole('button', { name: '3 bích' }).props.accessibilityState
      .selected,
  ).toBe(true);
  timing.mockRestore();
  configureNext.mockRestore();
});

it('changes active countdown color as server deadline approaches', () => {
  const now = Date.now();
  const view = render(
    <CardGameTable
      room={{
        ...room,
        game: { ...room.game!, turn: 'b', deadline: now + 4000 },
      }}
      uid="a"
      serverTime={now}
      active={false}
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  const timer = screen.getByTestId('opponent-turn-timer-b');
  const timerStyles = StyleSheet.flatten(timer.props.style);
  expect(timerStyles.color).toBe(colors.surface);
  expect(timerStyles.backgroundColor).toBe(colors.danger);
  expect(timerStyles.position).toBe('absolute');
  expect(String(timer.props.children)).toMatch(/^[0-5]$/);

  view.rerender(
    <CardGameTable
      room={{
        ...room,
        game: { ...room.game!, turn: 'b', deadline: now + 1000 },
      }}
      uid="a"
      serverTime={now}
      active={false}
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  expect(
    StyleSheet.flatten(screen.getByTestId('opponent-turn-timer-b').props.style)
      .backgroundColor,
  ).toBe(colors.danger);
});

it('animates a newly confirmed table play using the server cards', () => {
  const timing = jest.spyOn(Animated, 'timing');
  const playedRoom: CardGameRoom = {
    ...room,
    game: {
      ...room.game!,
      hand: [5, 10],
      table: { uid: 'a', cards: [0] },
    },
  };
  const view = render(
    <CardGameTable
      room={room}
      uid="a"
      serverTime={Date.now()}
      active={false}
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  expect(screen.queryByTestId('played-card-arrival-0')).toBeNull();

  view.rerender(
    <CardGameTable
      room={playedRoom}
      uid="a"
      serverTime={Date.now()}
      active={false}
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  expect(screen.getByTestId('played-card-arrival-0')).toBeTruthy();
  expect(screen.getByLabelText('3 bích')).toBeTruthy();
  expect(
    timing.mock.calls.filter(([, config]) => config.duration === 280),
  ).toHaveLength(1);

  view.rerender(
    <CardGameTable
      room={{ ...playedRoom, members: [...playedRoom.members] }}
      uid="a"
      serverTime={Date.now()}
      active={false}
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  expect(
    timing.mock.calls.filter(([, config]) => config.duration === 280),
  ).toHaveLength(1);

  view.rerender(
    <CardGameTable
      room={{ ...playedRoom, game: { ...playedRoom.game!, table: null } }}
      uid="a"
      serverTime={Date.now()}
      active={false}
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  expect(screen.getByTestId('exiting-table-cards')).toBeTruthy();
  expect(timing.mock.calls.some(([, config]) => config.duration === 320)).toBe(
    true,
  );
  timing.mockRestore();
});

it('overlaps played cards while keeping the last card at the edge of the stack', () => {
  render(
    <CardGameTable
      room={{
        ...room,
        game: { ...room.game!, table: { uid: 'b', cards: [0, 4, 8] } },
      }}
      uid="a"
      serverTime={Date.now()}
      active={false}
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  expect(
    StyleSheet.flatten(screen.getByTestId('played-card-arrival-0').props.style)
      .marginRight,
  ).toBe(-32);
  expect(
    StyleSheet.flatten(screen.getByTestId('played-card-arrival-4').props.style)
      .marginRight,
  ).toBe(-32);
  expect(
    StyleSheet.flatten(screen.getByTestId('played-card-arrival-8').props.style)
      .marginRight,
  ).toBe(0);
});

it('animates an opponent pass status and removes it when the trick resets', async () => {
  const view = render(
    <CardGameTable
      room={{ ...room, game: { ...room.game!, passed: [] } }}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  view.rerender(
    <CardGameTable
      room={{
        ...room,
        version: room.version + 1,
        game: { ...room.game!, passed: ['b'] },
      }}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  expect(within(screen.getByTestId('opponent-copy-b')).getByText('Bỏ lượt'));
  expect(screen.getByTestId('pass-card-flight')).toBeTruthy();
  expect(
    screen
      .getAllByRole('button')
      .some((button) =>
        String(button.props.accessibilityLabel ?? '').includes(' bích'),
      ),
  ).toBe(true);

  view.rerender(
    <CardGameTable
      room={{
        ...room,
        version: room.version + 2,
        game: { ...room.game!, passed: [] },
      }}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  await waitFor(() => expect(screen.queryByTestId('passed-status')).toBeNull());
});

it('does not replay the deal animation when a passed trick is cleared', async () => {
  const dealAnimationKey = `${room.id}:${room.matchId}`;
  const view = render(
    <CardGameTable
      room={{ ...room, game: { ...room.game!, table: null } }}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      dealAnimationKey={dealAnimationKey}
      onAction={jest.fn()}
    />,
  );
  await waitFor(() => expect(screen.getByTestId('shuffle-deck')).toBeTruthy());

  view.rerender(
    <CardGameTable
      room={{
        ...room,
        game: { ...room.game!, table: { uid: 'b', cards: [1] }, passed: ['a'] },
      }}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      dealAnimationKey={dealAnimationKey}
      onAction={jest.fn()}
    />,
  );
  view.rerender(
    <CardGameTable
      room={{ ...room, game: { ...room.game!, table: null, passed: [] } }}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      dealAnimationKey={dealAnimationKey}
      onAction={jest.fn()}
    />,
  );

  expect(screen.queryByTestId('shuffle-deck')).toBeNull();
  expect(screen.queryByTestId(/^deal-flight-/)).toBeNull();
});

it('sends pass cards toward seat-specific safe zones in both orientations', () => {
  const twoPlayerSeats = room.game!.players;
  const ownPortraitPath = getPassCardFlightOffsets(
    twoPlayerSeats,
    'a',
    'a',
    false,
  );
  const opponentLandscapePath = getPassCardFlightOffsets(
    twoPlayerSeats,
    'a',
    'b',
    true,
  );
  expect(ownPortraitPath.target.y).toBeGreaterThan(0);
  expect(opponentLandscapePath.target.y).toBeLessThan(0);
  expect(Math.abs(opponentLandscapePath.origin.y)).toBeGreaterThan(
    Math.abs(opponentLandscapePath.target.y),
  );

  const fourPlayerSeats = [
    ...twoPlayerSeats,
    { uid: 'c', name: 'Chi', count: 13, finished: false, forfeited: false },
    { uid: 'd', name: 'Dung', count: 13, finished: false, forfeited: false },
  ];
  const leftPath = getPassCardFlightOffsets(fourPlayerSeats, 'a', 'b', true);
  const topPath = getPassCardFlightOffsets(fourPlayerSeats, 'a', 'c', true);
  const rightPath = getPassCardFlightOffsets(fourPlayerSeats, 'a', 'd', true);
  expect(leftPath.target.x).toBeLessThan(0);
  expect(topPath.target.y).toBeLessThan(0);
  expect(rightPath.target.x).toBeGreaterThan(0);
  expect(leftPath.target).not.toEqual({ x: 0, y: 0 });
  expect(topPath.target).not.toEqual({ x: 0, y: 0 });
  expect(rightPath.target).not.toEqual({ x: 0, y: 0 });
});

it('places three opponents around the portrait table for four players', () => {
  Dimensions.set({
    window: { width: 390, height: 844, scale: 3, fontScale: 1 },
    screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
  });
  const fourPlayerRoom: CardGameRoom = {
    ...room,
    members: [
      { uid: 'a', name: 'An', ready: false, wins: 0 },
      { uid: 'b', name: 'Bình', ready: false, wins: 0 },
      { uid: 'c', name: 'Chi', ready: false, wins: 0 },
      { uid: 'd', name: 'Dũng', ready: false, wins: 0 },
    ],
    game: {
      ...room.game!,
      players: [
        { uid: 'a', count: 3, finished: false, forfeited: false },
        { uid: 'b', count: 13, finished: false, forfeited: false },
        { uid: 'c', count: 13, finished: false, forfeited: false },
        { uid: 'd', count: 13, finished: false, forfeited: false },
      ],
    },
  };

  render(
    <CardGameTable
      room={fourPlayerRoom}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  expect(
    within(screen.getByTestId('portrait-opponent-left')).getByText('Bình'),
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('portrait-opponent-top')).getByText('Chi'),
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('portrait-opponent-right')).getByText('Dũng'),
  ).toBeTruthy();
  expect(screen.getByTestId('portrait-four-player-table')).toBeTruthy();
  expect(StyleSheet.flatten(styles.portraitFourBoard)).toMatchObject({
    paddingTop: 150,
    paddingBottom: 20,
  });
});

it('keeps each stacked card suit visible directly under its rank', () => {
  Dimensions.set({
    window: { width: 390, height: 844, scale: 3, fontScale: 1 },
    screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
  });

  render(
    <CardGameTable
      room={room}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  const card = within(screen.getByRole('button', { name: '3 bích' }));
  const rank = card.getByText('3');
  const suit = card.getByText('♠');
  expect(StyleSheet.flatten(suit.props.style)).toMatchObject({
    alignSelf: 'flex-start',
    marginTop: -1,
    fontSize: 18,
  });
  expect(StyleSheet.flatten(rank.props.style)).toMatchObject({
    fontSize: 16,
    lineHeight: 19,
  });
});

it('keeps play disabled when a pair is selected against a single card', () => {
  render(
    <CardGameTable
      room={{
        ...room,
        game: {
          ...room.game!,
          hand: [4, 5, 9],
          table: { uid: 'b', cards: [0] },
        },
      }}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  fireEvent.press(screen.getByRole('button', { name: '4 bích' }));
  expect(screen.getByRole('button', { name: 'Đánh 1 lá' })).not.toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: '4 chuồn' }));
  expect(screen.getByRole('button', { name: 'Đánh 2 lá' })).toBeDisabled();
});

it('shows a collected deck and lets the host ready for an automatic rematch', () => {
  const onAction = jest.fn();
  const finishedRoom: CardGameRoom = {
    ...room,
    phase: 'finished',
    members: [
      { uid: 'a', name: 'An', ready: false, wins: 1, balance: 5 },
      { uid: 'b', name: 'Bình', ready: true, wins: 0, balance: -5 },
    ],
    game: {
      ...room.game!,
      status: 'finished',
      hand: [],
      turn: null,
      deadline: null,
      result: {
        reason: 'played-out',
        ranking: [
          { uid: 'a', name: 'An', rank: 1, labels: [], moneyDelta: 5 },
          { uid: 'b', name: 'Bình', rank: 2, labels: [], moneyDelta: -5 },
        ],
      },
    },
  };
  render(
    <CardGameTable
      room={finishedRoom}
      resultAnimationKey={`${finishedRoom.id}:${finishedRoom.matchId}`}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={onAction}
    />,
  );

  expect(screen.getByTestId('collected-deck')).toBeTruthy();
  expect(screen.getByTestId('winner-fireworks')).toBeTruthy();
  expect(screen.getByTestId('winner-effects-a')).toBeTruthy();
  expect(screen.getByTestId('player-ready-b')).toBeTruthy();
  expect(screen.queryByText('🎆 ✨ 🎇')).toBeNull();
  expect(screen.getByTestId('own-balance')).toHaveTextContent('0 đ');
  expect(screen.getByTestId('own-balance-delta')).toHaveTextContent('+5');
  expect(screen.getByTestId('opponent-balance-b')).toHaveTextContent('0 đ');
  expect(screen.getByTestId('opponent-balance-b-delta')).toHaveTextContent(
    '-5',
  );
  expect(screen.queryByTestId('round-result-match')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Sẵn sàng' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'ready', ready: true });
});

it('does not show finished opponents who are no longer room members', () => {
  const formerOpponentRoom: CardGameRoom = {
    ...room,
    phase: 'finished',
    members: [{ uid: 'a', name: 'An', ready: false, wins: 1 }],
    game: {
      ...room.game!,
      status: 'finished',
      hand: [],
      turn: null,
      deadline: null,
      result: {
        reason: 'played-out',
        ranking: [
          { uid: 'a', name: 'An', rank: 1, labels: [], moneyDelta: 5 },
          { uid: 'b', name: 'Bình', rank: 2, labels: [], moneyDelta: -5 },
        ],
      },
    },
  };
  render(
    <CardGameTable
      room={formerOpponentRoom}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  expect(screen.queryByTestId('opponent-b')).toBeNull();
});

it('centers the finished-round action in the landscape hand area', () => {
  Dimensions.set({
    window: { width: 932, height: 430, scale: 3, fontScale: 1 },
    screen: { width: 932, height: 430, scale: 3, fontScale: 1 },
  });
  const finishedRoom: CardGameRoom = {
    ...room,
    phase: 'finished',
    game: {
      ...room.game!,
      status: 'finished',
      hand: [],
      turn: null,
      deadline: null,
      result: {
        reason: 'played-out',
        ranking: [{ uid: 'a', rank: 1, labels: [], moneyDelta: 0 }],
      },
    },
  };
  render(
    <CardGameTable
      room={finishedRoom}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  expect(
    StyleSheet.flatten(screen.getByTestId('collected-deck').props.style),
  ).toHaveProperty('marginTop', 0);
  expect(
    within(screen.getByTestId('hand-ready-action')).getByRole('button', {
      name: 'Sẵn sàng',
    }),
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('landscape-play-action')).queryByRole('button'),
  ).toBeNull();
  expect(
    within(screen.getByTestId('landscape-pass-action')).queryByRole('button'),
  ).toBeNull();
});

it('shows explicit readiness beside every seat and leaves rematch to ready actions', () => {
  const finishedRoom: CardGameRoom = {
    ...room,
    phase: 'finished',
    host: 'a',
    members: [
      { uid: 'a', name: 'An', ready: false, wins: 1, balance: 5 },
      { uid: 'b', name: 'Bình', ready: true, wins: 0, balance: -5 },
    ],
    game: {
      ...room.game!,
      status: 'finished',
      hand: [],
      turn: null,
      deadline: null,
      result: {
        reason: 'played-out',
        ranking: [
          { uid: 'b', name: 'Bình', rank: 1, labels: [], moneyDelta: 5 },
          { uid: 'a', name: 'An', rank: 2, labels: [], moneyDelta: -5 },
        ],
      },
    },
  };
  const onAction = jest.fn();

  render(
    <CardGameTable
      room={finishedRoom}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={onAction}
    />,
  );

  expect(screen.getByTestId('winner-effects-b')).toBeTruthy();
  expect(screen.getByTestId('hand-ready-action')).toBeTruthy();
  expect(screen.getByTestId('player-ready-a')).toBeTruthy();
  expect(screen.getByTestId('player-ready-b')).toBeTruthy();
  expect(screen.getByLabelText('Chủ phòng chưa sẵn sàng')).toBeTruthy();
  expect(screen.getByLabelText('Đã sẵn sàng')).toBeTruthy();
  expect(screen.getAllByText('+5 đ')).toHaveLength(1);
  expect(screen.getAllByText('-5 đ')).toHaveLength(1);
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Sẵn sàng' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'ready', ready: true });
});

it('replays result animations when a new match finishes immediately', () => {
  const firstMatch = {
    ...room,
    phase: 'finished' as const,
    matchId: 'instant-1',
    game: {
      ...room.game!,
      status: 'finished' as const,
      hand: [],
      turn: null,
      deadline: null,
      result: {
        reason: 'dragon',
        ranking: [
          { uid: 'a', rank: 1, labels: ['instant-win'], moneyDelta: 0 },
        ],
      },
    },
  };
  const view = render(
    <CardGameTable
      room={firstMatch}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  expect(screen.getByTestId('collected-deck')).toBeTruthy();
  expect(screen.queryByText('Tới trắng · Sảnh rồng')).toBeNull();

  view.rerender(
    <CardGameTable
      room={{ ...firstMatch, matchId: 'instant-2' }}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  expect(screen.getByTestId('collected-deck')).toBeTruthy();
  expect(screen.getByTestId('winner-fireworks')).toBeTruthy();
  expect(screen.queryByTestId('own-balance-delta')).toBeNull();
});

it('animates each changed balance for a four-player finish and skips a cancelled round', () => {
  Dimensions.set({
    window: { width: 932, height: 430, scale: 3, fontScale: 1 },
    screen: { width: 932, height: 430, scale: 3, fontScale: 1 },
  });
  const finished: CardGameRoom = {
    ...room,
    phase: 'finished',
    matchId: 'four-player-finish',
    members: [
      { uid: 'a', name: 'An', ready: false, wins: 1, balance: 300 },
      { uid: 'b', name: 'Bình', ready: false, wins: 0, balance: -100 },
      { uid: 'c', name: 'Chi', ready: false, wins: 0, balance: -150 },
      { uid: 'd', name: 'Dũng', ready: false, wins: 0, balance: -50 },
    ],
    game: {
      ...room.game!,
      status: 'finished',
      hand: [],
      turn: null,
      deadline: null,
      players: [
        { uid: 'a', count: 0, finished: true, forfeited: false, balance: 300 },
        {
          uid: 'b',
          count: 2,
          finished: false,
          forfeited: false,
          balance: -100,
        },
        {
          uid: 'c',
          count: 3,
          finished: false,
          forfeited: false,
          balance: -150,
        },
        { uid: 'd', count: 1, finished: false, forfeited: false, balance: -50 },
      ],
      result: {
        reason: 'played-out',
        ranking: [
          { uid: 'a', rank: 1, labels: [], moneyDelta: 300 },
          { uid: 'b', rank: 2, labels: [], moneyDelta: -100 },
          { uid: 'c', rank: 3, labels: [], moneyDelta: -150 },
          { uid: 'd', rank: 4, labels: [], moneyDelta: -50 },
        ],
      },
    },
  };
  const view = render(
    <CardGameTable
      room={finished}
      resultAnimationKey={`${finished.id}:${finished.matchId}`}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  for (const uid of ['a', 'b', 'c', 'd']) {
    expect(
      screen.getByTestId(
        `${uid === 'a' ? 'own-balance' : `opponent-balance-${uid}`}-delta`,
      ),
    ).toBeTruthy();
  }

  view.rerender(
    <CardGameTable
      room={{
        ...finished,
        phase: 'finished',
        matchId: 'cancelled-round',
        game: {
          ...finished.game!,
          status: 'cancelled',
          result: { reason: 'all-disconnected', ranking: [] },
        },
      }}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  expect(screen.queryByTestId('own-balance-delta')).toBeNull();
  expect(screen.queryByTestId('winner-fireworks')).toBeNull();
});

it('shows settled server balances when a finished table reopens', () => {
  const finishedRoom: CardGameRoom = {
    ...room,
    phase: 'finished',
    matchId: 'same-match-reopen',
    members: [
      { uid: 'a', name: 'An', ready: false, wins: 1, balance: 20 },
      { uid: 'b', name: 'Bình', ready: true, wins: 0, balance: -20 },
    ],
    game: {
      ...room.game!,
      status: 'finished',
      hand: [],
      turn: null,
      deadline: null,
      result: {
        reason: 'played-out',
        ranking: [
          { uid: 'a', rank: 1, labels: [], moneyDelta: 20 },
          { uid: 'b', rank: 2, labels: [], moneyDelta: -20 },
        ],
      },
    },
  };
  const first = render(
    <CardGameTable
      room={finishedRoom}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  first.unmount();

  render(
    <CardGameTable
      room={finishedRoom}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  expect(screen.getByTestId('own-balance')).toHaveTextContent('+20 đ');
  expect(screen.queryByTestId('own-balance-delta')).toBeNull();
  expect(screen.getByTestId('opponent-balance-b')).toHaveTextContent('-20 đ');
});

it('lets the host ready and does not expose a manual rematch button', () => {
  const finishedRoom: CardGameRoom = {
    ...room,
    phase: 'finished',
    members: room.members.map((member) => ({ ...member, ready: false })),
    game: {
      ...room.game!,
      status: 'finished',
      hand: [],
      turn: null,
      deadline: null,
      result: {
        reason: 'completed',
        ranking: [{ uid: 'a', rank: 1, labels: [], moneyDelta: 0 }],
      },
    },
  };
  render(
    <CardGameTable
      room={finishedRoom}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: 'Sẵn sàng' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Bắt đầu ván mới' })).toBeNull();
});

it.each([320, 390, 430])(
  'keeps four player panels readable at portrait width %s',
  (width) => {
    Dimensions.set({
      window: { width, height: 844, scale: 3, fontScale: 1 },
      screen: { width, height: 844, scale: 3, fontScale: 1 },
    });
    const members = [
      { uid: 'a', name: 'An', ready: false, wins: 0 },
      { uid: 'b', name: 'Ngọc Minh Nguyễn', ready: true, wins: 0 },
      { uid: 'c', name: 'Chi', ready: false, wins: 0 },
      { uid: 'd', name: 'Dũng', ready: false, wins: 0 },
    ];
    const four = {
      ...room,
      members,
      phase: 'finished' as const,
      game: {
        ...room.game!,
        status: 'finished' as const,
        players: members.map((m) => ({
          uid: m.uid,
          count: 3,
          finished: false,
          forfeited: false,
        })),
        hand: [],
        turn: null,
        deadline: null,
        result: null,
      },
    };
    const onPlayerPress = jest.fn();
    render(
      <CardGameTable
        room={four}
        uid="a"
        serverTime={Date.now()}
        active
        disabled={false}
        busy={false}
        onAction={jest.fn()}
        onPlayerPress={onPlayerPress}
      />,
    );
    const left = StyleSheet.flatten(
      screen.getByTestId('portrait-opponent-left').props.style,
    );
    expect(left.width).toBeGreaterThanOrEqual(108);
    expect(left.width * 2).toBeLessThan(width - 24);
    expect(screen.getByTestId('opponent-name-b').props.children).toBe(
      'Ngọc Minh Nguyễn',
    );
    expect(screen.getByTestId('player-ready-b').props.numberOfLines).toBe(1);
    fireEvent.press(
      screen.getByRole('button', {
        name: 'Thông tin người chơi Ngọc Minh Nguyễn',
      }),
    );
    expect(onPlayerPress).toHaveBeenCalledWith('b');
    fireEvent.press(
      screen.getByRole('button', { name: 'Ảnh người chơi Ngọc Minh Nguyễn' }),
    );
    expect(onPlayerPress).toHaveBeenCalledTimes(2);
  },
);

it('moves the active highlight and timer when the server changes the turn', () => {
  Dimensions.set({
    window: { width: 932, height: 430, scale: 3, fontScale: 1 },
    screen: { width: 932, height: 430, scale: 3, fontScale: 1 },
  });
  const props = {
    room: { ...room, game: { ...room.game!, turn: 'b' } },
    uid: 'a',
    serverTime: Date.now(),
    active: false,
    disabled: false,
    busy: false,
    onAction: jest.fn(),
  };
  const view = render(<CardGameTable {...props} />);
  expect(screen.getByTestId('active-player-b')).toBeTruthy();
  expect(screen.getByTestId('opponent-turn-timer-b')).toBeTruthy();
  view.rerender(<CardGameTable {...props} room={room} />);
  expect(screen.queryByTestId('active-player-b')).toBeNull();
  expect(screen.queryByTestId('opponent-turn-timer-b')).toBeNull();
  expect(screen.getByTestId('hand-turn-timer')).toBeTruthy();
  expect(
    StyleSheet.flatten(screen.getByTestId('hand-area').props.style),
  ).toMatchObject({ borderWidth: 2, backgroundColor: colors.successSoft });
});
