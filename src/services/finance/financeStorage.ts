import {
  collection,
  deleteDoc,
  doc,
  getDocsFromServer,
  getFirestore,
  setDoc,
  updateDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
import type { FinanceTransaction } from '../../types/finance';
import {
  getEncryptedItem,
  removeEncryptedItem,
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

async function markPending(uid: string, id: string, change: PendingChange) {
  const pending = await readPendingChanges(uid);
  // An edit of a row that was never uploaded is still an addition.
  if (pending.get(id) !== 'add') pending.set(id, change);
  await setEncryptedItem(
    uid,
    financePendingKey(uid),
    JSON.stringify(Object.fromEntries(pending)),
  );
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
    const remoteIds = new Set(remoteTransactions.map(({ id }) => id));
    // Upload only what this device added or edited (plus, once, data saved
    // before cloud sync existed). Rows missing from the server were deleted
    // elsewhere and must not be re-created, even if edited here meanwhile.
    const toUpload = localTransactions.filter(({ id }) => {
      const change = pending.get(id);
      if (change === 'add') return true;
      // Before the first successful migration, an edited local-only row may
      // be an old transaction that predates cloud sync. Import it once; after
      // migration, an edit of a remotely deleted row must not resurrect it.
      if (change === 'edit') return remoteIds.has(id) || !migrated;
      return !migrated && !remoteIds.has(id);
    });
    await uploadTransactions(uid, toUpload);
    const uploadedIds = new Set(toUpload.map(({ id }) => id));
    const transactions = sortTransactions([
      ...remoteTransactions.filter(({ id }) => !uploadedIds.has(id)),
      ...toUpload,
    ]);
    if (!migrated)
      await setEncryptedItem(uid, financeMigrationKey(uid), MIGRATION_COMPLETE);
    if (pending.size) await removeEncryptedItem(financePendingKey(uid));

    const cacheSaved = await writeFinanceCache(uid, transactions);
    cloudReachable.set(uid, true);
    return cacheSaved
      ? { transactions, synced: true }
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
      await withTimeout(
        change === 'add'
          ? setDoc(ref, transaction)
          : updateDoc(ref, transaction),
      );
      return (await readPendingChanges(uid)).size === 0;
    } catch {
      // A transient write failure must not disable cloud attempts for all
      // later transactions until the account is reloaded. Keep this change
      // pending, then let the next write retry the cloud independently.
    }
  }
  await markPending(uid, transaction.id, change);
  return false;
}

export function addFinanceTransaction(
  uid: string,
  transaction: FinanceTransaction,
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

  return enqueue(uid, async () => {
    const current = await readFinanceTransactions(uid);
    const synced = await pushChange(uid, transaction, 'add');
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
    // Deleting stays online-only so the row never disappears locally while
    // the cloud copy remains.
    try {
      await withTimeout(
        deleteDoc(
          doc(getFirestore(), 'financeAccounts', uid, 'transactions', id),
        ),
      );
    } catch (error) {
      // A failed delete may be transient too; do not make later writes
      // local-only until another full account load.
      throw error;
    }
    cloudReachable.set(uid, true);
    const pending = await readPendingChanges(uid);
    if (pending.delete(id))
      await setEncryptedItem(
        uid,
        financePendingKey(uid),
        JSON.stringify(Object.fromEntries(pending)),
      );
    const transactions = current.filter((transaction) => transaction.id !== id);
    const cacheSaved = await writeFinanceCache(uid, transactions);
    return cacheSaved
      ? { transactions, synced: pending.size === 0 }
      : { transactions, synced: false, cacheNeedsRecovery: true };
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
    if (!current.some(({ id }) => id === transaction.id))
      throw new Error('Không tìm thấy giao dịch cần sửa.');
    const synced = await pushChange(uid, transaction, 'edit');
    const transactions = upsertTransaction(current, transaction);
    const cacheSaved = await writeFinanceCache(uid, transactions);
    return cacheSaved
      ? { transactions, synced }
      : { transactions, synced: false, cacheNeedsRecovery: true };
  });
}
