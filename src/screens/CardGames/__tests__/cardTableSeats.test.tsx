import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { CardGameTable, getPassCardFlightOffsets } from '../CardGameTable';
import { PhomGameTable } from '../PhomGameTable';
import { PhomSeat } from '../PhomTableParts';
import { CardGameAvatarImage } from '../CardGameAvatarImage';
import { getOpponentsInSeatOrder } from '../cardTableMotion';
import { phomRoom } from '../../../testing/phomFixture';
import type { CardGameRoom, TienLenView } from '../../../types/cardGame';

jest.mock('../CardGameAvatarImage', () => ({
  CardGameAvatarImage: jest.fn(() => null),
}));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function viewport(landscape: boolean) {
  const size = {
    width: landscape ? 667 : 375,
    height: landscape ? 375 : 667,
    scale: 2,
    fontScale: 1,
  };
  Dimensions.set({ window: size, screen: size });
}
const props = () => ({
  serverTime: Date.now(),
  active: true,
  disabled: false,
  busy: false,
  onAction: jest.fn(),
});
function southRoom(size: number): CardGameRoom & { game: TienLenView } {
  const source = phomRoom();
  return {
    ...source,
    gameKind: 'south',
    phomConfig: undefined,
    members: source.members.slice(0, size),
    game: {
      rulesVersion: 'south-v1',
      status: 'playing',
      hand: [0, 4, 8],
      players: source.game.players.slice(0, size).map((p) => ({
        uid: p.uid,
        count: 13,
        finished: false,
        forfeited: false,
      })),
      turn: 'b',
      table: null,
      passed: [],
      openingCard: 0,
      deadline: Date.now() + 40000,
      result: null,
    },
  };
}

for (const landscape of [false, true]) {
  for (const size of [2, 3, 4]) {
    for (let viewer = 0; viewer < size; viewer++) {
      it(`rotates South ${size} seats for viewer${viewer} in ${landscape ? 'landscape' : 'portrait'} without changing the match`, () => {
        viewport(landscape);
        const room = southRoom(size),
          uid = room.game.players[viewer].uid;
        // Response/member order is not the authority for an active match's seats.
        room.members.reverse();
        const expected = [
          ...room.game.players.slice(viewer + 1),
          ...room.game.players.slice(0, viewer),
        ];
        const before = JSON.stringify(room),
          onPlayerPress = jest.fn();
        Object.freeze(room.game.players);
        render(
          <CardGameTable
            room={room}
            uid={uid}
            {...props()}
            onPlayerPress={onPlayerPress}
          />,
        );
        if (size === 4) {
          for (const [index, slot] of ['left', 'top', 'right'].entries()) {
            expect(
              within(
                screen.getByTestId(
                  `${landscape ? 'landscape' : 'portrait'}-opponent-${slot}`,
                ),
              ).getByTestId(`opponent-${expected[index].uid}`),
            ).toBeTruthy();
          }
        } else {
          expect(
            screen
              .getAllByTestId(/^opponent-[abcd]$/)
              .map((node) => node.props.testID),
          ).toEqual(expected.map((p) => `opponent-${p.uid}`));
        }
        for (const opponent of expected) {
          const name = room.members.find((m) => m.uid === opponent.uid)!.name;
          fireEvent.press(
            within(screen.getByTestId(`opponent-${opponent.uid}`)).getByRole(
              'button',
              { name: `Thông tin người chơi ${name}` },
            ),
          );
          expect(onPlayerPress).toHaveBeenLastCalledWith(opponent.uid);
        }
        if (uid !== 'b')
          expect(screen.getByTestId('opponent-b')).toHaveTextContent(
            /đang đánh/i,
          );
        expect(JSON.stringify(room)).toBe(before);
      });
    }
  }
}

for (const viewer of ['a', 'b', 'c', 'd']) {
  it(`uses the same relative seats for South pass and deal fallback from ${viewer}`, () => {
    viewport(true);
    const room = southRoom(4),
      offset = room.game.players.findIndex((p) => p.uid === viewer);
    const ordered = [
      ...room.game.players.slice(offset + 1),
      ...room.game.players.slice(0, offset),
    ];
    render(
      <CardGameTable
        room={room}
        uid={viewer}
        {...props()}
        dealAnimationKey={`relative-deal-${viewer}`}
      />,
    );
    const paths = ordered.map((p) =>
      getPassCardFlightOffsets(room.game.players, viewer, p.uid, true),
    );
    expect(paths[0].origin.x).toBeLessThan(0);
    expect(paths[1].origin.y).toBeLessThan(0);
    expect(paths[2].origin.x).toBeGreaterThan(0);
    for (const [index, p] of ordered.entries()) {
      expect(screen.getByTestId(`deal-flight-${p.uid}-0`)).toBeTruthy();
      const { x, y } = screen.UNSAFE_root.findByProps({
        playerUID: p.uid,
        cardIndex: 0,
      }).props.origin;
      if (index === 0) expect(x).toBeLessThan(0);
      if (index === 1) expect(y).toBeLessThan(0);
      if (index === 2) expect(x).toBeGreaterThan(0);
    }
  });
}

function finishedPhom(size: number) {
  const room = phomRoom();
  room.members = room.members.slice(0, size);
  room.game.players = room.game.players.slice(0, size);
  room.phase = 'finished';
  room.game.status = 'finished';
  room.game.turn = null;
  room.game.deadline = null;
  room.game.result = {
    reason: 'phom-points',
    ranking: room.members.map((m, i) => ({
      uid: m.uid,
      name: m.name,
      rank: i + 1,
      labels: [],
      remainingCards: 9,
      moneyDelta: 0,
    })),
  };
  return room;
}

