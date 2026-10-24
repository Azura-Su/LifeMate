import type { CardGameRoom } from '../types/cardGame';
import type { PhomView } from '../types/phom';
import { DEFAULT_PHOM_CONFIG } from '../services/cardGames/phomConfig';
export function phomRoom(): CardGameRoom & { game: PhomView } {
  const id = '11111111-1111-4111-8111-111111111111',
    epoch = '22222222-2222-4222-8222-222222222222';
  return {
    id,
    epoch,
    code: 'ABCDEFGH',
    version: 2,
    matchId: '33333333-3333-4333-8333-333333333333',
    phase: 'playing',
    host: 'a',
    ownerUid: 'a',
    controller: true,
    topic: `card-room:${id}:${epoch}`,
    gameKind: 'phom',
    phomConfig: { ...DEFAULT_PHOM_CONFIG },
    members: ['a', 'b', 'c', 'd'].map((uid) => ({
      uid,
      name: `Bạn ${uid}`,
      ready: false,
      wins: 0,
      balance: 0,
    })),
    game: {
      rulesVersion: 'phom-v1',
      status: 'playing',
      hand: [0, 4, 8, 16, 20, 24, 28, 32, 36, 40],
      players: ['a', 'b', 'c', 'd'].map((uid) => ({
        uid,
        count: uid === 'a' ? 10 : 9,
        finished: false,
        forfeited: false,
        eaten: [],
        melds: [],
        discards: [],
        laid: false,
        turns: 0,
      })),
      turn: 'a',
      deadline: Date.now() + 40000,
      step: 'discard',
      stockCount: 15,
      lastDiscard: null,
      canEat: false,
      canU: false,
      table: null,
      passed: [],
      openingCard: null,
      result: null,
    },
  };
}
