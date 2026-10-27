import { parseGameRoomStatus, parseGameSnapshot } from '../gameProtocol';
import {
  defaultVariantConfigForGame,
  isVariantGameConfig,
} from '../variantGameProtocol';
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

it.each([
  {
    gameKind: 'north',
    game: {
      rulesVersion: 'north-v1',
      status: 'playing',
      hand: [0, 4],
      players: [
        { uid: 'a', count: 2, finished: false, forfeited: false },
        { uid: 'b', count: 3, finished: false, forfeited: false },
      ],
      turn: 'a',
      table: null,
      passed: [],
      openingCard: 0,
      deadline: 40000,
      result: null,
    },
  },
  {
    gameKind: 'sam',
    game: {
      rulesVersion: 'sam-v1',
      status: 'playing',
      step: 'report-sam',
      hand: [0, 4],
      players: [
        { uid: 'a', count: 2, finished: false, forfeited: false },
        { uid: 'b', count: 3, finished: false, forfeited: false },
      ],
      turn: 'a',
      reportOrder: ['a', 'b'],
      reported: [],
      reportedSam: false,
      callUid: null,
      samOutcome: null,
      table: null,
      passed: [],
      openingCard: null,
      deadline: 40000,
      result: null,
    },
  },
  {
    gameKind: 'tan',
    game: {
      rulesVersion: 'tan-v1',
      status: 'playing',
      step: 'attack',
      hand: [0, 4],
      players: [
        { uid: 'a', count: 2, finished: false, forfeited: false },
        { uid: 'b', count: 3, finished: false, forfeited: false },
      ],
      stockCount: 35,
      trumpCard: 40,
      trumpSuit: 0,
      attackerUid: 'a',
      defenderUid: 'b',
      turn: 'a',
      maxAttackCards: 8,
      table: [],
      deadline: 40000,
      result: null,
    },
  },
])('validates the private-safe $gameKind game view and selected cards', ({ gameKind, game }) => {
  const members = [
    { uid: 'a', name: 'An', ready: false, wins: 0 },
    { uid: 'b', name: 'Bình', ready: false, wins: 0 },
  ];
  const variant = {
    ...room,
    gameKind,
    phase: 'playing',
    matchId: '33333333-3333-4333-8333-333333333333',
    members,
    game,
  };
  expect(parseGameSnapshot({ room: variant, serverTime: 100 }, 'a').room?.game).toEqual(game);
  if (gameKind === 'tan') {
    const twoPlayerTan = {
      ...variant,
      game: { ...game, stockCount: 36 },
    };
    expect(
      parseGameSnapshot({ room: twoPlayerTan, serverTime: 100 }, 'a').room
        ?.game,
    ).toEqual(twoPlayerTan.game);
  }
  for (const invalid of [
    { ...game, rulesVersion: 'wrong' },
    { ...game, privateDeck: [1, 2, 3] },
    {
      ...game,
      players: game.players.map((player) =>
        player.uid === 'a' ? { ...player, count: player.count + 1 } : player,
      ),
    },
    ...(gameKind === 'north'
      ? [{ ...game, table: { uid: 'b', cards: [0] } }]
      : gameKind === 'sam'
        ? [{ ...game, table: { uid: 'b', cards: [0] } }]
        : [
            {
              ...game,
              table: [{ attackCard: 0, defenseCard: null, attackerUid: 'b' }],
            },
          ]),
  ])
    expect(() =>
      parseGameSnapshot(
        { room: { ...variant, game: invalid }, serverTime: 100 },
        'a',
      ),
    ).toThrow();
});

it('accepts v9 room capability metadata for new variants', () => {
  const status = {
    roomId: id,
    minClientVersion: 9,
    gameKind: 'tan',
    exists: true,
    owner: true,
    canRejoin: true,
    canReopen: false,
    canDelete: false,
    expired: false,
    phase: 'playing',
    version: 3,
    matchId: '33333333-3333-4333-8333-333333333333',
  };
  expect(parseGameRoomStatus(status, id)).toEqual(status);
});

it('validates variant point settings strictly and defaults legacy variants to one point per card', () => {
  const legacy = {
    ...room,
    gameKind: 'north',
  };
  expect(
    parseGameSnapshot({ room: legacy, serverTime: 100 }, 'a').room
      ?.variantConfig,
  ).toEqual({ pointsPerCard: 1 });
  expect(
    parseGameSnapshot(
      {
        room: {
          ...legacy,
          variantConfig: { pointsPerCard: 7 },
          nextVariantConfig: { pointsPerCard: 3 },
        },
        serverTime: 100,
      },
      'a',
    ).room?.nextVariantConfig,
  ).toEqual({ pointsPerCard: 3 });
  for (const variantConfig of [
    { pointsPerCard: 0 },
    { pointsPerCard: 1.5 },
    { pointsPerCard: 1, cash: true },
    { pointsPerCard: 1_000_000_001 },
  ])
    expect(() =>
      parseGameSnapshot(
        { room: { ...legacy, variantConfig }, serverTime: 100 },
        'a',
      ),
    ).toThrow();
  expect(() =>
    parseGameSnapshot(
      { room: { ...room, variantConfig: { pointsPerCard: 2 } }, serverTime: 100 },
      'a',
    ),
  ).toThrow();
});

it('accepts protocol 10 room capability metadata', () => {
  const status = {
    roomId: id,
    minClientVersion: 10,
    gameKind: 'tan',
    exists: true,
    owner: true,
    canRejoin: true,
    canReopen: false,
    canDelete: false,
    expired: false,
    phase: 'playing',
    version: 3,
    matchId: '33333333-3333-4333-8333-333333333333',
  };
  expect(parseGameRoomStatus(status, id)).toEqual(status);
});

