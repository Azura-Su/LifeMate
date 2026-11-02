/** All local namespaces that belong to an account, including pending actions. */
export function isAccountCacheKey(key: string, uid: string) {
  if (
    key === `lifemate-audio-playlists-v1-${uid}` ||
    key === `lifemate-audio-playlist-${uid}`
  )
    return true;
  const parts = key.split(':');
  if (parts[0] !== 'lifemate') return false;
  if (['loan-repayment-attempt', 'loan-advance-attempt'].includes(parts[1]))
    return parts.length === 5 && parts[3] === encodeURIComponent(uid);
  return parts.at(-1) === encodeURIComponent(uid);
}
