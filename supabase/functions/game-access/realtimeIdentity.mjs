export async function ensureRealtimeRole(identity, google) {
  const user = await google.lookup({ localId: [identity.uid] });
  if (
    !user ||
    user.localId !== identity.uid ||
    user.disabled ||
    Number(user.validSince ?? 0) > identity.authTime
  )
    throw Error('invalid-session');
  const claims = JSON.parse(user.customAttributes || '{}');
  if (
    !claims ||
    typeof claims !== 'object' ||
    Array.isArray(claims) ||
    (claims.role !== undefined && claims.role !== 'authenticated')
  )
    throw Error('game-unavailable');
  if (claims.role === 'authenticated') return false;
  const next = { ...claims, role: 'authenticated' };
  if (new TextEncoder().encode(JSON.stringify(next)).length > 1000)
    throw Error('game-unavailable');
  await google.setCustomClaims(identity.uid, next);
  return true;
}
