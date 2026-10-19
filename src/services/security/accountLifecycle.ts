// Close the gate before draining active writes. Queued operations check it
// when they start, so a late operation cannot restore a deleted cache.
const blocked = new Set<string>();
const pending = new Map<string, Set<Promise<unknown>>>();
export function assertAccountWritable(uid: string) {
  if (blocked.has(uid)) throw new Error('Tài khoản đang được xóa.');
}
export function isAccountDeleting(uid: string) {
  return blocked.has(uid);
}
export function blockAccountWrites(uid: string) {
  blocked.add(uid);
}
export function accountTask<T>(uid: string, run: () => Promise<T>): Promise<T> {
  try {
    assertAccountWritable(uid);
  } catch (error) {
    return Promise.reject(error);
  }
  const task = Promise.resolve().then(() => {
    assertAccountWritable(uid);
    return run();
  });
  const tasks = pending.get(uid) ?? new Set();
  tasks.add(task);
  pending.set(uid, tasks);
  void task
    .finally(() => {
      tasks.delete(task);
      if (!tasks.size) pending.delete(uid);
    })
    .catch(() => undefined);
  return task;
}
export async function drainAccountWrites(uid: string) {
  while (pending.get(uid)?.size)
    await Promise.allSettled([...pending.get(uid)!]);
}
