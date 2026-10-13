import {
  collection,
  doc,
  getDocsFromServer,
  getFirestore,
  runTransaction,
  setDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
import type { FinanceTransaction } from '../../types/finance';
import { isLoanLedgerTransaction } from '../../types/finance';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';
import { parseFinanceTransaction } from '../../utils/finance';

const queues = new Map<string, Promise<unknown>>();
const cloudFallbackTransactions = new Map<string, FinanceTransaction[]>();
// Result of the last cloud round-trip per account. Writes reuse it instead of
// re-downloading the whole ledger first; when the cloud was unreachable they
// save locally right away rather than waiting for a timeout.
const cloudReachable = new Map<string, boolean>();
const MIGRATION_COMPLETE = 'complete';
const MAX_BATCH_WRITES = 400;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
// Firestore can keep offline reads and writes pending instead of rejecting
// them. A time limit lets the account fall back to its local cache.
const CLOUD_TIMEOUT_MS = 15000;

export type FinanceStorageResult = {
  transactions: FinanceTransaction[];
  synced: boolean;
  cacheNeedsRecovery?: boolean;
  conflicts?: FinanceConflict[];
};

export type FinanceConflict = {
  id: string;
  local: FinanceTransaction;
  remote: FinanceTransaction | null;
};

export function financeStorageKey(uid: string) {
  return `lifemate:finance:v1:${encodeURIComponent(uid)}`;
}

export function financeMigrationKey(uid: string) {
  return `lifemate:finance:cloud-migration:v1:${encodeURIComponent(uid)}`;
}

// IDs added or edited on this device that the cloud has not confirmed yet.
export function financePendingKey(uid: string) {
  return `lifemate:finance:pending:v1:${encodeURIComponent(uid)}`;
}

export function financePendingBaseKey(uid: string) {
  return `lifemate:finance:pending-base:v1:${encodeURIComponent(uid)}`;
}

function sameTransaction(a: FinanceTransaction, b: FinanceTransaction) {
  return (
    a.id === b.id &&
    a.ownerId === b.ownerId &&
    a.type === b.type &&
    a.incomeSource === b.incomeSource &&
    a.expenseSource === b.expenseSource &&
    a.loanId === b.loanId &&
    a.advanceId === b.advanceId &&
    a.repaymentId === b.repaymentId &&
    a.repaymentReceivedAt === b.repaymentReceivedAt &&
    a.amount === b.amount &&
    a.category === b.category &&
    a.note === b.note &&
    a.createdAt === b.createdAt
  );
}

async function readPendingBases(uid: string) {
  const bases = new Map<string, FinanceTransaction>();
  try {
    const saved: unknown = JSON.parse(
      (await getEncryptedItem(uid, financePendingBaseKey(uid))) ?? '{}',
    );
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [id, value] of Object.entries(saved)) {
        const parsed = parseFinanceTransaction(value, uid);
        if (parsed?.id === id) bases.set(id, parsed);
      }
    }
  } catch {
    // Older caches have no base snapshots. Treat differing remote rows as conflicts.
  }
  return bases;
}

async function writePendingState(
  uid: string,
  pending: Map<string, PendingChange>,
  bases: Map<string, FinanceTransaction>,
) {
  await setEncryptedItem(
    uid,
    financePendingKey(uid),
    JSON.stringify(Object.fromEntries(pending)),
  );
  await setEncryptedItem(
    uid,
    financePendingBaseKey(uid),
    JSON.stringify(Object.fromEntries(bases)),
  );
}

// 'add' = created here; 'edit' = changed here. An unconfirmed edit is dropped
// if the row was deleted elsewhere meanwhile, instead of re-creating it.
type PendingChange = 'add' | 'edit';

async function readPendingChanges(
  uid: string,
): Promise<Map<string, PendingChange>> {
  try {
    const saved: unknown = JSON.parse(
      (await getEncryptedItem(uid, financePendingKey(uid))) ?? '{}',
    );
    if (!saved || typeof saved !== 'object' || Array.isArray(saved))
      return new Map();
    return new Map(
      Object.entries(saved).filter(
        (entry): entry is [string, PendingChange] =>
          entry[1] === 'add' || entry[1] === 'edit',
      ),
    );
  } catch {
    return new Map();
  }
}

