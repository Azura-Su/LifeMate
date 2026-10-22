import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import type { CardGameRoom } from '../../../types/cardGame';
import { CardGameTable } from '../CardGameTable';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('../CardGameAvatarImage', () => ({
  CardGameAvatarImage: () => null,
}));

function viewport(width: number, height: number) {
  Dimensions.set({
    window: { width, height, scale: 3, fontScale: 1 },
    screen: { width, height, scale: 3, fontScale: 1 },
  });
}
function fixture(id: string): CardGameRoom {
  return {
    id,
    code: 'ABCDEFGH',
    version: 1,
    epoch: 'epoch',
    matchId: id + '-match',
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
        { uid: 'b', count: 4, finished: false, forfeited: false },
      ],
      turn: 'a',
      table: { uid: 'b', cards: [1] },
      passed: [],
      openingCard: null,
      deadline: Date.now() + 40000,
      result: null,
    },
  };
}
function finished(room: CardGameRoom): CardGameRoom {
  return {
    ...room,
    version: room.version + 1,
    phase: 'finished',
    game: {
      ...room.game!,
      status: 'finished',
      turn: null,
      deadline: null,
      result: {
        reason: 'played-out',
        ranking: [
          { uid: 'b', rank: 1, labels: [] },
          { uid: 'a', rank: 2, labels: [] },
        ],
      },
    },
  };
}
beforeEach(() => {
  jest.useFakeTimers();
  viewport(390, 844);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('ends dealing and preserves selected cards across rotation without dealing again', () => {
  const room = fixture('rotation-settle');
  room.game!.table = null;
  const props = {
    room,
    uid: 'a',
    serverTime: Date.now(),
    active: true,
    disabled: false,
    busy: false,
    dealAnimationKey: `${room.id}:${room.matchId}`,
    onAction: jest.fn(),
  };
  const timing = jest.spyOn(Animated, 'timing');
  const view = render(<CardGameTable {...props} />);
  expect(screen.getByTestId('shuffle-deck')).toBeTruthy();
  act(() => jest.advanceTimersByTime(5000));
  fireEvent.press(screen.getByRole('button', { name: '3 bích' }));
  const dealCount = timing.mock.calls.filter(
    ([, c]) => c.duration === 240,
  ).length;
  act(() => viewport(932, 430));
  view.rerender(<CardGameTable {...props} />);
  expect(
    screen.getByRole('button', { name: '3 bích' }).props.accessibilityState
      .selected,
  ).toBe(true);
  expect(timing.mock.calls.filter(([, c]) => c.duration === 240)).toHaveLength(
    dealCount,
  );
  expect(screen.queryByTestId('shuffle-deck')).toBeNull();
  expect(screen.queryAllByTestId(/^deal-flight-/)).toHaveLength(0);
});

it('settles a deal interrupted by rotation and lets the current hand be selected', () => {
  const room = fixture('rotation-interrupt');
  room.game!.table = null;
  const props = {
    room,
    uid: 'a',
    serverTime: Date.now(),
    active: true,
    disabled: false,
    busy: false,
    dealAnimationKey: `${room.id}:${room.matchId}`,
    onAction: jest.fn(),
  };
  render(<CardGameTable {...props} />);
  act(() => viewport(932, 430));
  expect(screen.queryByTestId('shuffle-deck')).toBeNull();
  expect(screen.getByRole('button', { name: '3 bích' })).not.toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: '3 bích' }));
  expect(
    screen.getByRole('button', { name: '3 bích' }).props.accessibilityState
      .selected,
  ).toBe(true);
});

it('lowers selected cards immediately and shows a confirmed final pass without removing real cards', () => {
  const room = fixture('final-pass');
  const onAction = jest.fn();
  const props = {
    room,
    uid: 'a',
    serverTime: Date.now(),
    active: true,
    disabled: false,
    busy: false,
    onAction,
  };
  const view = render(<CardGameTable {...props} />);
  fireEvent.press(screen.getByRole('button', { name: '4 chuồn' }));
  fireEvent.press(screen.getByRole('button', { name: 'Bỏ lượt' }));
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(onAction).toHaveBeenCalledWith({ type: 'pass' });
  expect(
    screen.getByRole('button', { name: '4 chuồn' }).props.accessibilityState
      .selected,
  ).toBe(false);
  expect(screen.queryByTestId('pass-card-flight')).toBeNull();
  const next = {
    ...room,
    version: 2,
    game: { ...room.game!, table: null, passed: [], turn: 'b' },
  };
  view.rerender(<CardGameTable {...props} room={next} />);
  expect(screen.getByTestId('pass-card-flight')).toBeTruthy();
  expect(screen.getByRole('button', { name: '4 chuồn' })).toBeTruthy();
  act(() => jest.advanceTimersByTime(1100));
  expect(screen.queryByTestId('pass-card-flight')).toBeNull();
  expect(screen.queryAllByTestId(/^deal-flight-/)).toHaveLength(0);
});

