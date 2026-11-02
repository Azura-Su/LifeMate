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
  hasEncryptedItemRecovery,
  recoverEncryptedItems,
} from '../security/encryptedLocalStorage';
import { useAuthStore } from '../../store/authStore';
import { parseFinanceTransaction } from '../../utils/finance';
import { parseSharedExpense } from '../../utils/sharedExpense';

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
    JSON.stringify(a.sharedExpense) === JSON.stringify(b.sharedExpense) &&
    a.amount === b.amount &&
    a.category === b.category &&
    a.note === b.note &&
    a.createdAt === b.createdAt
  );
}

// Independent offline receipts can be combined. Edits to the bill, people, or
// existing receipts still require an explicit conflict choice.
function mergeAppendedSharedReceipts(
  base: FinanceTransaction,
  local: FinanceTransaction,
  remote: FinanceTransaction,
): FinanceTransaction | null {
  if (!base.sharedExpense || !local.sharedExpense || !remote.sharedExpense)
    return null;
  const withoutReceipts = (value: FinanceTransaction) =>
    JSON.stringify({
      ...value,
      sharedExpense: { ...value.sharedExpense, receipts: [] },
    });
  if (
    withoutReceipts(base) !== withoutReceipts(local) ||
    withoutReceipts(base) !== withoutReceipts(remote)
  )
    return null;
  const previous = base.sharedExpense.receipts;
  const localReceipts = local.sharedExpense.receipts;
  const remoteReceipts = remote.sharedExpense.receipts;
  if (
    JSON.stringify(localReceipts.slice(0, previous.length)) !==
      JSON.stringify(previous) ||
    JSON.stringify(remoteReceipts.slice(0, previous.length)) !==
      JSON.stringify(previous)
  )
    return null;
  const mergedReceipts = [...remoteReceipts];
  for (const receipt of localReceipts.slice(previous.length)) {
    const existing = mergedReceipts.find(({ id }) => id === receipt.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(receipt))
      return null;
    if (!existing) mergedReceipts.push(receipt);
  }
  const sharedExpense = parseSharedExpense(
    { ...remote.sharedExpense, receipts: mergedReceipts },
    remote.amount,
  );
  return sharedExpense ? { ...remote, sharedExpense } : null;
}