async function markPending(
  uid: string,
  id: string,
  change: PendingChange,
  base?: FinanceTransaction,
) {
  const pending = await readPendingChanges(uid);
  const bases = await readPendingBases(uid);
  // An edit of a row that was never uploaded is still an addition.
  if (pending.get(id) !== 'add') {
    pending.set(id, change);
    if (change === 'edit' && base && !bases.has(id)) bases.set(id, base);
  }
  await writePendingState(uid, pending, bases);
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Chưa kết nối được kho đám mây. Hãy thử lại.')),
      CLOUD_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function requireUid(uid: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid))
    throw new Error('Không tìm thấy tài khoản đang đăng nhập.');
}

function sortTransactions(transactions: FinanceTransaction[]) {
  return [...transactions].sort((a, b) => b.createdAt - a.createdAt);
}

function enqueue<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  const previous = queues.get(uid) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  queues.set(uid, next);
  void next
    .finally(() => {
      if (queues.get(uid) === next) queues.delete(uid);
    })
    .catch(() => undefined);
  return next;
}

export async function readFinanceTransactions(
  uid: string,
): Promise<FinanceTransaction[]> {
  requireUid(uid);
  let saved: string | null;
  try {
    saved = await getEncryptedItem(uid, financeStorageKey(uid));
  } catch (error) {
    const fallback = cloudFallbackTransactions.get(uid);
    if (fallback) return sortTransactions(fallback);
    throw error;
  }
  if (saved === null) {
    const fallback = cloudFallbackTransactions.get(uid);
    return fallback ? sortTransactions(fallback) : [];
  }

  let values: unknown;
  try {
    values = JSON.parse(saved);
  } catch {
    const fallback = cloudFallbackTransactions.get(uid);
    if (fallback) return sortTransactions(fallback);
    throw new Error('Chưa đọc được sổ thu chi trên thiết bị.');
  }
  if (!Array.isArray(values)) {
    const fallback = cloudFallbackTransactions.get(uid);
    if (fallback) return sortTransactions(fallback);
    throw new Error('Dữ liệu sổ thu chi trên thiết bị không hợp lệ.');
  }
  return sortTransactions(
    values
      .map((value) => parseFinanceTransaction(value, uid))
      .filter((value): value is FinanceTransaction => value !== null),
  );
}

async function writeFinanceCache(
  uid: string,
  transactions: FinanceTransaction[],
): Promise<boolean> {
  const sorted = sortTransactions(transactions);
  try {
    await setEncryptedItem(uid, financeStorageKey(uid), JSON.stringify(sorted));
    cloudFallbackTransactions.delete(uid);
    return true;
  } catch (error) {
    if (!cloudFallbackTransactions.has(uid)) throw error;
    cloudFallbackTransactions.set(uid, sorted);
    return false;
  }
}

async function readRemoteFinanceTransactions(uid: string) {
  const snapshot = await withTimeout(
    getDocsFromServer(
      collection(getFirestore(), 'financeAccounts', uid, 'transactions'),
    ),
  );
  return sortTransactions(
    snapshot.docs
      .map((document) => parseFinanceTransaction(document.data(), uid))
      .filter((value): value is FinanceTransaction => value !== null),
  );
}

async function uploadTransactions(
  uid: string,
  transactions: FinanceTransaction[],
) {
  for (
    let offset = 0;
    offset < transactions.length;
    offset += MAX_BATCH_WRITES
  ) {
    const batch = writeBatch(getFirestore());
    transactions
      .slice(offset, offset + MAX_BATCH_WRITES)
      .forEach((transaction) => {
        batch.set(
          doc(
            getFirestore(),
            'financeAccounts',
            uid,
            'transactions',
            transaction.id,
          ),
          transaction,
        );
      });
    await withTimeout(batch.commit());
  }
}

async function uploadEditedTransaction(
  uid: string,
  local: FinanceTransaction,
  base: FinanceTransaction | undefined,
): Promise<FinanceTransaction | null | 'uploaded'> {
  return withTimeout(
    runTransaction(getFirestore(), async (transaction) => {
      const ref = doc(
        getFirestore(),
        'financeAccounts',
        uid,
        'transactions',
        local.id,
      );
      const snapshot = await transaction.get(ref);
      const remote = snapshot.exists()
        ? parseFinanceTransaction(snapshot.data(), uid)
        : null;
      if (!remote || !base || !sameTransaction(remote, base)) return remote;
      transaction.set(ref, local);
      return 'uploaded' as const;
    }),
  );
}

