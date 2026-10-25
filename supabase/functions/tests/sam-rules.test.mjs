import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySam,
  canBeatSam,
  newSamGame,
  actSam,
  viewSam,
  forfeitSamPlayers,
} from '../game-access/sam.mjs';

test('Sâm combinations use rank only and exclude 2 from straights', () => {
  assert.equal(classifySam([0])?.kind, 'single');
  assert.equal(classifySam([0, 1])?.kind, 'pair');
  assert.equal(classifySam([0, 1, 2])?.kind, 'triple');
  assert.equal(classifySam([0, 1, 2, 3])?.kind, 'quad');
  assert.equal(classifySam([0, 5, 10])?.kind, 'straight');
  assert.equal(classifySam([36, 41, 46])?.kind, 'straight'); // Q-K-A
  assert.equal(classifySam([40, 45, 50]), null); // K-A-2
  assert.equal(classifySam([0, 5]), null);
  assert.equal(classifySam([0, 0]), null);
});

test('Sâm compares same shape by rank and never by suit', () => {
  assert.equal(canBeatSam([4], [0]), true);
  assert.equal(canBeatSam([4, 5], [0, 1]), true);
  assert.equal(canBeatSam([36, 41, 46], [32, 37, 42]), true);
  assert.equal(canBeatSam([0, 1], [0]), false);
});

test('Sâm v2 lets a quad cut one 2 while the legacy profile keeps its old comparator', () => {
  assert.equal(canBeatSam([4, 5, 6, 7], [48], 'sam-v1'), false);
  assert.equal(canBeatSam([4, 5, 6, 7], [48], 'sam-v2'), true);
  assert.equal(canBeatSam([4, 5, 6, 7], [48, 49], 'sam-v2'), false);
});

test('deals ten cards and starts deterministic sequential Sâm reporting', () => {
  const game = newSamGame(['a', 'b', 'c'], Array.from({ length: 52 }, (_, i) => i), 100);
  assert.deepEqual(game.reportOrder, ['a', 'b', 'c']);
  assert.equal(game.turn, 'a');
  assert.equal(game.players.every((player) => player.hand.length === 10), true);
  assert.equal(game.stock.length, 22);
  assert.equal(game.step, 'report-sam');
  const view = viewSam(game, 'b');
  assert.equal(view.openingCard, null);
  assert.deepEqual(view.hand, Array.from({ length: 10 }, (_, i) => 1 + i * 3));
  assert.equal('stock' in view, false);
  assert.equal('players' in view && view.players.some((player) => 'hand' in player), false);
});

test('all reports pass and the opening card owner leads', () => {
  const game = newSamGame(['a', 'b'], Array.from({ length: 52 }, (_, i) => i), 0);
  const afterA = actSam(game, 'a', { type: 'pass-report' }, 1);
  const afterB = actSam(afterA, 'b', { type: 'pass-report' }, 2);
  assert.equal(afterB.step, 'play');
  assert.equal(afterB.turn, 'a');
  assert.equal(afterB.openingCard, 0);
  assert.equal(afterB.callUid, null);
});

test('first report is accepted in seat order and caller starts the hand', () => {
  const game = newSamGame(['a', 'b', 'c'], Array.from({ length: 52 }, (_, i) => i), 0);
  assert.throws(() => actSam(game, 'b', { type: 'call-sam' }, 1), /wrong-turn/);
  const reported = actSam(game, 'a', { type: 'call-sam' }, 2);
  assert.equal(reported.step, 'play');
  assert.equal(reported.turn, 'a');
  assert.equal(reported.callUid, 'a');
  assert.equal(reported.reportedSam, true);
});

test('Sâm v2 freezes report recipients and voids a pending call if its caller leaves', () => {
  const game = newSamGame(
    ['a', 'b', 'c'],
    Array.from({ length: 52 }, (_, i) => i),
    0,
    null,
    { rulesVersion: 'sam-v2', pointsPerCard: 1, samCallPoints: 20 },
  );
  const called = actSam(game, 'a', { type: 'call-sam' }, 1);
  assert.deepEqual(called.samCallRecipients, ['b', 'c']);
  assert.equal(called.rulesVersion, 'sam-v2');
  const afterCallerLeaves = forfeitSamPlayers(called, ['a'], 2);
  assert.equal(afterCallerLeaves.samOutcome, 'aborted');
  assert.deepEqual(afterCallerLeaves.samCallRecipients, ['b', 'c']);
});

