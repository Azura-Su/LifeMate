import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import type { CardGameRoom, TanView } from '../../../types/cardGame';
import { TanGameTable } from '../TanGameTable';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('../CardGameAvatarImage', () => ({
  CardGameAvatarImage: () => null,
}));

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
  gameKind: 'tan',
  members: [
    { uid: 'a', name: 'An', ready: true, wins: 0 },
    { uid: 'b', name: 'Bình', ready: true, wins: 0 },
  ],
  game: {
    rulesVersion: 'tan-v1',
    status: 'playing',
    step: 'attack',
    hand: [0, 5, 10],
    players: [
      { uid: 'a', count: 3, finished: false, forfeited: false },
      { uid: 'b', count: 8, finished: false, forfeited: false },
    ],
    stockCount: 35,
    trumpCard: 40,
    trumpSuit: 0,
    attackerUid: 'a',
    defenderUid: 'b',
    turn: 'a',
    maxAttackCards: 8,
    table: [],
    deadline: Date.now() + 30_000,
    result: null,
  },
};

it('sends a selected attack through the authoritative game-action command', () => {
  const onAction = jest.fn();
  render(
    <TanGameTable
      room={room}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={onAction}
    />,
  );

  fireEvent.press(screen.getByRole('button', { name: '3 bích' }));
  fireEvent.press(screen.getByRole('button', { name: 'Tấn 1 lá' }));

  expect(onAction).toHaveBeenCalledWith({
    type: 'game-action',
    gameAction: { type: 'attack', card: 0 },
  });
});

it('keeps the Tấn table and hand usable in landscape', () => {
  Dimensions.set({
    window: { width: 932, height: 430, scale: 3, fontScale: 1 },
    screen: { width: 932, height: 430, scale: 3, fontScale: 1 },
  });
  render(
    <TanGameTable
      room={room}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  expect(screen.getByText('Chủ ♠ · Nọc 35')).toBeTruthy();
  expect(screen.getByRole('button', { name: '3 bích' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Tấn 1 lá' })).toBeTruthy();
});

it.each([-60_000, 60_000])(
  'keeps the server turn deadline authoritative with device clock skew %i ms',
  (deviceClockOffset) => {
    const serverTime = Date.now() + deviceClockOffset;
    const skewedRoom = {
      ...room,
      game: {
        ...room.game!,
        deadline: serverTime + 30_000,
      },
    };
    render(
      <TanGameTable
        room={skewedRoom}
        uid="a"
        serverTime={serverTime}
        active
        disabled={false}
        busy={false}
        onAction={jest.fn()}
      />,
    );

    expect(screen.getByText('Lượt của bạn · 30s')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: '3 bích' }));
    expect(screen.getByRole('button', { name: 'Tấn 1 lá' })).toBeEnabled();
  },
);

it('shows ready controls after a finished match and lets a player join the rematch', () => {
  const onAction = jest.fn();
  const finishedRoom: CardGameRoom = {
    ...room,
    phase: 'finished',
    variantConfig: { pointsPerCard: 1 },
    members: room.members.map((member) => ({
      ...member,
      ready: member.uid !== 'a',
    })),
    game: {
      ...room.game!,
      status: 'finished',
      step: 'finished',
      turn: null,
      deadline: null,
      result: { reason: 'completed', ranking: [] },
    } as TanView,
  };

  render(
    <TanGameTable
      room={finishedRoom}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={onAction}
    />,
  );

  expect(screen.getByText('1/2 sẵn sàng')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Sẵn sàng' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'ready', ready: true });
});

it('shows Tấn round deltas and cumulative balances in points beside rematch controls', () => {
  const finishedRoom: CardGameRoom = {
    ...room,
    phase: 'finished',
    members: [
      { uid: 'a', name: 'An', ready: false, wins: 1, balance: 14 },
    ],
    game: {
      ...room.game!,
      status: 'finished',
      step: 'finished',
      turn: null,
      deadline: null,
      players: [
        { uid: 'a', name: 'An', count: 0, finished: true, forfeited: false, balance: 14 },
        { uid: 'b', name: 'Bình', count: 8, finished: false, forfeited: false, balance: -14 },
      ],
      result: {
        reason: 'last-standing',
        ranking: [
          { uid: 'a', name: 'An', rank: 1, labels: [], moneyDelta: 8, remainingCards: 0 },
          { uid: 'b', name: 'Bình', rank: 2, labels: [], moneyDelta: -8, remainingCards: 8 },
        ],
      },
    } as TanView,
  };
  render(
    <TanGameTable
      room={finishedRoom}
      uid="a"
      serverTime={Date.now()}
      active
      disabled={false}
      busy={false}
      onAction={jest.fn()}
    />,
  );

  expect(screen.getByTestId('tan-result-delta-a')).toHaveTextContent('+8 điểm');
  expect(screen.getByTestId('tan-result-balance-a')).toHaveTextContent(
    'Tổng 14 điểm',
  );
  expect(screen.getByTestId('tan-result-delta-b')).toHaveTextContent('-8 điểm');
  expect(screen.getByTestId('tan-result-balance-b')).toHaveTextContent(
    'Tổng -14 điểm',
  );
  expect(screen.getByTestId('tan-score-explanation')).toHaveTextContent(
    /Người thua còn 8 lá: −8 điểm \(8 × \(2−1\) × 1\); mỗi người về trước \+8 điểm\./,
  );
  expect(screen.getByRole('button', { name: 'Sẵn sàng' })).toBeTruthy();
});