it('uses current South room order after leave/rejoin while preserving the finished game order', () => {
  viewport(true);
  const room = southRoom(4);
  room.phase = 'finished';
  room.game.status = 'finished';
  room.game.turn = null;
  room.game.deadline = null;
  room.members = [
    room.members[0],
    room.members[2],
    room.members[3],
    room.members[1],
  ];
  const history = JSON.stringify(room.game);
  render(<CardGameTable room={room} uid="a" {...props()} />);
  for (const [index, slot] of ['left', 'top', 'right'].entries()) {
    expect(
      within(screen.getByTestId(`landscape-opponent-${slot}`)).getByTestId(
        `opponent-${['c', 'd', 'b'][index]}`,
      ),
    ).toBeTruthy();
  }
  expect(JSON.stringify(room.game)).toBe(history);
});

it('returns a deterministic immutable presentation copy when self is missing', () => {
  const players = Object.freeze([{ uid: 'b' }, { uid: 'c' }]);
  const result = getOpponentsInSeatOrder(players, 'a');
  expect(result).toEqual(players);
  expect(result).not.toBe(players);
  expect(getOpponentsInSeatOrder([], 'a')).toEqual([]);
});

for (const count of [-1, NaN, Infinity, 11, undefined]) {
  it(`does not render an invalid Phỏm count ${count}`, () => {
    const room = phomRoom();
    render(
      <PhomSeat
        room={room}
        seat={{
          participant: { ...room.game.players[1], count: count as number },
        }}
        seconds={40}
        landscape={false}
      />,
    );
    expect(screen.queryByText(/^Còn .* lá$/)).toBeNull();
  });
}
for (const size of [2, 3, 4]) {
  it(`Phỏm${size} replaces waiting seats by current members without changing participants/results`, () => {
    viewport(false);
    const room = finishedPhom(size),
      history = JSON.stringify(room.game);
    const newcomer = {
      uid: 'e',
      name: 'Người mới',
      ready: true,
      wins: 7,
      balance: 99,
      avatarUrl: 'https://avatar.invalid/new.jpg',
    };
    room.members = [...room.members.filter((m) => m.uid !== 'b'), newcomer];
    const onPlayerPress = jest.fn();
    const view = render(
      <PhomGameTable
        room={room}
        uid="a"
        {...props()}
        onPlayerPress={onPlayerPress}
      />,
    );
    const button = screen.getByRole('button', {
      name: 'Thông tin người chơi Người mới',
    });
    expect(
      screen.queryByRole('button', { name: 'Thông tin người chơi Bạn b' }),
    ).toBeNull();
    fireEvent.press(button);
    expect(onPlayerPress).toHaveBeenCalledWith('e');
    expect(CardGameAvatarImage).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'e',
        name: 'Người mới',
        url: newcomer.avatarUrl,
      }),
      undefined,
    );
    expect(
      within(screen.getByTestId('phom-seat-e')).getByText('+99 đ'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('phom-seat-e')).getByLabelText('Sẵn sàng'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('phom-seat-e')).queryByText(/lá/),
    ).toBeNull();
    expect(screen.getByText('#2 Bạn b')).toBeTruthy();
    view.rerender(
      <PhomGameTable
        room={{ ...room, members: room.members.filter((m) => m.uid !== 'e') }}
        uid="a"
        {...props()}
        onPlayerPress={onPlayerPress}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Thông tin người chơi Người mới' }),
    ).toBeNull();
    expect(JSON.stringify(room.game)).toBe(history);
  });
}

it('retains Phỏm active participants and public cards after a member leaves', () => {
  const room = phomRoom();
  room.members = room.members.filter((m) => m.uid !== 'b');
  room.game.players[1].forfeited = true;
  room.game.players[1].discards = [44];
  const before = JSON.stringify(room.game);
  render(
    <PhomGameTable
      room={room}
      uid="a"
      {...props()}
      onPlayerPress={jest.fn()}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Thông tin người chơi Người chơi' }),
  ).toBeDisabled();
  expect(screen.getByText('Bỏ cuộc')).toBeTruthy();
  expect(JSON.stringify(room.game)).toBe(before);
});

for (const size of [2, 3, 4]) {
  it(`shows updated Phỏm counts by UID for all ${size} viewers across draw/discard/lay/send`, () => {
    viewport(false);
    const room = phomRoom();
    room.members = room.members.slice(0, size);
    room.game.players = room.game.players.slice(0, size);
    for (const viewer of room.members) {
      const view = render(
        <PhomGameTable
          room={room}
          uid={viewer.uid}
          {...props()}
          onPlayerPress={jest.fn()}
        />,
      );
      const target = room.game.players.find((p) => p.uid !== viewer.uid)!;
      for (const [index, count] of [9, 10, 9, 3, 2, 0].entries()) {
        const updated = {
          ...room,
          game: {
            ...room.game,
            turn: index % 2 ? target.uid : viewer.uid,
            players: room.game.players.map((p) =>
              p.uid === target.uid ? { ...p, count, laid: index >= 3 } : p,
            ),
          },
        };
        view.rerender(
          <PhomGameTable
            room={updated}
            uid={viewer.uid}
            {...props()}
            onPlayerPress={jest.fn()}
          />,
        );
        expect(screen.getAllByText(`Còn ${count} lá`).length).toBeGreaterThan(
          0,
        );
        expect(
          within(screen.getByTestId(`phom-seat-${target.uid}`)).getByText(
            `Còn ${count} lá`,
          ),
        ).toBeTruthy();
      }
      view.unmount();
    }
  });
}
