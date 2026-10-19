import { render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import type { CardGameRoom } from '../../../types/cardGame';
import { CardGameTable } from '../CardGameTable';

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

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
  expect(screen.getByRole('button', { name: '3 bích' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Đánh 0 lá' })).toBeTruthy();
});