it('holds and collects the last cards before readiness, then reopens the settled result without fireworks', () => {
  const room = fixture('collection');
  const props = {
    room,
    uid: 'a',
    serverTime: Date.now(),
    active: true,
    disabled: false,
    busy: false,
    onAction: jest.fn(),
  };
  const view = render(<CardGameTable {...props} />);
  const result = finished(room);
  view.rerender(<CardGameTable {...props} room={result} />);
  expect(
    screen.getByTestId('collecting-hand', { includeHiddenElements: true }),
  ).toBeTruthy();
  expect(screen.queryByTestId('collected-deck')).toBeNull();
  expect(
    screen.getByTestId('round-feedback-a', { includeHiddenElements: true }),
  ).toHaveTextContent('Thua');
  act(() => jest.advanceTimersByTime(450));
  expect(
    screen.getByTestId('collecting-hand', { includeHiddenElements: true }),
  ).toBeTruthy();
  act(() => jest.advanceTimersByTime(550));
  expect(
    screen.queryByTestId('collecting-hand', { includeHiddenElements: true }),
  ).toBeNull();
  expect(screen.getByTestId('collected-deck')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sẵn sàng' })).toBeTruthy();
  view.unmount();
  render(<CardGameTable {...props} room={result} />);
  expect(screen.queryByTestId('winner-fireworks')).toBeNull();
  expect(
    screen.queryByTestId('collecting-hand', { includeHiddenElements: true }),
  ).toBeNull();
});

it('cancels collection when the next server match arrives before its timer finishes', () => {
  const room = fixture('rapid-rematch');
  const props = {
    room,
    uid: 'a',
    serverTime: Date.now(),
    active: true,
    disabled: false,
    busy: false,
    onAction: jest.fn(),
  };
  const view = render(<CardGameTable {...props} />);
  view.rerender(<CardGameTable {...props} room={finished(room)} />);
  expect(
    screen.getByTestId('collecting-hand', { includeHiddenElements: true }),
  ).toBeTruthy();
  const next = {
    ...room,
    matchId: 'next-match',
    game: { ...room.game!, hand: [20, 21], table: null },
  };
  view.rerender(<CardGameTable {...props} room={next} />);
  act(() => jest.advanceTimersByTime(1200));
  expect(
    screen.queryByTestId('collecting-hand', { includeHiddenElements: true }),
  ).toBeNull();
  expect(screen.queryByTestId('collected-deck')).toBeNull();
  expect(screen.getByRole('button', { name: '8 bích' })).toBeTruthy();
});

it('uses compact cards for a narrow 13-card hand', () => {
  viewport(320, 640);
  const room = fixture('narrow-hand');
  room.game!.hand = Array.from({ length: 13 }, (_, index) => index);
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
  const card = screen.getByRole('button', { name: '3 bích' });
  expect(StyleSheet.flatten(card.props.style).minWidth).toBe(44);
});

it('does not let hidden readiness submit while the last cards are being collected', () => {
  const room = fixture('hidden-ready');
  const onAction = jest.fn();
  const props = {
    room,
    uid: 'a',
    serverTime: Date.now(),
    active: true,
    disabled: false,
    busy: false,
    onAction,
  };
  const view = render(<CardGameTable {...props} />);
  view.rerender(<CardGameTable {...props} room={finished(room)} />);
  expect(screen.queryByRole('button', { name: 'Sẵn sàng' })).toBeNull();
  fireEvent.press(
    screen.getByLabelText('Sẵn sàng', { includeHiddenElements: true }),
  );
  expect(onAction).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1000));
  fireEvent.press(screen.getByRole('button', { name: 'Sẵn sàng' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'ready', ready: true });
});

it('clears pass and outgoing-card effects when the server replaces the match', () => {
  const room = fixture('pass-rematch');
  const props = {
    room,
    uid: 'a',
    serverTime: Date.now(),
    active: true,
    disabled: false,
    busy: false,
    onAction: jest.fn(),
  };
  const view = render(<CardGameTable {...props} />);
  view.rerender(
    <CardGameTable
      {...props}
      room={{
        ...room,
        version: 2,
        game: { ...room.game!, table: null, turn: 'b' },
      }}
    />,
  );
  expect(screen.getByTestId('pass-card-flight')).toBeTruthy();
  view.rerender(
    <CardGameTable
      {...props}
      room={{
        ...room,
        matchId: 'different-match',
        game: { ...room.game!, table: null },
      }}
    />,
  );
  expect(screen.queryByTestId('pass-card-flight')).toBeNull();
  expect(screen.queryByTestId('exiting-table-cards')).toBeNull();
});

it('preserves suit sorting while the remaining hand is collected', () => {
  const room = fixture('suit-collection');
  room.game!.hand = [0, 1, 4];
  const props = {
    room,
    uid: 'a',
    serverTime: Date.now(),
    active: true,
    disabled: false,
    busy: false,
    onAction: jest.fn(),
  };
  const view = render(<CardGameTable {...props} />);
  fireEvent.press(screen.getByTestId('hand-sort'));
  view.rerender(<CardGameTable {...props} room={finished(room)} />);
  const collection = within(
    screen.getByTestId('collecting-hand', { includeHiddenElements: true }),
  );
  expect(
    collection
      .getAllByLabelText(/bích|chuồn/, { includeHiddenElements: true })
      .map((card) => card.props.accessibilityLabel),
  ).toEqual(['3 bích', '4 bích', '3 chuồn']);
});
