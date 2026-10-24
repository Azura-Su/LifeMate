import { parseGameSnapshot } from '../gameProtocol';
const id = '11111111-1111-4111-8111-111111111111',
  epoch = '22222222-2222-4222-8222-222222222222';
const room = {
  id,
  epoch,
  code: 'ABCDEFGH',
  version: 1,
  matchId: null,
  phase: 'lobby',
  host: 'a',
  controller: true,
  topic: `card-room:${id}:${epoch}`,
  members: [{ uid: 'a', name: 'An', ready: false, wins: 0 }],
  game: null,
};

it('validates configured South settings, fee participants and pinned game version', () => {
  const southConfig = { finishMode: 'first-winner', cutTwoAmount: 17 };
  const configured = {
    ...room,
    southConfig,
    members: [
      ...room.members,
      { uid: 'b', name: 'Bình', ready: false, wins: 0 },
    ],
    phase: 'playing',
    game: {
      rulesVersion: 'south-v2',
      southConfig,
      status: 'playing',
      hand: [0],
      players: [
        { uid: 'a', count: 1, finished: false, forfeited: false },
        { uid: 'b', count: 2, finished: false, forfeited: false },
      ],
      turn: 'a',
      table: null,
      passed: [],
      openingCard: null,
      deadline: 40000,
      result: null,
      cutTwoFees: [{ from: 'b', to: 'a', count: 2, amount: 34 }],
    },
  };
  expect(
    parseGameSnapshot({ room: configured, serverTime: 100 }, 'a').room
      ?.southConfig,
  ).toEqual(southConfig);
  for (const game of [
    { ...configured.game, rulesVersion: 'south-v1' },
    { ...configured.game, southConfig: { ...southConfig, cutTwoAmount: 18 } },
    { ...configured.game, stock: [1] },
    {
      ...configured.game,
      cutTwoFees: [{ from: 'outsider', to: 'a', count: 2, amount: 34 }],
    },
    {
      ...configured.game,
      cutTwoFees: [{ from: 'b', to: 'a', count: 2, amount: 35 }],
    },
  ])
    expect(() =>
      parseGameSnapshot(
        { room: { ...configured, game }, serverTime: 100 },
        'a',
      ),
    ).toThrow();
});
it('accepts the viewer snapshot and rejects leaked private room state or another viewer', () => {
  expect(parseGameSnapshot({ room, serverTime: 100 }, 'a').room?.id).toBe(id);
  expect(() =>
    parseGameSnapshot(
      { room: { ...room, state: { stock: [1, 2] } }, serverTime: 100 },
      'a',
    ),
  ).toThrow();
  expect(() => parseGameSnapshot({ room, serverTime: 100 }, 'b')).toThrow();
});

it('accepts an explicitly ownerless room after the owner account is erased', () => {
  expect(
    parseGameSnapshot(
      { room: { ...room, ownerUid: null }, serverTime: 100 },
      'a',
    ).room?.ownerUid,
  ).toBeNull();
});

it('accepts only a validated kicked event attached to an empty room', () => {
  const removal = {
    id: '11111111-1111-4111-8111-111111111111',
    roomId: '22222222-2222-4222-8222-222222222222',
    reason: 'kicked',
  };
  expect(
    parseGameSnapshot({ room: null, serverTime: 10, removal }, 'a'),
  ).toEqual({ room: null, serverTime: 10, refreshToken: undefined, removal });
  for (const invalid of [
    { ...removal, id: 'bad' },
    { ...removal, reason: 'other' },
    { ...removal, sessionId: 'private' },
  ]) {
    expect(() =>
      parseGameSnapshot({ room: null, serverTime: 10, removal: invalid }, 'a'),
    ).toThrow();
  }
});

it('validates next-round rules separately from the current round settings', () => {
  const nextSouthRules = {
    amountPerCard: 9,
    southConfig: { finishMode: 'first-winner', cutTwoAmount: 17 },
  };
  expect(
    parseGameSnapshot(
      { serverTime: 100, room: { ...room, amountPerCard: 5, nextSouthRules } },
      'a',
    ).room?.nextSouthRules,
  ).toEqual(nextSouthRules);
  for (const invalid of [
    null,
    {},
    { ...nextSouthRules, amountPerCard: 0 },
    { ...nextSouthRules, amountPerCard: 1.5 },
    { ...nextSouthRules, amountPerCard: 1_000_000_001 },
    { ...nextSouthRules, extra: true },
    {
      ...nextSouthRules,
      southConfig: { finishMode: 'unknown', cutTwoAmount: 0 },
    },
  ])
    expect(() =>
      parseGameSnapshot(
        { serverTime: 100, room: { ...room, nextSouthRules: invalid } },
        'a',
      ),
    ).toThrow();
});
