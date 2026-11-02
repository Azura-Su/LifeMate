const ROOM_CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const PREFIX = 'LIFEMATE:ROOM:1:';

export function roomQrData(code: string): string {
  if (!ROOM_CODE.test(code)) throw new Error('Mã phòng chưa hợp lệ.');
  return `${PREFIX}${code}`;
}

/** QR is an invitation code only; membership is still checked by the server. */
export function roomCodeFromQr(data: unknown): string | null {
  if (typeof data !== 'string' || data.length > 64) return null;
  const value = data.trim();
  if (!value.startsWith(PREFIX)) return null;
  const code = value.slice(PREFIX.length);
  return ROOM_CODE.test(code) ? code : null;
}