async function readPendingBases(uid: string) {
  const bases = new Map<string, FinanceTransaction>();
  const saved: unknown = JSON.parse(
    (await getEncryptedItem(uid, financePendingBaseKey(uid), {
      migrateLegacy: false,
    })) ?? '{}',
  );
  if (!saved || typeof saved !== 'object' || Array.isArray(saved))
    throw new Error('Dữ liệu sổ thu chi trên thiết bị không hợp lệ.');
  for (const [id, value] of Object.entries(saved)) {
    const parsed = parseFinanceTransaction(value, uid);
    if (!parsed || parsed.id !== id)
      throw new Error('Dữ liệu sổ thu chi trên thiết bị không hợp lệ.');
    bases.set(id, parsed);
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

// 'add' = created here; 'edit' = changed here. A deleted remote row with an
// unconfirmed local edit is shown as a conflict before either copy is kept.
type PendingChange = 'add' | 'edit';

async function readPendingChanges(
  uid: string,
): Promise<Map<string, PendingChange>> {
  const saved: unknown = JSON.parse(
    (await getEncryptedItem(uid, financePendingKey(uid), {
      migrateLegacy: false,
    })) ?? '{}',
  );
  if (!saved || typeof saved !== 'object' || Array.isArray(saved))
    throw new Error('Dữ liệu sổ thu chi trên thiết bị không hợp lệ.');
  const entries = Object.entries(saved);
  if (
    entries.some(
      ([id, value]) =>
        !ID_PATTERN.test(id) || (value !== 'add' && value !== 'edit'),
    )
  )
    throw new Error('Dữ liệu sổ thu chi trên thiết bị không hợp lệ.');
  return new Map(entries as [string, PendingChange][]);
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

function enqueue<T>(
  uid: string,
  operation: () => Promise<T>,
  allowRecovery = false,
): Promise<T> {
  const previous = queues.get(uid) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      if (!allowRecovery && (await hasEncryptedItemRecovery(uid, 'finance')))
        throw new Error(
          'Cần tiếp tục khôi phục cache trước khi sửa sổ thu chi.',
        );
      if (!allowRecovery) {
        try {
          await readFinanceCacheSnapshot(uid);
        } catch {
          throw new Error('Cần khôi phục cache trước khi sửa sổ thu chi.');
        }
      }
      return operation();
    });
  queues.set(uid, next);
  void next
    .finally(() => {
      if (queues.get(uid) === next) queues.delete(uid);
    })
    .catch(() => undefined);
  return next;
}

async function readLocalFinanceTransactions(
  uid: string,
  migrateLegacy = false,
) {
  const saved = await getEncryptedItem(uid, financeStorageKey(uid), {
    migrateLegacy,
  });
  if (saved === null) return [];
  let values: unknown;
  try {
    values = JSON.parse(saved);
  } catch {
    throw new Error('Chưa đọc được sổ thu chi trên thiết bị.');
  }
  if (!Array.isArray(values))
    throw new Error('Dữ liệu sổ thu chi trên thiết bị không hợp lệ.');
  return sortTransactions(
    values
      .map((value) => parseFinanceTransaction(value, uid))
      .filter((value): value is FinanceTransaction => value !== null),
  );
}

async function readFinanceCacheSnapshot(uid: string) {
  const transactions = await readLocalFinanceTransactions(uid);
  const migration = await getEncryptedItem(uid, financeMigrationKey(uid), {
    migrateLegacy: false,
  });
  if (migration !== null && migration !== MIGRATION_COMPLETE)
    throw new Error('Dữ liệu sổ thu chi trên thiết bị không hợp lệ.');
  const pending = await readPendingChanges(uid);
  const bases = await readPendingBases(uid);
  return {
    transactions,
    migrated: migration === MIGRATION_COMPLETE,
    pending,
    bases,
  };
}

export async function readFinanceTransactions(
  uid: string,
): Promise<FinanceTransaction[]> {
  requireUid(uid);
  if (await hasEncryptedItemRecovery(uid, 'finance'))
    throw new Error(
      'Cần tiếp tục khôi phục cache trước khi đọc bản trên thiết bị.',
    );
  try {
    return await readLocalFinanceTransactions(uid, true);
  } catch (error) {
    const fallback = cloudFallbackTransactions.get(uid);
    if (fallback) return sortTransactions(fallback);
    throw error;
  }
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

async function readRemoteFinanceTransactions(uid: string, strict = false) {
  const snapshot = await withTimeout(
    getDocsFromServer(
      collection(getFirestore(), 'financeAccounts', uid, 'transactions'),
    ),
  );
  return sortTransactions(
    snapshot.docs
      .map((document) => {
        const parsed = parseFinanceTransaction(document.data(), uid);
        if (strict && (!parsed || parsed.id !== document.id))
          throw new Error(
            'Dữ liệu thu chi trên cloud chưa hợp lệ. Chưa thay đổi cache.',
          );
        return parsed;
      })
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
  if (await hasEncryptedItemRecovery(uid, 'finance')) {
    let transactions: FinanceTransaction[];
    try {
      transactions = await readRemoteFinanceTransactions(uid);
      cloudReachable.set(uid, true);
      cloudFallbackTransactions.set(uid, transactions);
    } catch (error) {
      cloudReachable.set(uid, false);
      const previous = cloudFallbackTransactions.get(uid);
      if (!previous) throw error;
      transactions = previous;
    }
    return { transactions, synced: false, cacheNeedsRecovery: true };
  }
  const hadCloudFallback = cloudFallbackTransactions.has(uid);
  let snapshot: Awaited<ReturnType<typeof readFinanceCacheSnapshot>> | null =
    null;
  try {
    snapshot = await readFinanceCacheSnapshot(uid);
  } catch {
    /* Preserve the whole namespace when any encrypted member is unreadable. */
  }
  const recoveredCache = hadCloudFallback && snapshot !== null;
  const localTransactions = snapshot?.transactions ?? null;
  try {
    const remoteTransactions = await readRemoteFinanceTransactions(uid);
    if (snapshot === null || localTransactions === null) {
      cloudFallbackTransactions.set(uid, remoteTransactions);
      cloudReachable.set(uid, true);
      return {
        transactions: remoteTransactions,
        synced: false,
        cacheNeedsRecovery: true,
      };
    }
    const { migrated, pending, bases } = snapshot;
    const remoteById = new Map(
      remoteTransactions.map((item) => [item.id, item]),
    );
    const remoteIds = new Set(remoteById.keys());
    const conflicts: FinanceConflict[] = [];
    if (recoveredCache && !migrated) {
      // During recovery, a cached row missing from the cloud might be either
      // an old local row or one deleted while the key was unavailable. Ask the
      // account owner before restoring it instead of silently resurrecting it.
      for (const local of localTransactions) {
        if (
          !remoteIds.has(local.id) &&
          !pending.has(local.id) &&
          !isLoanLedgerTransaction(local)
        )
          pending.set(local.id, 'edit');
      }
    }
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
      let candidate = local;
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
        if (!remote || !base) {
          conflicts.push({ id: local.id, local, remote });
          continue;
        }
        if (!sameTransaction(remote, base)) {
          const merged = mergeAppendedSharedReceipts(base, local, remote);
          if (!merged) {
            conflicts.push({ id: local.id, local, remote });
            continue;
          }
          candidate = merged;
        }
        const uploadResult = sameTransaction(candidate, remote)
          ? 'uploaded'
          : await uploadEditedTransaction(uid, candidate, remote);
        if (uploadResult !== 'uploaded') {
          conflicts.push({ id: local.id, local, remote: uploadResult });
          continue;
        }
      } else {
        batchUpload.push(candidate);
      }
      pending.delete(local.id);
      bases.delete(local.id);
      toUpload.push(candidate);
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
    if (hadCloudFallback) {
      const fallback = cloudFallbackTransactions.get(uid);
      if (fallback)
        return {
          transactions: sortTransactions(fallback),
          synced: false,
          cacheNeedsRecovery: true,
        };
    }
    if (localTransactions === null) throw error;
    return { transactions: localTransactions, synced: false };
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
  return enqueue(uid, () => readFinanceDataInternal(uid), true);
}

/** Explicitly chosen cloud recovery; originals remain in an encrypted archive. */
export function recoverFinanceCache(
  uid: string,
): Promise<FinanceStorageResult> {
  requireUid(uid);
  const epoch = useAuthStore.getState().sessionEpoch;
  const assertCurrent = () => {
    const auth = useAuthStore.getState();
    if (auth.user?.uid !== uid || auth.sessionEpoch !== epoch)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
  };
  return enqueue(
    uid,
    async () => {
      assertCurrent();
      const remote = await readRemoteFinanceTransactions(uid, true);
      assertCurrent();
      const values = {
        [financeStorageKey(uid)]: JSON.stringify(remote),
        [financePendingKey(uid)]: '{}',
        [financePendingBaseKey(uid)]: '{}',
        [financeMigrationKey(uid)]: MIGRATION_COMPLETE,
      };
      await recoverEncryptedItems(
        uid,
        'finance',
        Object.keys(values),
        values,
        assertCurrent,
      );
      assertCurrent();
      cloudFallbackTransactions.delete(uid);
      return readFinanceDataInternal(uid);
    },
    true,
  );
}

async function currentTransactionsForMutation(uid: string) {
  if (cloudFallbackTransactions.has(uid)) {
    await readFinanceDataInternal(uid);
    if (cloudFallbackTransactions.has(uid) && cloudReachable.get(uid) === false)
      throw new Error(
        'Cần kết nối mạng để khôi phục sổ thu chi trước khi sửa.',
      );
  }
  return readFinanceTransactions(uid);
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
    let committed = false;
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
      committed = true;
      cloudReachable.set(uid, true);
      const pending = await readPendingChanges(uid);
      const bases = await readPendingBases(uid);
      pending.delete(transaction.id);
      bases.delete(transaction.id);
      await writePendingState(uid, pending, bases);
      return pending.size === 0;
    } catch (error) {
      if (error instanceof FinanceDataConflictError) throw error;
      if (committed && cloudFallbackTransactions.has(uid)) {
        // The cloud write succeeded. An inaccessible device key must not
        // turn that successful edit into an error or an offline pending edit.
        return false;
      }
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
      new Error('Giao dịch cho vay chỉ được tạo cùng hồ sơ trong sổ cho vay.'),
    );

  return enqueue(uid, async () => {
    const current = await currentTransactionsForMutation(uid);
    let synced: boolean;
    if (alreadyCommitted) {
      const pending = await readPendingChanges(uid);
      const bases = await readPendingBases(uid);
      pending.delete(transaction.id);
      bases.delete(transaction.id);
      try {
        await writePendingState(uid, pending, bases);
      } catch (error) {
        if (!cloudFallbackTransactions.has(uid)) throw error;
      }
      cloudReachable.set(uid, true);
      synced = pending.size === 0 && !cloudFallbackTransactions.has(uid);
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
    const current = await currentTransactionsForMutation(uid);
    const pendingBeforeDelete = await readPendingChanges(uid);
    if (pendingBeforeDelete.has(id)) throw new FinanceDataConflictError();
    const target = current.find((transaction) => transaction.id === id);
    if (
      target &&
      isLoanLedgerTransaction(target) &&
      target.expenseSource !== 'loan_lending'
    )
      throw new Error('Giao dịch cho vay chỉ sửa được trong sổ cho vay.');
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
    try {
      await writePendingState(uid, pending, bases);
    } catch (error) {
      if (!cloudFallbackTransactions.has(uid)) throw error;
    }
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
  expected?: FinanceTransaction,
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
    const current = await currentTransactionsForMutation(uid);
    const original = current.find(({ id }) => id === transaction.id);
    if (!original) throw new Error('Không tìm thấy giao dịch cần sửa.');
    if (expected && !sameTransaction(original, expected))
      throw new Error(
        'Giao dịch đã thay đổi. Hãy tải lại trước khi lưu; nội dung đang nhập vẫn được giữ.',
      );
    if (isLoanLedgerTransaction(original))
      throw new Error('Giao dịch cho vay chỉ sửa được trong sổ cho vay.');
    const synced = await pushChange(uid, transaction, 'edit', original);
    const transactions = upsertTransaction(current, transaction);
    const cacheSaved = await writeFinanceCache(uid, transactions);
    return cacheSaved
      ? { transactions, synced }
      : { transactions, synced: false, cacheNeedsRecovery: true };
  });
}
