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
