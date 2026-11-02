import { roomCodeFromQr, roomQrData } from '../roomQr';

it('round trips an invite without encoding account or session data', () => {
  expect(roomQrData('ABCDEFGH')).toBe('LIFEMATE:ROOM:1:ABCDEFGH');
  expect(roomCodeFromQr(roomQrData('ABCDEFGH'))).toBe('ABCDEFGH');
  expect(roomCodeFromQr('  LIFEMATE:ROOM:1:23456789  ')).toBe('23456789');
});

it.each([
  null,
  {},
  '',
  'ABCDEFGH',
  'https://example.com/ABCDEFGH',
  'LIFEMATE:ROOM:2:ABCDEFGH',
  'LIFEMATE:ROOM:1:ABCDEF01',
  'LIFEMATE:ROOM:1:ABCDEFGH?token=secret',
  'LIFEMATE:ROOM:1:ABCDEFGHX',
  'LIFEMATE:ROOM:1:АBCDEFGH',
  'x'.repeat(1000),
])('rejects an unsupported or malformed invite: %p', (data) => {
  expect(roomCodeFromQr(data)).toBeNull();
});

it('refuses to generate an invite for an invalid room code', () => {
  expect(() => roomQrData('ABCDEF01')).toThrow();
});
