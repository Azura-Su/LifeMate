// The same offline edit must produce the same copy if a cloud write times out
// after committing. Keep IDs within the Firestore document ID limit used here.
export function offlineConflictId(
  id: string,
  updatedAt: number,
  content: string,
) {
  let hash = 2166136261;
  for (const character of `${id}\u0000${content}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const revision = Math.max(0, Math.trunc(updatedAt)).toString(36);
  return `offline-${id.slice(0, 70)}-${revision}-${(hash >>> 0).toString(36)}`;
}

export function offlineConflictTitle(title: string) {
  const suffix = ' (bản ngoại tuyến)';
  return `${title.slice(0, 120 - suffix.length).trimEnd()}${suffix}`;
}