async function readFinanceDataInternal(
  uid: string,
): Promise<FinanceStorageResult> {
  const cacheNeedsRecovery = cloudFallbackTransactions.has(uid);
  let localTransactions: FinanceTransaction[] | null = null;
  try {
    localTransactions = await readFinanceTransactions(uid);
  } catch {
    // A missing or temporarily inaccessible SecureStore key must not prevent
    // the app from reading the authoritative cloud ledger. Keep the encrypted
    // local value untouched because it may still be recoverable later.
  }
  try {
    const remoteTransactions = await readRemoteFinanceTransactions(uid);
    if (localTransactions === null) {
      cloudFallbackTransactions.set(uid, remoteTransactions);
      cloudReachable.set(uid, true);
      return {
        transactions: remoteTransactions,
        synced: false,
        cacheNeedsRecovery: true,
      };
    }
    if (cacheNeedsRecovery) {
      cloudFallbackTransactions.set(uid, remoteTransactions);
      cloudReachable.set(uid, true);
      return {
        transactions: remoteTransactions,
        synced: false,
        cacheNeedsRecovery: true,
      };
    }
    const migrated =
      (await getEncryptedItem(uid, financeMigrationKey(uid))) ===
      MIGRATION_COMPLETE;
    const pending = await readPendingChanges(uid);
    const bases = await readPendingBases(uid);
    const remoteById = new Map(
      remoteTransactions.map((item) => [item.id, item]),
    );
    const remoteIds = new Set(remoteById.keys());
    const conflicts: FinanceConflict[] = [];
    const localIds = new Set(localTransactions.map(({ id }) => id));
    for (const id of pending.keys()) {
      if (!localIds.has(id)) {
        pending.delete(id);
        bases.delete(id);
      }
    }
    // Upload only what this device added or edited (plus, once, data saved
    // before cloud sync existed). Missing edited rows need an explicit choice
    // before they can be restored to the server.
    const candidates = localTransactions.filter((transaction) => {
      const { id } = transaction;
      // Linked loan rows are committed by Firestore transactions only. A
      // local copy missing from the server was removed deliberately, so a
      // first-time finance migration must never recreate it.
      if (isLoanLedgerTransaction(transaction)) return false;
      const change = pending.get(id);
      if (change === 'add') return true;
      // Before the first successful migration, an edited local-only row may
      // be an old transaction that predates cloud sync. Import it once; after
      // migration, an edit of a remotely deleted row must not resurrect it.
      if (change === 'edit') return true;
      return !migrated && !remoteIds.has(id);
    });
    const toUpload: FinanceTransaction[] = [];
    const batchUpload: FinanceTransaction[] = [];
    for (const local of candidates) {
      const change = pending.get(local.id);
      const remote = remoteById.get(local.id) ?? null;
      if (change === 'add' && remote) {
        if (!sameTransaction(local, remote))
          conflicts.push({ id: local.id, local, remote });
        else {
          pending.delete(local.id);
          bases.delete(local.id);
        }
        continue;
      }
      if (change === 'edit') {
        if (remote && sameTransaction(local, remote)) {
          pending.delete(local.id);
          bases.delete(local.id);
          continue;
        }
        const base = bases.get(local.id);
        if (!remote || !base || !sameTransaction(remote, base)) {
          conflicts.push({ id: local.id, local, remote });
          continue;
        }
        const uploadResult = await uploadEditedTransaction(uid, local, base);
        if (uploadResult !== 'uploaded') {
          conflicts.push({ id: local.id, local, remote: uploadResult });
          continue;
        }
      } else {
        batchUpload.push(local);
      }
      pending.delete(local.id);
      bases.delete(local.id);
      toUpload.push(local);
    }
    await uploadTransactions(uid, batchUpload);
    const uploadedIds = new Set(toUpload.map(({ id }) => id));
    const conflictIds = new Set(conflicts.map(({ id }) => id));
    const transactions = sortTransactions([
      ...remoteTransactions.filter(
        ({ id }) => !uploadedIds.has(id) && !conflictIds.has(id),
      ),
      ...toUpload,
      ...conflicts.map(({ local }) => local),
    ]);
    if (!migrated)
      await setEncryptedItem(uid, financeMigrationKey(uid), MIGRATION_COMPLETE);
    await writePendingState(uid, pending, bases);

    const cacheSaved = await writeFinanceCache(uid, transactions);
    cloudReachable.set(uid, true);
    return cacheSaved
      ? {
          transactions,
          synced: pending.size === 0 && conflicts.length === 0,
          conflicts,
        }
      : { transactions, synced: false, cacheNeedsRecovery: true };
  } catch (error) {
    cloudReachable.set(uid, false);
    if (localTransactions === null) throw error;
    return cacheNeedsRecovery
      ? {
          transactions: localTransactions,
          synced: false,
          cacheNeedsRecovery: true,
        }
      : { transactions: localTransactions, synced: false };
  }
}

