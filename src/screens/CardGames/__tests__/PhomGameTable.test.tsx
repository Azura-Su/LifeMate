import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import { PhomGameTable } from '../PhomGameTable';
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

it('retains own discarded cards and offers a bounded public history dialog', () => {
  const room = phomRoom();
  room.game.players[0].discards = [44];
  render(<PhomGameTable room={room} {...props} />);
  expect(screen.getByTestId('phom-own-public-cards')).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Bài đã đánh và phỏm trên bàn' }),
  );
  expect(
    screen.getByRole('header', { name: 'Bài đã đánh và phỏm' }),
  ).toBeTruthy();
  expect(screen.getByText('Bạn a (Bạn)')).toBeTruthy();
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
  fireEvent.press(screen.getByText('Hạ phỏm'));
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
