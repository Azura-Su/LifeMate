import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { CardGameLobbyTable } from '../CardGameLobbyTable';
import type { CardGameRoom } from '../../../types/cardGame';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('../CardGameAvatarImage', () => ({
  CardGameAvatarImage: () => null,
}));

const room: CardGameRoom = {
  id: 'room',
  code: 'ABCDEFGH',
  version: 1,
  epoch: 'epoch',
  matchId: null,
  phase: 'lobby',
  host: 'a',
  ownerUid: 'a',
  controller: true,
  topic: 'topic',
  game: null,
  members: ['a', 'b', 'c', 'd'].map((uid) => ({
    uid,
    name: `Người chơi ${uid} tên dài`,
    ready: false,
    wins: 0,
  })),
};

it.each([
  [568, 320],
  [667, 375],
  [956, 440],
])(
  'keeps opponents, deck and status inside the landscape board at %sx%s',
  (width, height) => {
    jest
      .mocked(useWindowDimensions)
      .mockReturnValue({ width, height, scale: 1, fontScale: 1 });
    const onAction = jest.fn();
    const view = render(
      <CardGameLobbyTable
        room={room}
        uid="a"
        controller
        disabled={false}
        busy={false}
        onAction={onAction}
      />,
    );
    expect(
      StyleSheet.flatten(view.getByTestId('lobby-game-table').props.style)
        .flexDirection,
    ).toBe('column');
    expect(
      StyleSheet.flatten(view.getByTestId('lobby-ready-panel').props.style),
    ).toMatchObject({ flexDirection: 'row', width: '100%' });
    const board = view.getByTestId('lobby-board');
    expect(StyleSheet.flatten(board.props.style).flexDirection).toBe('column');
    const opponents = view.getByTestId('lobby-opponents');
    expect(StyleSheet.flatten(opponents.props.style).flexWrap).toBe('nowrap');
    expect(within(board).getByTestId('lobby-deck')).toBeTruthy();
    expect(within(board).getByText('Chờ mọi người sẵn sàng')).toBeTruthy();
    for (const member of room.members.slice(1)) {
      expect(within(opponents).getByText(member.name).props.numberOfLines).toBe(
        2,
      );
    }
    expect(
      StyleSheet.flatten(view.getByTestId('lobby-own-player').props.style).flex,
    ).toBe(1);
    fireEvent.press(view.getByRole('button', { name: 'Sẵn sàng' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'ready', ready: true });
  },
);
