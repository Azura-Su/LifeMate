import { parseGameSnapshot } from '../gameProtocol';
import { phomRoom } from '../../../testing/phomFixture';
import { DEFAULT_PHOM_CONFIG, isPhomConfig } from '../phomConfig';

function finishedRoom() {
  const room = phomRoom();
  room.phase = 'finished';
  room.game.status = 'finished';
  room.game.turn = null;
  room.game.deadline = null;
  room.game.result = {
    reason: 'phom-points',
    ranking: room.game.players.map((p, index) => ({
      uid: p.uid,
      rank: index + 1,
      labels: [],
      deadwoodPoints: 10,
      moneyDelta: 0,
      breakdown: [],
    })),
  };
  room.game.players = room.game.players.map((p) => ({
    ...p,
    count: 2,
    resultCards: { discards: [30, 31, 32, 33, 34], remaining: [40, 41] },
  }));
  return room;
}

it('accepts finished result cards while retaining compatibility with older result snapshots', () => {
  const room = finishedRoom();
  const parsed = parseGameSnapshot({ room, serverTime: 1 }, 'a');
  expect(parsed.room?.game?.players[0]).toHaveProperty(
    'resultCards.remaining',
    [40, 41],
  );
  room.game.players = room.game.players.map(
    ({ resultCards: _cards, ...p }) => p,
  );
  expect(() => parseGameSnapshot({ room, serverTime: 1 }, 'a')).not.toThrow();
});

it('rejects premature, private, malformed or inconsistent result cards', () => {
  for (const bad of [
    { discards: [0], remaining: [40, 40] },
    { discards: [40], remaining: [40, 41] },
    { discards: [52], remaining: [40, 41] },
    { discards: [], remaining: [40] },
    { discards: [], remaining: [40, 41], stock: [2] },
  ]) {
    const room = finishedRoom();
    Object.assign(room.game.players[0], { resultCards: bad });
    expect(() => parseGameSnapshot({ room, serverTime: 1 }, 'a')).toThrow();
  }
  for (const status of ['playing', 'cancelled'] as const) {
    const room = finishedRoom();
    room.game.status = status;
    if (status === 'playing') {
      room.phase = 'playing';
      room.game.turn = 'a';
      room.game.deadline = 100;
      room.game.result = null;
    }
    expect(() => parseGameSnapshot({ room, serverTime: 1 }, 'a')).toThrow();
  }
});

it('accepts only complete boolean options in active and pending config while retaining legacy defaults', () => {
  const room = phomRoom();
  const config = {
    ...DEFAULT_PHOM_CONFIG,
    options: { tai: true, send: false, uDen: false },
  };
  expect(
    parseGameSnapshot(
      {
        room: { ...room, phomConfig: config, nextPhomConfig: config },
        serverTime: 1,
      },
      'a',
    ).room?.phomConfig,
  ).toEqual(config);
  expect(isPhomConfig(DEFAULT_PHOM_CONFIG)).toBe(true);
  for (const options of [
    undefined,
    null,
    {},
    { tai: 1, send: true, uDen: true },
    { tai: true, send: true, uDen: true, extra: true },
  ])
    expect(isPhomConfig({ ...config, options })).toBe(false);
});

it('accepts bounded public Phỏm fields and rejects private/invalid state', () => {
  const room = phomRoom();
  expect(
    parseGameSnapshot({ room, serverTime: 1 }, 'a').room?.game?.rulesVersion,
  ).toBe('phom-v1');
  for (const game of [
    { ...room.game, stock: [1] },
    {
      ...room.game,
      players: room.game!.players.map((p) => ({ ...p, hand: [1] })),
    },
    { ...room.game, stockCount: 53 },
    { ...room.game, canEat: 'yes' },
    {
      ...room.game,
      players: room.game!.players.map((p) => ({ ...p, melds: [[1, 2]] })),
    },
  ])
    expect(() =>
      parseGameSnapshot({ room: { ...room, game }, serverTime: 1 }, 'a'),
    ).toThrow();
  expect(() =>
    parseGameSnapshot(
      { room: { ...room, gameKind: 'south' }, serverTime: 1 },
      'a',
    ),
  ).toThrow();
  expect(() =>
    parseGameSnapshot(
      {
        room: { ...room, phomConfig: { ...room.phomConfig, u: -1 } },
        serverTime: 1,
      },
      'a',
    ),
  ).toThrow();
});

it('validates pending Phỏm rates without replacing the active rates', () => {
  const room = phomRoom();
  const nextPhomConfig = { ...room.phomConfig!, u: 123 };
  const parsed = parseGameSnapshot(
    { room: { ...room, nextPhomConfig }, serverTime: 1 },
    'a',
  ).room!;
  expect(parsed.nextPhomConfig).toEqual(nextPhomConfig);
  expect(parsed.phomConfig).toEqual(room.phomConfig);
  for (const bad of [
    null,
    {},
    { ...nextPhomConfig, u: -1 },
    { ...nextPhomConfig, u: 1.2 },
    { ...nextPhomConfig, u: 1e9 + 1 },
    { ...nextPhomConfig, extra: 0 },
  ])
    expect(() =>
      parseGameSnapshot(
        { room: { ...room, nextPhomConfig: bad }, serverTime: 1 },
        'a',
      ),
    ).toThrow();
  expect(() =>
    parseGameSnapshot(
      { room: { ...room, gameKind: 'south', nextPhomConfig }, serverTime: 1 },
      'a',
    ),
  ).toThrow();
});
