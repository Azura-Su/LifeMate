export function gameCapacity(kind) {
  return kind === 'sam' ? 5 : kind === 'tan' ? 6 : 4;
}

export function requiresLargeTableClient(state) {
  return state?.members?.length > 4 || state?.game?.players?.length > 4;
}
