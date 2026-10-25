import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameHandler } from '../game-access/handler.mjs';
import { roomSnapshot } from '../game-access/rooms.mjs';
import {
  newPhomGame,
  forfeitPhomPlayers,
  viewPhom,
} from '../game-access/phom.mjs';
import { DEFAULT_PHOM_CONFIG } from '../game-access/phom-scoring.mjs';

const deck = Array.from({ length: 52 }, (_, i) => i);
const roomId = '11111111-1111-4111-8111-111111111111';
const matchId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const actionId = '44444444-4444-4444-8444-444444444444';
function record(game) {
  return {
    id: roomId,
    code: 'ABCDEFGH',
    version: 2,
    match_id: matchId,
    epoch: 'epoch',
    state: {
      gameKind: 'phom',
      phomConfig: DEFAULT_PHOM_CONFIG,
      phase: game.status === 'playing' ? 'playing' : 'finished',
      host: 'a',
      ownerUid: 'a',
      game,
      members: ['a', 'b'].map((uid) => ({
        uid,
        name: uid,
        ready: false,
        wins: 0,
      })),
    },
  };
}
const playingGame = () => newPhomGame(['a', 'b'], deck, 0, DEFAULT_PHOM_CONFIG);

test('result cards are absent while playing, cancelled, and from legacy finished snapshots', () => {
  const playing = playingGame();
  const finished = forfeitPhomPlayers(playing, ['b'], 1);
  const cancelled = forfeitPhomPlayers(playing, ['a', 'b'], 1);
  for (const game of [playing, cancelled]) {
    const view = viewPhom(game, 'a', true);
    assert.ok(
      view.players.every((p) => !('resultCards' in p) && !('hand' in p)),
    );
    assert.ok(!('stock' in view));
  }
  for (const version of [3, 4, 5, 6, 7]) {
    const view = roomSnapshot(record(finished), 'a', true, 1, true, version);
    assert.ok(view.room.game.players.every((p) => !('resultCards' in p)));
  }
  const view = roomSnapshot(record(finished), 'a', true, 1, true, 8).room.game;
  for (const player of finished.players) {
    assert.deepEqual(
      view.players.find((p) => p.uid === player.uid).resultCards.remaining,
      player.hand,
    );
  }
  assert.throws(
    () => roomSnapshot(record(finished), 'outsider', true, 1, true, 8),
    /not-member/,
  );
});

test('finished details retain eaten discards and more than four discarded cards without mutating state', () => {
  const game = forfeitPhomPlayers(playingGame(), ['b'], 1);
  game.players[0].discards = [40, 44, 48, 49];
  game.eats = [24, 28, 32].map((card) => ({
    from: 'a',
    to: 'b',
    card,
    chot: false,
  }));
  const before = structuredClone(game);
  const view = viewPhom(game, 'a', true);
  assert.deepEqual(
    view.players[0].resultCards.discards,
    [24, 28, 32, 40, 44, 48, 49],
  );
  view.players[0].resultCards.remaining.pop();
  view.players[0].resultCards.discards.pop();
  assert.deepEqual(game, before);
});

test('protocol8 result views and rule-capability RPCs preserve the existing SQL capability7 contract', async () => {
  const game = forfeitPhomPlayers(playingGame(), ['b'], 1);
  const room = record(game);
  const calls = [];
  const handler = createGameHandler({
    verifyIdentity: async () => ({ uid: 'a', authTime: 1 }),
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'lifemate_game_read')
        return { room, controller: true, now: 1 };
      if (name === 'lifemate_game_receipt') return null;
      if (name === 'lifemate_game_set_phom_rules')
        return { record: room, controller: true, now: 1, ack: { version: 2 } };
      if (name === 'lifemate_game_takeover') return null;
      throw Error(`Unexpected RPC ${name}`);
    },
  });
  const post = async (input) => {
    const response = await handler(
      new Request('https://example.invalid/game-access', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ sessionId, clientVersion: 8, ...input }),
      }),
    );
    assert.equal(
      response.status,
      200,
      JSON.stringify(await response.clone().json()),
    );
    return response.json();
  };
  const result = await post({ type: 'sync' });
  assert.deepEqual(
    result.room.game.players[1].resultCards.remaining,
    game.players[1].hand,
  );
  await post({ type: 'takeover', roomId });
  await post({
    type: 'set-phom-rules',
    roomId,
    matchId,
    actionId,
    expectedVersion: 2,
    phomConfig: {
      ...DEFAULT_PHOM_CONFIG,
      options: { tai: false, send: true, uDen: true },
    },
  });
  for (const name of ['lifemate_game_takeover', 'lifemate_game_set_phom_rules'])
    assert.equal(
      calls.find((call) => call.name === name).args.p_client_version,
      7,
    );
});