test('being beaten marks a Sâm call failed, game continues, and emptying wins immediately', () => {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  const game = newSamGame(['a', 'b'], deck, 0);
  let state = actSam(game, 'a', { type: 'call-sam' }, 1);
  const openerCard = state.players.find((p) => p.uid === 'a').hand.includes(0)
    ? 0
    : Math.min(...state.players.find((p) => p.uid === 'a').hand);
  state = actSam(state, 'a', { type: 'play', cards: [openerCard] }, 2);
  const responder = state.turn;
  const hand = state.players.find((p) => p.uid === responder).hand;
  const higher = hand.find((card) => Math.floor(card / 4) > Math.floor(openerCard / 4));
  if (higher !== undefined) {
    const beaten = actSam(state, responder, { type: 'play', cards: [higher] }, 3);
    assert.equal(beaten.samOutcome, 'failed');
    assert.equal(beaten.status, 'playing');
  }

  const winState = structuredClone(game);
  winState.players[0].hand = [0];
  winState.players[1].hand = [1, 2, 3];
  winState.turn = 'a';
  winState.step = 'play';
  winState.openingCard = 0;
  winState.callUid = 'a';
  winState.reportedSam = true;
  winState.samOutcome = 'pending';
  winState.callUid = 'a';
  winState.reportedSam = true;
  const won = actSam(winState, 'a', { type: 'play', cards: [0] }, 4);
  assert.equal(won.status, 'finished');
  assert.equal(won.samOutcome, 'success');
  assert.equal(won.result.ranking[0].uid, 'a');
});

test('a non-opener can report and win Sâm without owning the opening card, ending a 3-player hand', () => {
  let state = newSamGame(['a', 'b', 'c'], Array.from({ length: 52 }, (_, i) => i), 0);
  state = actSam(state, 'a', { type: 'pass-report' }, 1);
  state = actSam(state, 'b', { type: 'call-sam' }, 2);
  assert.equal(state.openingCard, null);
  state.players.find((player) => player.uid === 'b').hand = [12];
  state = actSam(state, 'b', { type: 'play', cards: [12] }, 3);
  assert.equal(state.status, 'finished');
  assert.equal(state.samOutcome, 'success');
  assert.equal(state.result.reason, 'sam-success');
  assert.equal(state.result.ranking[0].uid, 'b');
});

test('if the report opener leaves, remaining players can pass and the next live seat opens', () => {
  let state = newSamGame(['a', 'b', 'c'], Array.from({ length: 52 }, (_, i) => i), 0);
  state = forfeitSamPlayers(state, ['a'], 1);
  assert.equal(state.turn, 'b');
  state = actSam(state, 'b', { type: 'pass-report' }, 2);
  state = actSam(state, 'c', { type: 'pass-report' }, 3);
  assert.equal(state.step, 'play');
  assert.equal(state.turn, 'b');
  assert.equal(state.players.find((player) => player.uid === 'b').hand.includes(state.openingCard), true);
});

test('if the opening-card owner leaves after reporting, the next live low card opens without privacy leakage', () => {
  let state = newSamGame(['a', 'b', 'c'], Array.from({ length: 52 }, (_, i) => i), 0);
  state = actSam(state, 'a', { type: 'pass-report' }, 1);
  state = actSam(state, 'b', { type: 'pass-report' }, 2);
  state = actSam(state, 'c', { type: 'pass-report' }, 3);
  assert.equal(viewSam(state, 'b').openingCard, null);
  state = forfeitSamPlayers(state, ['a'], 4);
  assert.equal(state.turn, 'b');
  const replacementOpeningCard = state.openingCard;
  assert.equal(state.players.find((player) => player.uid === 'b').hand.includes(replacementOpeningCard), true);
  const timed = actSam(state, 'b', { type: 'timeout' }, state.deadline);
  assert.equal(timed.players.find((player) => player.uid === 'b').hand.includes(replacementOpeningCard), false);
});

test('a failed Sâm caller who later goes out does not turn the failed call into success', () => {
  const state = newSamGame(['a', 'b', 'c'], Array.from({ length: 52 }, (_, i) => i), 0);
  state.step = 'play';
  state.openingCard = null;
  state.turn = 'a';
  state.callUid = 'a';
  state.reportedSam = true;
  state.samOutcome = 'failed';
  state.players[0].hand = [5];
  state.players[1].hand = [0, 8];
  state.players[2].hand = [4, 12];
  const next = actSam(state, 'a', { type: 'play', cards: [5] }, 1);
  assert.equal(next.status, 'playing');
  assert.equal(next.samOutcome, 'failed');
});

test('pass clears a trick after all eligible opponents pass; timeout makes a safe action', () => {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  let state = newSamGame(['a', 'b'], deck, 0);
  state = actSam(state, 'a', { type: 'pass-report' }, 1);
  state = actSam(state, 'b', { type: 'pass-report' }, 2);
  const lead = state.players[0].hand.find((card) => card === state.openingCard);
  state = actSam(state, 'a', { type: 'play', cards: [lead] }, 3);
  const nextUid = state.turn;
  state = actSam(state, nextUid, { type: 'pass' }, 4);
  assert.equal(state.turn, 'a');
  assert.equal(state.table, null);

  const expired = { ...state, deadline: 5 };
  const timed = actSam(expired, 'a', { type: 'timeout' }, 5);
  assert.equal(timed.status, 'playing');
  assert.ok(timed.turn);
});