it('accepts protocol 11 room capability metadata and rejects unsupported versions', () => {
  const status = {
    roomId: id,
    minClientVersion: 11,
    gameKind: 'sam',
    exists: true,
    owner: true,
    canRejoin: true,
    canReopen: false,
    canDelete: false,
    expired: false,
    phase: 'playing',
    version: 3,
    matchId: '33333333-3333-4333-8333-333333333333',
  };
  expect(parseGameRoomStatus(status, id)).toEqual(status);
  expect(() =>
    parseGameRoomStatus({ ...status, minClientVersion: 13 }, id),
  ).toThrow();
});

it('accepts protocol 12 room capability metadata for South instant-win rules', () => {
  const status = {
    roomId: id,
    minClientVersion: 12,
    gameKind: 'south',
    exists: true,
    owner: true,
    canRejoin: true,
    canReopen: false,
    canDelete: false,
    expired: false,
    phase: 'playing',
    version: 3,
    matchId: '33333333-3333-4333-8333-333333333333',
  };
  expect(parseGameRoomStatus(status, id)).toEqual(status);
});

it('separates new North/Sâm profiles from the legacy room defaults', () => {
  expect(defaultVariantConfigForGame('north')).toEqual({
    rulesVersion: 'north-v2',
    pointsPerCard: 1,
    remainingTwoPoints: 2,
    cutTwoPoints: 3,
  });
  expect(defaultVariantConfigForGame('sam')).toEqual({
    rulesVersion: 'sam-v2',
    pointsPerCard: 1,
    samCallPoints: 20,
  });
  expect(defaultVariantConfigForGame('tan')).toEqual({ pointsPerCard: 1 });

  expect(isVariantGameConfig({ pointsPerCard: 1 }, 'north')).toBe(true);
  expect(
    isVariantGameConfig(
      {
        rulesVersion: 'north-v2',
        pointsPerCard: 5,
        remainingTwoPoints: 2,
        cutTwoPoints: 3,
      },
      'north',
    ),
  ).toBe(true);
  expect(
    isVariantGameConfig(
      { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 20 },
      'sam',
    ),
  ).toBe(true);
  expect(
    isVariantGameConfig(
      { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 20 },
      'north',
    ),
  ).toBe(false);
  expect(
    isVariantGameConfig(
      {
        rulesVersion: 'north-v2',
        pointsPerCard: 1,
        remainingTwoPoints: -1,
        cutTwoPoints: 3,
      },
      'north',
    ),
  ).toBe(false);
});

it('parses North and Sâm v2 configs with strict fields', () => {
  const northV2 = {
    rulesVersion: 'north-v2',
    pointsPerCard: 2,
    remainingTwoPoints: 3,
    cutTwoPoints: 4,
  };
  const samV2 = {
    rulesVersion: 'sam-v2',
    pointsPerCard: 2,
    samCallPoints: 20,
  };
  expect(
    parseGameSnapshot(
      { room: { ...room, gameKind: 'north', variantConfig: northV2 }, serverTime: 100 },
      'a',
    ).room?.variantConfig,
  ).toEqual(northV2);
  expect(
    parseGameSnapshot(
      { room: { ...room, gameKind: 'sam', variantConfig: samV2 }, serverTime: 100 },
      'a',
    ).room?.variantConfig,
  ).toEqual(samV2);
  for (const [gameKind, variantConfig] of [
    ['north', { ...northV2, cutTwoPoints: -1 }],
    ['north', { ...northV2, unexpected: true }],
    ['north', samV2],
  ] as const)
    expect(() =>
      parseGameSnapshot(
        { room: { ...room, gameKind, variantConfig }, serverTime: 100 },
        'a',
      ),
    ).toThrow();
});

it('accepts a Sâm v2 match with an aborted pending báo result', () => {
  const samV2 = {
    rulesVersion: 'sam-v2',
    pointsPerCard: 1,
    samCallPoints: 20,
  };
  const roomWithSam = {
    ...room,
    gameKind: 'sam',
    variantConfig: samV2,
    phase: 'finished',
    matchId: '33333333-3333-4333-8333-333333333333',
    members: [
      { uid: 'a', name: 'An', ready: false, wins: 0 },
      { uid: 'b', name: 'Bình', ready: false, wins: 0 },
    ],
    game: {
      rulesVersion: 'sam-v2',
      status: 'finished',
      step: 'play',
      hand: [],
      players: [
        { uid: 'a', count: 0, finished: false, forfeited: true },
        { uid: 'b', count: 5, finished: false, forfeited: false },
      ],
      turn: null,
      reportOrder: [],
      reported: [],
      reportedSam: true,
      callUid: 'a',
      samOutcome: 'aborted',
      table: null,
      passed: [],
      openingCard: null,
      deadline: null,
      result: {
        reason: 'forfeit',
        ranking: [
          { uid: 'b', rank: 1, labels: [], remainingCards: 5, moneyDelta: 0, breakdown: [] },
          { uid: 'a', rank: 2, labels: ['forfeit'], remainingCards: 10, moneyDelta: 0, breakdown: [] },
        ],
      },
    },
  };
  expect(
    parseGameSnapshot({ room: roomWithSam, serverTime: 100 }, 'a').room?.game,
  ).toMatchObject({ rulesVersion: 'sam-v2', samOutcome: 'aborted' });

  const unbalancedRoom = {
    ...roomWithSam,
    game: {
      ...roomWithSam.game,
      result: {
        ...roomWithSam.game.result,
        ranking: roomWithSam.game.result.ranking.map((entry, index) =>
          index === 0 ? { ...entry, moneyDelta: 1 } : entry,
        ),
      },
    },
  };
  expect(() =>
    parseGameSnapshot({ room: unbalancedRoom, serverTime: 100 }, 'a'),
  ).toThrow();
});