// Forget the cached reachability, e.g. on sign-out or between tests.
export function resetFinanceCloudState(uid?: string) {
  if (uid) {
    cloudReachable.delete(uid);
    cloudFallbackTransactions.delete(uid);
  } else {
    cloudReachable.clear();
    cloudFallbackTransactions.clear();
  }
}

export function readFinanceData(uid: string): Promise<FinanceStorageResult> {
  requireUid(uid);
  return enqueue(uid, () => readFinanceDataInternal(uid));
}

function upsertTransaction(
  transactions: FinanceTransaction[],
  transaction: FinanceTransaction,
) {
  return sortTransactions([
    transaction,
    ...transactions.filter(({ id }) => id !== transaction.id),
  ]);
}

// Writes one change to the cloud, or records it as pending. Returns whether
// the account is fully in sync afterwards.
async function pushChange(
  uid: string,
  transaction: FinanceTransaction,
  change: PendingChange,
  original?: FinanceTransaction,
) {
  if (cloudReachable.get(uid) !== false) {
    try {
      const ref = doc(
        getFirestore(),
        'financeAccounts',
        uid,
        'transactions',
        transaction.id,
      );
      if (change === 'add') {
        await withTimeout(setDoc(ref, transaction));
      } else {
        const bases = await readPendingBases(uid);
        const result = await uploadEditedTransaction(
          uid,
          transaction,
          bases.get(transaction.id) ?? original,
        );
        if (result !== 'uploaded') throw new FinanceDataConflictError();
      }
      const pending = await readPendingChanges(uid);
      const bases = await readPendingBases(uid);
      pending.delete(transaction.id);
      bases.delete(transaction.id);
      await writePendingState(uid, pending, bases);
      return pending.size === 0;
    } catch (error) {
      if (error instanceof FinanceDataConflictError) throw error;
      // A transient write failure must not disable cloud attempts for all
      // later transactions until the account is reloaded. Keep this change
      // pending, then let the next write retry the cloud independently.
    }
  }
  await markPending(uid, transaction.id, change, original);
  return false;
}

class FinanceDataConflictError extends Error {
  constructor() {
    super('Giao dịch đã thay đổi trên tài khoản. Tải lại để chọn bản cần giữ.');
  }
}

export function addFinanceTransaction(
  uid: string,
  transaction: FinanceTransaction,
): Promise<FinanceStorageResult> {
  return saveAddedTransaction(uid, transaction, false);
}

export function cacheCommittedFinanceTransaction(
  uid: string,
  transaction: FinanceTransaction,
): Promise<FinanceStorageResult> {
  return saveAddedTransaction(uid, transaction, true);
}

function saveAddedTransaction(
  uid: string,
  transaction: FinanceTransaction,
  alreadyCommitted: boolean,
): Promise<FinanceStorageResult> {
  requireUid(uid);
  if (transaction.ownerId !== uid)
    return Promise.reject(
      new Error('Giao dịch không thuộc tài khoản đang đăng nhập.'),
    );
  if (!Number.isSafeInteger(transaction.amount) || transaction.amount <= 0)
    return Promise.reject(new Error('Số tiền phải là số nguyên lớn hơn 0.'));
  if (
    !ID_PATTERN.test(transaction.id) ||
    !parseFinanceTransaction(transaction, uid)
  )
    return Promise.reject(new Error('Thông tin giao dịch không hợp lệ.'));
  if (!alreadyCommitted && isLoanLedgerTransaction(transaction))
    return Promise.reject(
      new Error(
        'Giao dịch cho mượn chỉ được tạo cùng hồ sơ trong sổ cho mượn.',
      ),
    );

  return enqueue(uid, async () => {
    const current = await readFinanceTransactions(uid);
    let synced: boolean;
    if (alreadyCommitted) {
      const pending = await readPendingChanges(uid);
      const bases = await readPendingBases(uid);
      pending.delete(transaction.id);
      bases.delete(transaction.id);
      await writePendingState(uid, pending, bases);
      cloudReachable.set(uid, true);
      synced = pending.size === 0;
    } else {
      synced = await pushChange(uid, transaction, 'add');
    }
    const transactions = upsertTransaction(current, transaction);
    const cacheSaved = await writeFinanceCache(uid, transactions);
    return cacheSaved
      ? { transactions, synced }
      : { transactions, synced: false, cacheNeedsRecovery: true };
  });
}

export function deleteFinanceTransaction(
  uid: string,
  id: string,
): Promise<FinanceStorageResult> {
  requireUid(uid);
  if (!ID_PATTERN.test(id))
    return Promise.reject(new Error('Mã giao dịch không hợp lệ.'));

  return enqueue(uid, async () => {
    const current = await readFinanceTransactions(uid);
    const pendingBeforeDelete = await readPendingChanges(uid);
    if (pendingBeforeDelete.has(id)) throw new FinanceDataConflictError();
    const target = current.find((transaction) => transaction.id === id);
    if (
      target &&
      isLoanLedgerTransaction(target) &&
      target.expenseSource !== 'loan_lending'
    )
      throw new Error('Giao dịch cho mượn chỉ sửa được trong sổ cho mượn.');
    // Deleting stays online-only and checks the latest server version.
    await withTimeout(
      runTransaction(getFirestore(), async (transaction) => {
        const ref = doc(
          getFirestore(),
          'financeAccounts',
          uid,
          'transactions',
          id,
        );
        const snapshot = await transaction.get(ref);
        const remote = snapshot.exists()
          ? parseFinanceTransaction(snapshot.data(), uid)
          : null;
        if (remote && target && !sameTransaction(remote, target))
          throw new FinanceDataConflictError();
        if (snapshot.exists()) transaction.delete(ref);
      }),
    );
    cloudReachable.set(uid, true);
    const pending = await readPendingChanges(uid);
    const bases = await readPendingBases(uid);
    pending.delete(id);
    bases.delete(id);
    await writePendingState(uid, pending, bases);
    const transactions = current.filter((transaction) => transaction.id !== id);
    const cacheSaved = await writeFinanceCache(uid, transactions);
    return cacheSaved
      ? { transactions, synced: pending.size === 0 }
      : { transactions, synced: false, cacheNeedsRecovery: true };
  });
}

export function resolveFinanceConflict(
  uid: string,
  conflict: FinanceConflict,
  choice: 'local' | 'server',
): Promise<FinanceStorageResult> {
  requireUid(uid);
  return enqueue(uid, async () => {
    const pending = await readPendingChanges(uid);
    if (!pending.has(conflict.id))
      throw new Error('Xung đột đã được xử lý. Hãy tải lại danh sách.');
    const current = await readFinanceTransactions(uid);
    const local = current.find(({ id }) => id === conflict.id);
    if (!local || !sameTransaction(local, conflict.local))
      throw new Error('Giao dịch trên thiết bị đã thay đổi. Hãy tải lại.');
    if (choice === 'local') {
      await withTimeout(
        runTransaction(getFirestore(), async (transaction) => {
          const ref = doc(
            getFirestore(),
            'financeAccounts',
            uid,
            'transactions',
            conflict.id,
          );
          const snapshot = await transaction.get(ref);
          const latest = snapshot.exists()
            ? parseFinanceTransaction(snapshot.data(), uid)
            : null;
          if (
            (latest === null) !== (conflict.remote === null) ||
            (latest &&
              conflict.remote &&
              !sameTransaction(latest, conflict.remote))
          )
            throw new FinanceDataConflictError();
          transaction.set(ref, local);
        }),
      );
    } else {
      await writeFinanceCache(
        uid,
        current.filter(({ id }) => id !== conflict.id),
      );
    }
    const bases = await readPendingBases(uid);
    pending.delete(conflict.id);
    bases.delete(conflict.id);
    await writePendingState(uid, pending, bases);
    cloudReachable.set(uid, true);
    return readFinanceDataInternal(uid);
  });
}

export function updateFinanceTransaction(
  uid: string,
  transaction: FinanceTransaction,
): Promise<FinanceStorageResult> {
  requireUid(uid);
  if (transaction.ownerId !== uid)
    return Promise.reject(
      new Error('Giao dịch không thuộc tài khoản đang đăng nhập.'),
    );
  if (
    !ID_PATTERN.test(transaction.id) ||
    !Number.isSafeInteger(transaction.amount) ||
    transaction.amount <= 0 ||
    !parseFinanceTransaction(transaction, uid)
  )
    return Promise.reject(new Error('Thông tin giao dịch không hợp lệ.'));

  return enqueue(uid, async () => {
    const current = await readFinanceTransactions(uid);
    const original = current.find(({ id }) => id === transaction.id);
    if (!original) throw new Error('Không tìm thấy giao dịch cần sửa.');
    if (isLoanLedgerTransaction(original))
      throw new Error('Giao dịch cho mượn chỉ sửa được trong sổ cho mượn.');
    const synced = await pushChange(uid, transaction, 'edit', original);
    const transactions = upsertTransaction(current, transaction);
    const cacheSaved = await writeFinanceCache(uid, transactions);
    return cacheSaved
      ? { transactions, synced }
      : { transactions, synced: false, cacheNeedsRecovery: true };
  });
}
