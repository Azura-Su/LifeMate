import {
  collection,
  doc,
  getDocsFromServer,
  getFirestore,
  query,
  runTransaction,
  where,
} from '@react-native-firebase/firestore';
import type { FinanceTransaction } from '../../types/finance';
import type { LoanAdvance, LoanRecord, LoanRepayment } from '../../types/loan';
import {
  canSetLoanTotalAmount,
  getLoanOutstandingAmount,
  getLoanPendingAmount,
  getLoanStatus,
} from '../../types/loan';
import { parseFinanceTransaction } from '../../utils/finance';
import {
  getEncryptedItem,
  removeEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';

const cacheKey = (uid: string) =>
  `lifemate:finance-loans:v1:${encodeURIComponent(uid)}`;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_DATE = 253402300799999;
const CLOUD_TIMEOUT_MS = 12000;
const queues = new Map<string, Promise<unknown>>();
const attemptKey = (uid: string, loanId: string) =>
  `lifemate:loan-repayment-attempt:v1:${encodeURIComponent(uid)}:${encodeURIComponent(loanId)}`;
const advanceAttemptKey = (uid: string, loanId: string) =>
  `lifemate:loan-advance-attempt:v1:${encodeURIComponent(uid)}:${encodeURIComponent(loanId)}`;
const newLoanAttemptKey = (uid: string) =>
  `lifemate:loan-create-attempt:v1:${encodeURIComponent(uid)}`;

export class LoanDataConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoanDataConflictError';
  }
}

export type LoanStorageResult = {
  loans: LoanRecord[];
  synced: boolean;
  committedTransactions: FinanceTransaction[];
  deletedLendingTransactionId?: string;
  correctableDeletedLoanIds?: string[];
};

type LoanWriteResult = {
  loan: LoanRecord;
  committedTransaction?: FinanceTransaction;
};

type DeletedLoanRecord = {
  id: string;
  ownerId: string;
  deleted: true;
  updatedAt: number;
  repayments: LoanRepayment[];
  advances?: LoanAdvance[];
  additionalAmount?: number;
};

function enqueue<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  const next = (queues.get(uid) ?? Promise.resolve())
    .catch(() => undefined)
    .then(operation);
  queues.set(uid, next);
  void next
    .finally(() => {
      if (queues.get(uid) === next) queues.delete(uid);
    })
    .catch(() => undefined);
  return next;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Cloud timeout')),
      CLOUD_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function parseRepayment(value: unknown, loanId: string): LoanRepayment | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<LoanRepayment>;
  if (
    typeof row.id !== 'string' ||
    !ID.test(row.id) ||
    !Number.isSafeInteger(row.amount) ||
    (row.amount ?? 0) <= 0 ||
    typeof row.receivedAt !== 'number' ||
    !Number.isFinite(row.receivedAt) ||
    row.receivedAt < 0 ||
    row.receivedAt > MAX_DATE ||
    typeof row.financeTransactionId !== 'string' ||
    !ID.test(row.financeTransactionId) ||
    row.financeTransactionId !== `loan-${loanId}-${row.id}` ||
    (row.status !== 'pending' && row.status !== 'posted')
  )
    return null;
  return {
    id: row.id,
    amount: row.amount as number,
    receivedAt: row.receivedAt,
    financeTransactionId: row.financeTransactionId,
    status: row.status,
  };
}

function parseAdvance(value: unknown, loanId: string): LoanAdvance | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<LoanAdvance>;
  if (
    typeof row.id !== 'string' ||
    !ID.test(row.id) ||
    !Number.isSafeInteger(row.amount) ||
    (row.amount ?? 0) <= 0 ||
    typeof row.lentAt !== 'number' ||
    !Number.isFinite(row.lentAt) ||
    row.lentAt < 0 ||
    row.lentAt > MAX_DATE ||
    typeof row.financeTransactionId !== 'string' ||
    !ID.test(row.financeTransactionId) ||
    row.financeTransactionId !== `loan-lent-${loanId}-${row.id}` ||
    (row.note !== undefined &&
      (typeof row.note !== 'string' ||
        !row.note.trim() ||
        row.note.trim().length > 120))
  )
    return null;
  return {
    id: row.id,
    amount: row.amount as number,
    lentAt: row.lentAt,
    ...(row.note !== undefined ? { note: row.note.trim() } : {}),
    financeTransactionId: row.financeTransactionId,
  };
}

export function parseLoanRecord(
  value: unknown,
  uid: string,
): LoanRecord | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<LoanRecord>;
  if (
    row.ownerId !== uid ||
    typeof row.id !== 'string' ||
    !ID.test(row.id) ||
    typeof row.borrowerName !== 'string' ||
    !row.borrowerName.trim() ||
    row.borrowerName.length > 100 ||
    !Number.isSafeInteger(row.principalAmount) ||
    (row.principalAmount ?? 0) <= 0 ||
    typeof row.lentAt !== 'number' ||
    !Number.isFinite(row.lentAt) ||
    row.lentAt < 0 ||
    row.lentAt > MAX_DATE ||
    (row.dueAt !== null &&
      (typeof row.dueAt !== 'number' ||
        !Number.isFinite(row.dueAt) ||
        row.dueAt < 0 ||
        row.dueAt > MAX_DATE)) ||
    typeof row.remindOnDueDate !== 'boolean' ||
    (row.remindOnDueDate && row.dueAt === null) ||
    typeof row.note !== 'string' ||
    row.note.length > 500 ||
    !Array.isArray(row.repayments) ||
    row.repayments.length > 100 ||
    (typeof row.cancelledAt !== 'number' && row.cancelledAt !== null) ||
    (typeof row.cancelledAt === 'number' &&
      (!Number.isFinite(row.cancelledAt) ||
        row.cancelledAt < 0 ||
        row.cancelledAt > MAX_DATE)) ||
    typeof row.updatedAt !== 'number' ||
    !Number.isFinite(row.updatedAt) ||
    row.updatedAt < 0 ||
    row.updatedAt > MAX_DATE
  )
    return null;
  const repayments = row.repayments.map((repayment) =>
    parseRepayment(repayment, row.id as string),
  );
  if (repayments.some((repayment) => !repayment)) return null;
  const validRepayments = repayments as LoanRepayment[];
  if (
    row.advances !== undefined &&
    (!Array.isArray(row.advances) || row.advances.length > 50)
  )
    return null;
  const advances = (row.advances ?? []).map((item) =>
    parseAdvance(item, row.id as string),
  );
  if (advances.some((item) => item === null)) return null;
  const validAdvances = advances as LoanAdvance[];
  const additionalAmount = validAdvances.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const totalAmount = (row.principalAmount as number) + additionalAmount;
  const repaymentAmount = validRepayments.reduce(
    (sum, repayment) => sum + repayment.amount,
    0,
  );
  const lastEditedAdvanceIndex = row.lastEditedAdvanceIndex;
  const lastEditedRepaymentIndex = row.lastEditedRepaymentIndex;
  if (
    !Number.isSafeInteger(totalAmount) ||
    (row.additionalAmount !== undefined &&
      !Number.isSafeInteger(row.additionalAmount)) ||
    additionalAmount !== (row.additionalAmount ?? 0) ||
    (row.recordedRepaymentAmount !== undefined &&
      (!Number.isSafeInteger(row.recordedRepaymentAmount) ||
        row.recordedRepaymentAmount !== repaymentAmount)) ||
    (row.advances === undefined) !== (row.additionalAmount === undefined) ||
    (lastEditedAdvanceIndex !== undefined &&
      (!Number.isSafeInteger(lastEditedAdvanceIndex) ||
        lastEditedAdvanceIndex < 0 ||
        lastEditedAdvanceIndex >= validAdvances.length)) ||
    (lastEditedRepaymentIndex !== undefined &&
      (!Number.isSafeInteger(lastEditedRepaymentIndex) ||
        lastEditedRepaymentIndex < 0 ||
        lastEditedRepaymentIndex >= validRepayments.length)) ||
    new Set(validAdvances.map(({ id }) => id)).size !== validAdvances.length
  )
    return null;
  if (
    new Set(validRepayments.map(({ id }) => id)).size !==
      validRepayments.length ||
    repaymentAmount > totalAmount
  )
    return null;
  return {
    id: row.id,
    ownerId: row.ownerId,
    borrowerName: row.borrowerName.trim(),
    principalAmount: row.principalAmount as number,
    ...(row.recordedRepaymentAmount !== undefined
      ? { recordedRepaymentAmount: row.recordedRepaymentAmount }
      : {}),
    ...(row.advances !== undefined
      ? { advances: validAdvances, additionalAmount }
      : {}),
    ...(lastEditedAdvanceIndex !== undefined ? { lastEditedAdvanceIndex } : {}),
    ...(lastEditedRepaymentIndex !== undefined
      ? { lastEditedRepaymentIndex }
      : {}),
    lentAt: row.lentAt,
    dueAt: row.dueAt ?? null,
    remindOnDueDate: row.remindOnDueDate,
    note: row.note.trim(),
    repayments: validRepayments,
    cancelledAt: row.cancelledAt ?? null,
    updatedAt: row.updatedAt,
  };
}

function requireUid(uid: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid))
    throw new Error('Không tìm thấy tài khoản đang đăng nhập.');
}

async function readLocal(uid: string) {
  const raw = await getEncryptedItem(uid, cacheKey(uid));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => parseLoanRecord(item, uid))
      .filter((item): item is LoanRecord => item !== null);
  } catch {
    return [];
  }
}

async function writeLocal(uid: string, loans: LoanRecord[]) {
  await setEncryptedItem(uid, cacheKey(uid), JSON.stringify(loans));
}

function loanCollection(uid: string) {
  return collection(getFirestore(), 'financeAccounts', uid, 'loans');
}

function financeTransactionCollection(uid: string) {
  return collection(getFirestore(), 'financeAccounts', uid, 'transactions');
}

function deletedLoanCollection(uid: string) {
  return collection(getFirestore(), 'financeAccounts', uid, 'deletedLoans');
}

function loanDocument(uid: string, id: string) {
  return doc(getFirestore(), 'financeAccounts', uid, 'loans', id);
}

function deletedLoanDocument(uid: string, id: string) {
  return doc(getFirestore(), 'financeAccounts', uid, 'deletedLoans', id);
}

function deletedRepaymentDocument(uid: string, transactionId: string) {
  return doc(
    getFirestore(),
    'financeAccounts',
    uid,
    'deletedLoanRepayments',
    transactionId,
  );
}

function financeTransactionDocument(uid: string, id: string) {
  return doc(getFirestore(), 'financeAccounts', uid, 'transactions', id);
}

function nextRevision(previous: number) {
  return Math.max(Date.now(), previous + 1);
}

function lendingTransactionId(loanId: string) {
  return `loan-lent-${loanId}`;
}

function createLendingTransaction(
  uid: string,
  loan: LoanRecord,
): FinanceTransaction {
  const id = lendingTransactionId(loan.id);
  if (!ID.test(id))
    throw new LoanDataConflictError(
      'Mã khoản cho vay quá dài để liên kết với giao dịch Tài chính.',
    );
  return {
    id,
    ownerId: uid,
    type: 'expense',
    expenseSource: 'loan_lending',
    loanId: loan.id,
    amount: loan.principalAmount,
    category: 'Cho mượn',
    note: `Cho ${loan.borrowerName} mượn tiền`.slice(0, 120),
    createdAt: loan.lentAt,
  };
}

function matchesLendingTransaction(
  value: unknown,
  expected: FinanceTransaction,
  uid: string,
) {
  const stored = parseFinanceTransaction(value, uid);
  return (
    stored !== null &&
    stored.id === expected.id &&
    stored.type === expected.type &&
    stored.expenseSource === expected.expenseSource &&
    stored.loanId === expected.loanId &&
    stored.advanceId === expected.advanceId &&
    stored.amount === expected.amount &&
    stored.category === expected.category &&
    stored.note === expected.note &&
    stored.createdAt === expected.createdAt
  );
}

function createAdvanceTransaction(
  uid: string,
  loan: LoanRecord,
  advance: LoanAdvance,
): FinanceTransaction {
  return {
    id: advance.financeTransactionId,
    ownerId: uid,
    type: 'expense',
    expenseSource: 'loan_lending',
    loanId: loan.id,
    advanceId: advance.id,
    amount: advance.amount,
    category: 'Cho mượn',
    note: advance.note ?? `Cho ${loan.borrowerName} mượn thêm`.slice(0, 120),
    createdAt: advance.lentAt,
  };
}

function mergeByLatest(local: LoanRecord[], remote: LoanRecord[]) {
  const merged = new Map(remote.map((loan) => [loan.id, loan]));
  for (const loan of local) {
    const cloud = merged.get(loan.id);
    if (!cloud || loan.updatedAt > cloud.updatedAt) merged.set(loan.id, loan);
  }
  return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function readNewLoanAttempt(uid: string) {
  const raw = await getEncryptedItem(uid, newLoanAttemptKey(uid));
  if (!raw) return null;
  try {
    const loan = parseLoanRecord(JSON.parse(raw), uid);
    return loan && loan.repayments.length === 0 && !loan.advances?.length
      ? loan
      : null;
  } catch {
    return null;
  }
}

function sameNewLoanInput(first: LoanRecord, second: LoanRecord) {
  return (
    first.borrowerName === second.borrowerName &&
    first.principalAmount === second.principalAmount &&
    first.dueAt === second.dueAt &&
    first.remindOnDueDate === second.remindOnDueDate &&
    first.note === second.note
  );
}

export function getPendingNewLoanAttempt(uid: string, confirmed: LoanRecord[]) {
  requireUid(uid);
  return enqueue(uid, async () => {
    const attempt = await readNewLoanAttempt(uid);
    if (attempt && confirmed.some(({ id }) => id === attempt.id)) {
      await removeEncryptedItem(newLoanAttemptKey(uid)).catch(() => undefined);
      return null;
    }
    return attempt;
  });
}

export function reserveNewLoanAttempt(uid: string, proposed: LoanRecord) {
  requireUid(uid);
  const parsed = parseLoanRecord(proposed, uid);
  if (!parsed) return Promise.reject(new Error('Khoản cho vay chưa hợp lệ.'));
  return enqueue(uid, async () => {
    const previous = await readNewLoanAttempt(uid);
    if (previous) {
      if (sameNewLoanInput(previous, parsed)) return previous;
      throw new LoanDataConflictError(
        'Có khoản cho vay đang chờ xác nhận. Hãy thử lại khoản đó trước khi tạo khoản khác.',
      );
    }
    await setEncryptedItem(uid, newLoanAttemptKey(uid), JSON.stringify(parsed));
    return parsed;
  });
}

export function readLoanData(uid: string): Promise<LoanStorageResult> {
  requireUid(uid);
  return enqueue(uid, async () => {
    const local = await readLocal(uid);
    try {
      const [snapshot, deletedSnapshot, lendingSnapshot] = await withTimeout(
        Promise.all([
          getDocsFromServer(loanCollection(uid)),
          getDocsFromServer(deletedLoanCollection(uid)),
          getDocsFromServer(
            query(
              financeTransactionCollection(uid),
              where('expenseSource', '==', 'loan_lending'),
            ),
          ),
        ]),
      );
      const deletedIds = new Set(deletedSnapshot.docs.map(({ id }) => id));
      const correctableDeletedLoanIds = deletedSnapshot.docs
        .filter((item) => {
          const value = item.data();
          return (
            value.ownerId === uid &&
            value.deleted === true &&
            Array.isArray(value.repayments) &&
            value.id === item.id
          );
        })
        .map(({ id }) => id);
      const activeLocal = local.filter(({ id }) => !deletedIds.has(id));
      const remote = snapshot.docs
        .filter(({ id }) => !deletedIds.has(id))
        .map((item) => parseLoanRecord(item.data(), uid))
        .filter((item): item is LoanRecord => item !== null);
      const newLoanAttempt = await readNewLoanAttempt(uid);
      if (
        newLoanAttempt &&
        (remote.some(({ id }) => id === newLoanAttempt.id) ||
          deletedIds.has(newLoanAttempt.id))
      )
        await removeEncryptedItem(newLoanAttemptKey(uid)).catch(
          () => undefined,
        );
      const linkedExpenses = new Map(
        lendingSnapshot.docs.map((item) => [item.id, item.data()]),
      );
      let merged = mergeByLatest(activeLocal, remote);
      let synced = true;
      const committedTransactions: FinanceTransaction[] = [];
      const locallyAheadIds = new Set<string>();
      for (const loan of activeLocal) {
        const cloud = remote.find(({ id }) => id === loan.id);
        if (!cloud || loan.updatedAt > cloud.updatedAt) {
          locallyAheadIds.add(loan.id);
          try {
            const saved = await writeLoanOnline(uid, loan);
            merged = [
              saved.loan,
              ...merged.filter(({ id }) => id !== saved.loan.id),
            ];
            if (saved.committedTransaction)
              committedTransactions.push(saved.committedTransaction);
          } catch (error) {
            synced = false;
            if (error instanceof LoanDataConflictError) {
              merged = merged.filter(({ id }) => id !== loan.id);
              if (cloud) merged = [cloud, ...merged];
            }
          }
        }
      }
      // Backfill the linked cash-out for loans created before lending was
      // recorded in Finance. The deterministic transaction ID makes this
      // safe to repeat and avoids a collection-wide transaction read.
      for (const loan of remote) {
        if (locallyAheadIds.has(loan.id)) continue;
        try {
          const expected = createLendingTransaction(uid, loan);
          if (
            matchesLendingTransaction(
              linkedExpenses.get(expected.id),
              expected,
              uid,
            )
          )
            continue;
          const saved = await writeLoanOnline(uid, loan);
          if (saved.committedTransaction)
            committedTransactions.push(saved.committedTransaction);
        } catch {
          synced = false;
        }
      }
      merged.sort((a, b) => b.updatedAt - a.updatedAt);
      await writeLocal(uid, merged);
      // A previous process may have stopped after Firestore committed but
      // before clearing its retry key. Only retire confirmed repayments.
      for (const loan of remote) {
        const attempt = await readRepaymentAttempt(uid, loan.id);
        if (attempt && isPostedRepayment(loan.repayments, attempt))
          await removeEncryptedItem(attemptKey(uid, loan.id));
        const advanceAttempt = await readAdvanceAttempt(uid, loan.id).catch(
          () => null,
        );
        if (
          advanceAttempt &&
          loan.advances?.some(({ id }) => id === advanceAttempt.id)
        )
          await removeEncryptedItem(advanceAttemptKey(uid, loan.id)).catch(
            () => undefined,
          );
      }
      for (const id of deletedIds) {
        await removeEncryptedItem(attemptKey(uid, id));
        await removeEncryptedItem(advanceAttemptKey(uid, id)).catch(
          () => undefined,
        );
      }
      return {
        loans: merged,
        synced,
        committedTransactions,
        correctableDeletedLoanIds,
      };
    } catch {
      return { loans: local, synced: false, committedTransactions: [] };
    }
  });
}

export function saveLoanData(
  uid: string,
  loan: LoanRecord,
): Promise<LoanStorageResult> {
  requireUid(uid);
  const parsed = parseLoanRecord(loan, uid);
  if (!parsed)
    return Promise.reject(new Error('Thông tin khoản cho vay chưa hợp lệ.'));
  return enqueue(uid, async () => {
    const local = await readLocal(uid);
    const existedLocally = local.some(({ id }) => id === parsed.id);
    let saved: LoanWriteResult;
    try {
      saved = await writeLoanOnline(uid, parsed);
    } catch (error) {
      if (error instanceof LoanDataConflictError) {
        const attempt = await readNewLoanAttempt(uid).catch(() => null);
        if (attempt?.id === parsed.id)
          await removeEncryptedItem(newLoanAttemptKey(uid)).catch(
            () => undefined,
          );
        throw error;
      }
      if (!existedLocally)
        throw new Error(
          'Cần có kết nối mạng để lưu khoản cho vay và khoản chi liên kết cùng lúc.',
        );
      const loans = mergeByLatest(local, [parsed]);
      await writeLocal(uid, loans);
      return { loans, synced: false, committedTransactions: [] };
    }
    const loans = await replaceLocalRecord(uid, saved.loan);
    const newLoanAttempt = await readNewLoanAttempt(uid).catch(() => null);
    if (newLoanAttempt?.id === saved.loan.id)
      await removeEncryptedItem(newLoanAttemptKey(uid)).catch(() => undefined);
    return {
      loans,
      synced: true,
      committedTransactions: saved.committedTransaction
        ? [saved.committedTransaction]
        : [],
    };
  });
}

export function deleteLoanData(
  uid: string,
  loanId: string,
): Promise<LoanStorageResult> {
  requireUid(uid);
  if (!ID.test(loanId))
    return Promise.reject(new Error('Khoản cho vay không hợp lệ.'));
  return enqueue(uid, async () => {
    const ref = loanDocument(uid, loanId);
    const lendingRef = financeTransactionDocument(
      uid,
      lendingTransactionId(loanId),
    );
    const deletedLendingTransactionId = await withTimeout(
      runTransaction(getFirestore(), async (transaction) => {
        const deletedRef = deletedLoanDocument(uid, loanId);
        const [snapshot, deletedSnapshot, lendingSnapshot] = await Promise.all([
          transaction.get(ref),
          transaction.get(deletedRef),
          transaction.get(lendingRef),
        ]);
        if (deletedSnapshot.exists() && snapshot.exists())
          throw new LoanDataConflictError(
            'Khoản này đã được xóa trên một thiết bị khác.',
          );
        if (!snapshot.exists() && !deletedSnapshot.exists()) return undefined;
        const sourceData = snapshot.exists()
          ? snapshot.data()
          : deletedSnapshot.data();
        const loan = snapshot.exists()
          ? parseLoanRecord(sourceData, uid)
          : null;
        const source = sourceData as Partial<DeletedLoanRecord> | undefined;
        if (
          !source ||
          source.ownerId !== uid ||
          source.id !== loanId ||
          (snapshot.exists() ? !loan : source.deleted !== true) ||
          !Array.isArray(source.repayments) ||
          source.repayments.length > 100 ||
          (source.advances !== undefined &&
            (!Array.isArray(source.advances) || source.advances.length > 50))
        )
          throw new LoanDataConflictError(
            'Dữ liệu khoản cho vay không hợp lệ nên không thể xóa.',
          );
        const repayments = source.repayments.map((item) =>
          parseRepayment(item, loanId),
        );
        const advances = (source.advances ?? []).map((item) =>
          parseAdvance(item, loanId),
        );
        if (repayments.some((item) => !item) || advances.some((item) => !item))
          throw new LoanDataConflictError(
            'Lịch sử khoản cho vay không hợp lệ nên không thể xóa.',
          );
        const linked = [
          {
            ref: lendingRef,
            snapshot: lendingSnapshot,
            matches: (row: FinanceTransaction) =>
              row.type === 'expense' &&
              row.expenseSource === 'loan_lending' &&
              !row.advanceId &&
              (!loan ||
                matchesLendingTransaction(
                  row,
                  createLendingTransaction(uid, loan),
                  uid,
                )),
          },
          ...(await Promise.all(
            advances.map(async (item) => {
              const advance = item!;
              const ref = financeTransactionDocument(
                uid,
                advance.financeTransactionId,
              );
              return {
                ref,
                snapshot: await transaction.get(ref),
                matches: (row: FinanceTransaction) =>
                  row.type === 'expense' &&
                  row.expenseSource === 'loan_lending' &&
                  row.advanceId === advance.id &&
                  row.amount === advance.amount &&
                  row.createdAt === advance.lentAt,
              };
            }),
          )),
          ...(await Promise.all(
            repayments.map(async (item) => {
              const repayment = item!;
              const ref = financeTransactionDocument(
                uid,
                repayment.financeTransactionId,
              );
              return {
                ref,
                snapshot: await transaction.get(ref),
                matches: (row: FinanceTransaction) =>
                  row.type === 'income' &&
                  row.incomeSource === 'loan_repayment' &&
                  row.repaymentId === repayment.id &&
                  row.amount === repayment.amount &&
                  (row.repaymentReceivedAt ?? repayment.receivedAt) ===
                    repayment.receivedAt,
              };
            }),
          )),
        ];
        // Finish all reads and validation before deleting any linked entry.
        for (const entry of linked) {
          if (!entry.snapshot.exists()) continue;
          const row = parseFinanceTransaction(entry.snapshot.data(), uid);
          if (
            !row ||
            row.id !== entry.ref.id ||
            row.loanId !== loanId ||
            !entry.matches(row)
          )
            throw new LoanDataConflictError(
              'Giao dịch liên kết không khớp, chưa thể xóa khoản này.',
            );
        }
        if (loan) {
          const deletedLoan: DeletedLoanRecord = {
            id: loan.id,
            ownerId: uid,
            deleted: true,
            updatedAt: nextRevision(loan.updatedAt),
            // Keep raw history for legacy fields and to block stale-device replay.
            repayments: source.repayments,
            ...(source.advances !== undefined
              ? {
                  advances: source.advances,
                  additionalAmount: source.additionalAmount,
                }
              : {}),
          };
          transaction.set(deletedRef, deletedLoan);
          transaction.delete(ref);
        }
        for (const entry of linked) {
          if (entry.snapshot.exists()) transaction.delete(entry.ref);
        }
        // Always reload Finance, including retries where the principal is absent.
        return lendingTransactionId(loanId);
      }),
    );
    const loans = (await readLocal(uid)).filter((loan) => loan.id !== loanId);
    await writeLocal(uid, loans);
    return {
      loans,
      synced: true,
      committedTransactions: [],
      deletedLendingTransactionId,
    };
  });
}

export function correctLoanPrincipal(
  uid: string,
  loanId: string,
  changes: { amount: number; note: string; lentAt: number },
  expectedUpdatedAt: number,
): Promise<LoanStorageResult> {
  requireUid(uid);
  const note = changes.note.trim();
  if (
    !ID.test(loanId) ||
    !Number.isSafeInteger(changes.amount) ||
    changes.amount <= 0 ||
    !Number.isSafeInteger(changes.lentAt) ||
    changes.lentAt < 0 ||
    changes.lentAt > MAX_DATE ||
    note.length === 0 ||
    note.length > 500
  )
    return Promise.reject(
      new Error('Thông tin khoản cho vay ban đầu chưa hợp lệ.'),
    );
  return enqueue(uid, async () => {
    const ref = loanDocument(uid, loanId);
    const lendingRef = financeTransactionDocument(
      uid,
      lendingTransactionId(loanId),
    );
    const saved = await withTimeout(
      runTransaction(getFirestore(), async (transaction) => {
        const [loanSnapshot, deletedSnapshot, financeSnapshot] =
          await Promise.all([
            transaction.get(ref),
            transaction.get(deletedLoanDocument(uid, loanId)),
            transaction.get(lendingRef),
          ]);
        if (deletedSnapshot.exists() || !loanSnapshot.exists())
          throw new LoanDataConflictError('Khoản cho vay đã được xóa.');
        const loan = parseLoanRecord(loanSnapshot.data(), uid);
        if (!loan || loan.updatedAt !== expectedUpdatedAt)
          throw new LoanDataConflictError(
            'Khoản này đã thay đổi. Hãy tải lại trước khi sửa.',
          );
        if (loan.cancelledAt !== null)
          throw new LoanDataConflictError('Không thể sửa khoản đã hủy.');
        const totalAmount = changes.amount + (loan.additionalAmount ?? 0);
        if (!Number.isSafeInteger(totalAmount))
          throw new Error('Tổng tiền cho vay vượt giới hạn cho phép.');
        if (!canSetLoanTotalAmount(loan, totalAmount))
          throw new Error(
            loan.recordedRepaymentAmount === undefined &&
              loan.repayments.length > 0 &&
              totalAmount < loan.principalAmount + (loan.additionalAmount ?? 0)
              ? 'Khoản cũ đã nhận tiền chưa thể giảm tổng cho vay. Bạn vẫn có thể sửa ngày hoặc nội dung.'
              : 'Số tiền mới không được thấp hơn số đã nhận lại.',
          );
        const previousExpense = createLendingTransaction(uid, loan);
        if (
          !financeSnapshot.exists() ||
          !matchesLendingTransaction(
            financeSnapshot.data(),
            previousExpense,
            uid,
          )
        )
          throw new LoanDataConflictError(
            'Chưa tìm thấy giao dịch chi liên kết để sửa đồng thời.',
          );
        if (
          loan.principalAmount === changes.amount &&
          loan.note === note &&
          loan.lentAt === changes.lentAt
        )
          return { loan, committedTransaction: previousExpense };
        const updatedLoan = {
          ...loan,
          principalAmount: changes.amount,
          note,
          lentAt: changes.lentAt,
          updatedAt: nextRevision(loan.updatedAt),
        };
        const updatedExpense = {
          ...previousExpense,
          amount: changes.amount,
          createdAt: changes.lentAt,
        };
        transaction.set(ref, updatedLoan);
        transaction.set(lendingRef, updatedExpense);
        return { loan: updatedLoan, committedTransaction: updatedExpense };
      }),
    );
    const loans = await replaceLocalRecord(uid, saved.loan);
    return {
      loans,
      synced: true,
      committedTransactions: saved.committedTransaction
        ? [saved.committedTransaction]
        : [],
    };
  });
}

async function writeLoanOnline(
  uid: string,
  proposed: LoanRecord,
): Promise<LoanWriteResult> {
  const ref = loanDocument(uid, proposed.id);
  const deletedRef = deletedLoanDocument(uid, proposed.id);
  const expectedLendingTransaction = createLendingTransaction(uid, proposed);
  const lendingRef = financeTransactionDocument(
    uid,
    expectedLendingTransaction.id,
  );
  return withTimeout(
    runTransaction(getFirestore(), async (transaction) => {
      const [deletedSnapshot, snapshot, financeSnapshot] = await Promise.all([
        transaction.get(deletedRef),
        transaction.get(ref),
        transaction.get(lendingRef),
      ]);
      if (deletedSnapshot.exists())
        throw new LoanDataConflictError(
          'Khoản cho vay này đã bị xóa trên thiết bị khác.',
        );
      if (!snapshot.exists()) {
        if (
          proposed.repayments.length > 0 ||
          (proposed.advances?.length ?? 0) > 0
        )
          throw new LoanDataConflictError(
            'Không thể đồng bộ lịch sử nhận tiền khi khoản vay chưa có trên máy chủ.',
          );
        if (financeSnapshot.exists())
          throw new LoanDataConflictError(
            'Mã giao dịch chi cho vay đã được dùng cho dữ liệu khác.',
          );
        transaction.set(ref, proposed);
        transaction.set(lendingRef, expectedLendingTransaction);
        return {
          loan: proposed,
          committedTransaction: expectedLendingTransaction,
        };
      }

      const current = parseLoanRecord(snapshot.data(), uid);
      if (!current)
        throw new LoanDataConflictError(
          'Dữ liệu khoản cho vay trên máy chủ không hợp lệ.',
        );
      if (
        proposed.borrowerName !== current.borrowerName ||
        proposed.principalAmount !== current.principalAmount ||
        proposed.lentAt !== current.lentAt
      )
        throw new LoanDataConflictError(
          'Tên người vay, số tiền gốc và ngày cho vay không thể sửa sau khi đã ghi vào Tài chính.',
        );
      if (
        JSON.stringify(proposed.repayments) !==
          JSON.stringify(current.repayments) ||
        JSON.stringify(proposed.advances ?? []) !==
          JSON.stringify(current.advances ?? []) ||
        (proposed.additionalAmount ?? 0) !== (current.additionalAmount ?? 0)
      )
        throw new LoanDataConflictError(
          'Khoản vay vừa thay đổi trên thiết bị khác. Hãy tải lại trước khi tiếp tục.',
        );

      const lendingTransaction = createLendingTransaction(uid, current);
      let committedTransaction: FinanceTransaction | undefined;
      if (financeSnapshot.exists()) {
        if (
          !matchesLendingTransaction(
            financeSnapshot.data(),
            lendingTransaction,
            uid,
          )
        )
          throw new LoanDataConflictError(
            'Giao dịch chi liên kết đã tồn tại nhưng dữ liệu không khớp.',
          );
      } else {
        transaction.set(lendingRef, lendingTransaction);
        committedTransaction = lendingTransaction;
      }
      if (
        proposed.cancelledAt !== null &&
        current.repayments.length > 0 &&
        current.cancelledAt === null
      )
        throw new LoanDataConflictError(
          'Khoản này đã có lịch sử nhận tiền nên không thể hủy.',
        );
      const cancelling =
        proposed.cancelledAt !== null && current.cancelledAt === null;
      if (proposed.updatedAt <= current.updatedAt && !cancelling)
        return { loan: current, committedTransaction };

      const saved: LoanRecord = {
        ...current,
        ...proposed,
        repayments: current.repayments,
        cancelledAt: current.cancelledAt ?? proposed.cancelledAt,
        updatedAt: nextRevision(current.updatedAt),
      };
      transaction.set(ref, saved);
      return { loan: saved, committedTransaction };
    }),
  );
}

async function replaceLocalRecord(uid: string, loan: LoanRecord) {
  const loans = [
    loan,
    ...(await readLocal(uid)).filter(({ id }) => id !== loan.id),
  ].sort((a, b) => b.updatedAt - a.updatedAt);
  await writeLocal(uid, loans);
  return loans;
}

export function cacheLoanRecord(
  uid: string,
  loan: LoanRecord,
): Promise<LoanStorageResult> {
  requireUid(uid);
  const parsed = parseLoanRecord(loan, uid);
  if (!parsed)
    return Promise.reject(new Error('Thông tin khoản cho vay chưa hợp lệ.'));
  return enqueue(uid, async () => ({
    loans: await replaceLocalRecord(uid, parsed),
    synced: false,
    committedTransactions: [],
  }));
}

async function readRepaymentAttempt(uid: string, loanId: string) {
  const raw = await getEncryptedItem(uid, attemptKey(uid, loanId));
  if (!raw) return null;
  try {
    return parseRepayment(JSON.parse(raw), loanId);
  } catch {
    return null;
  }
}

function isPostedRepayment(
  repayments: LoanRepayment[],
  attempt: LoanRepayment,
) {
  return repayments.some(
    (repayment) =>
      repayment.status === 'posted' &&
      repayment.id === attempt.id &&
      repayment.amount === attempt.amount &&
      repayment.receivedAt === attempt.receivedAt &&
      repayment.financeTransactionId === attempt.financeTransactionId,
  );
}

export function getOrCreateRepaymentAttempt(
  uid: string,
  loanId: string,
  amount: number,
  confirmedRepayments: LoanRepayment[] = [],
): Promise<LoanRepayment> {
  requireUid(uid);
  if (!ID.test(loanId) || !Number.isSafeInteger(amount) || amount <= 0)
    return Promise.reject(new Error('Số tiền nhận lại không hợp lệ.'));

  return enqueue(uid, async () => {
    const key = attemptKey(uid, loanId);
    const attempt = await readRepaymentAttempt(uid, loanId);
    if (attempt && !isPostedRepayment(confirmedRepayments, attempt)) {
      if (attempt.amount !== amount)
        throw new LoanDataConflictError(
          'Khoản nhận trước đang chờ xác nhận. Hãy thử lại đúng số tiền đó trước.',
        );
      return attempt;
    }

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const repayment: LoanRepayment = {
      id,
      amount,
      receivedAt: Date.now(),
      financeTransactionId: `loan-${loanId}-${id}`,
      status: 'pending',
    };
    await setEncryptedItem(uid, key, JSON.stringify(repayment));
    return repayment;
  });
}

export function clearRepaymentAttempt(uid: string, loanId: string) {
  requireUid(uid);
  return enqueue(uid, () => removeEncryptedItem(attemptKey(uid, loanId)));
}

async function readAdvanceAttempt(uid: string, loanId: string) {
  const raw = await getEncryptedItem(uid, advanceAttemptKey(uid, loanId));
  if (!raw) return null;
  try {
    return parseAdvance(JSON.parse(raw), loanId);
  } catch {
    return null;
  }
}

export async function getPendingAdvanceAttempt(
  uid: string,
  loanId: string,
  confirmedAdvances: LoanAdvance[] = [],
) {
  requireUid(uid);
  if (!ID.test(loanId)) return null;
  return enqueue(uid, async () => {
    const attempt = await readAdvanceAttempt(uid, loanId);
    if (attempt && confirmedAdvances.some(({ id }) => id === attempt.id)) {
      await removeEncryptedItem(advanceAttemptKey(uid, loanId)).catch(
        () => undefined,
      );
      return null;
    }
    return attempt;
  });
}

function hasConfirmedAdvance(advances: LoanAdvance[], attempt: LoanAdvance) {
  return advances.some(
    (advance) =>
      advance.id === attempt.id &&
      advance.amount === attempt.amount &&
      advance.lentAt === attempt.lentAt &&
      advance.note === attempt.note &&
      advance.financeTransactionId === attempt.financeTransactionId,
  );
}

export function getOrCreateAdvanceAttempt(
  uid: string,
  loanId: string,
  amount: number,
  details: { lentAt: number; note: string },
  confirmedAdvances: LoanAdvance[] = [],
): Promise<LoanAdvance> {
  requireUid(uid);
  const note = details.note.trim();
  if (
    !ID.test(loanId) ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(details.lentAt) ||
    details.lentAt < 0 ||
    details.lentAt > MAX_DATE ||
    !note ||
    note.length > 120
  )
    return Promise.reject(
      new Error('Số tiền, ngày hoặc nội dung cho vay thêm không hợp lệ.'),
    );
  return enqueue(uid, async () => {
    const attempt = await readAdvanceAttempt(uid, loanId);
    if (attempt && !confirmedAdvances.some(({ id }) => id === attempt.id)) {
      if (
        attempt.amount !== amount ||
        attempt.lentAt !== details.lentAt ||
        attempt.note !== note
      )
        throw new LoanDataConflictError(
          'Lần cho thêm trước đang chờ xác nhận. Hãy tải lại sổ để kiểm tra trước khi nhập lần mới.',
        );
      return attempt;
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const advance = parseAdvance(
      {
        id,
        amount,
        lentAt: details.lentAt,
        note,
        financeTransactionId: `loan-lent-${loanId}-${id}`,
      },
      loanId,
    );
    if (!advance)
      throw new Error('Mã khoản cho vay quá dài để tạo lần cho thêm.');
    await setEncryptedItem(
      uid,
      advanceAttemptKey(uid, loanId),
      JSON.stringify(advance),
    );
    return advance;
  });
}

export function clearAdvanceAttempt(uid: string, loanId: string) {
  requireUid(uid);
  return enqueue(uid, () =>
    removeEncryptedItem(advanceAttemptKey(uid, loanId)),
  );
}

export function recordLoanAdvanceAtomically(
  uid: string,
  loanId: string,
  candidate: LoanAdvance,
): Promise<{ loan: LoanRecord; transaction: FinanceTransaction }> {
  requireUid(uid);
  const advance = parseAdvance(candidate, loanId);
  if (!ID.test(loanId) || !advance)
    return Promise.reject(
      new Error('Thông tin lần cho vay thêm không hợp lệ.'),
    );
  const ref = loanDocument(uid, loanId);
  const financeRef = financeTransactionDocument(
    uid,
    advance.financeTransactionId,
  );
  return withTimeout(
    runTransaction(getFirestore(), async (transaction) => {
      const [snapshot, deletedSnapshot, financeSnapshot] = await Promise.all([
        transaction.get(ref),
        transaction.get(deletedLoanDocument(uid, loanId)),
        transaction.get(financeRef),
      ]);
      if (deletedSnapshot.exists() || !snapshot.exists())
        throw new LoanDataConflictError(
          'Khoản cho vay đã bị xóa hoặc chưa đồng bộ.',
        );
      const current = parseLoanRecord(snapshot.data(), uid);
      if (!current || current.id !== loanId)
        throw new LoanDataConflictError(
          'Dữ liệu khoản cho vay không hợp lệ. Hãy tải lại sổ.',
        );
      const advances = current.advances ?? [];
      const existing = advances.find(({ id }) => id === advance.id);
      if (existing && !hasConfirmedAdvance([existing], advance))
        throw new LoanDataConflictError(
          'Mã lần cho vay thêm đã được dùng cho dữ liệu khác.',
        );
      const expense = createAdvanceTransaction(uid, current, advance);
      if (
        financeSnapshot.exists() &&
        !matchesLendingTransaction(financeSnapshot.data(), expense, uid)
      )
        throw new LoanDataConflictError(
          'Khoản chi liên kết không khớp. Hãy tải lại sổ.',
        );
      if (!existing) {
        if (financeSnapshot.exists())
          throw new LoanDataConflictError(
            'Giao dịch chi đã tồn tại nhưng thiếu lịch sử cho thêm.',
          );
        if (getLoanStatus(current) !== 'open')
          throw new LoanDataConflictError(
            'Chỉ có thể cho vay thêm khi khoản này chưa trả xong.',
          );
        if (getLoanPendingAmount(current) > 0)
          throw new LoanDataConflictError(
            'Hãy đồng bộ lần nhận tiền đang chờ trước khi cho vay thêm.',
          );
        if (advances.length >= 50)
          throw new LoanDataConflictError(
            'Khoản này đã đủ 50 lần cho thêm. Hãy tạo khoản mới.',
          );
        const additionalAmount =
          (current.additionalAmount ?? 0) + advance.amount;
        if (!Number.isSafeInteger(current.principalAmount + additionalAmount))
          throw new LoanDataConflictError(
            'Tổng số tiền cho vay vượt giới hạn cho phép.',
          );
        const loan: LoanRecord = {
          ...current,
          advances: [...advances, advance],
          additionalAmount,
          updatedAt: nextRevision(current.updatedAt),
        };
        transaction.set(ref, loan);
        transaction.set(financeRef, expense);
        return { loan, transaction: expense };
      }
      // Replay the original intent after an uncertain network result.
      if (!financeSnapshot.exists()) transaction.set(financeRef, expense);
      return { loan: current, transaction: expense };
    }),
  );
}

export function updateLoanAdvanceAtomically(
  uid: string,
  loanId: string,
  expectedAdvance: LoanAdvance,
  changes: { amount: number; note: string; lentAt: number },
): Promise<LoanStorageResult> {
  requireUid(uid);
  const expected = parseAdvance(expectedAdvance, loanId);
  const note = changes.note.trim();
  if (
    !ID.test(loanId) ||
    !expected ||
    !Number.isSafeInteger(changes.amount) ||
    changes.amount <= 0 ||
    !Number.isSafeInteger(changes.lentAt) ||
    changes.lentAt < 0 ||
    changes.lentAt > MAX_DATE ||
    !note ||
    note.length > 120
  )
    return Promise.reject(new Error('Thông tin lần cho vay thêm chưa hợp lệ.'));

  return enqueue(uid, async () => {
    const ref = loanDocument(uid, loanId);
    const saved = await withTimeout(
      runTransaction(getFirestore(), async (transaction) => {
        const [loanSnapshot, deletedSnapshot] = await Promise.all([
          transaction.get(ref),
          transaction.get(deletedLoanDocument(uid, loanId)),
        ]);
        if (deletedSnapshot.exists() || !loanSnapshot.exists())
          throw new LoanDataConflictError('Khoản cho vay đã được xóa.');
        const current = parseLoanRecord(loanSnapshot.data(), uid);
        if (!current)
          throw new LoanDataConflictError(
            'Dữ liệu khoản cho vay không hợp lệ. Hãy tải lại sổ.',
          );
        if (current.cancelledAt !== null)
          throw new LoanDataConflictError(
            'Không thể sửa khoản cho vay đã hủy.',
          );
        const advances = current.advances ?? [];
        const index = advances.findIndex(({ id }) => id === expected.id);
        if (index < 0)
          throw new LoanDataConflictError(
            'Không tìm thấy lần cho vay thêm cần sửa.',
          );
        const existing = advances[index];
        const updatedAdvance = parseAdvance(
          {
            ...existing,
            amount: changes.amount,
            note,
            lentAt: changes.lentAt,
          },
          loanId,
        );
        if (!updatedAdvance)
          throw new Error('Thông tin lần cho vay thêm chưa hợp lệ.');

        const previousExpense = createAdvanceTransaction(
          uid,
          current,
          existing,
        );
        const financeRef = financeTransactionDocument(
          uid,
          existing.financeTransactionId,
        );
        const financeSnapshot = await transaction.get(financeRef);
        const updatedAdvances = [...advances];
        updatedAdvances[index] = updatedAdvance;
        const additionalAmount = updatedAdvances.reduce(
          (total, advance) => total + advance.amount,
          0,
        );
        const totalAmount = current.principalAmount + additionalAmount;
        if (
          !Number.isSafeInteger(additionalAmount) ||
          !Number.isSafeInteger(totalAmount)
        )
          throw new Error('Tổng tiền cho vay vượt giới hạn cho phép.');
        if (!canSetLoanTotalAmount(current, totalAmount))
          throw new Error(
            current.recordedRepaymentAmount === undefined &&
              current.repayments.length > 0 &&
              totalAmount <
                current.principalAmount + (current.additionalAmount ?? 0)
              ? 'Khoản cũ đã nhận tiền chưa thể giảm tổng cho vay. Bạn vẫn có thể sửa ngày hoặc nội dung.'
              : 'Số tiền mới không được thấp hơn số đã nhận lại.',
          );

        const expense = createAdvanceTransaction(uid, current, updatedAdvance);
        const alreadyUpdated = hasConfirmedAdvance([existing], updatedAdvance);
        if (!financeSnapshot.exists())
          throw new LoanDataConflictError(
            'Chưa tìm thấy giao dịch Chi liên kết để cập nhật.',
          );
        if (
          !matchesLendingTransaction(
            financeSnapshot.data(),
            alreadyUpdated ? expense : previousExpense,
            uid,
          )
        )
          throw new LoanDataConflictError(
            'Giao dịch Chi đã thay đổi. Hãy đồng bộ sổ trước khi sửa.',
          );
        if (alreadyUpdated) return { loan: current, committedTransactions: [] };
        if (!hasConfirmedAdvance([existing], expected))
          throw new LoanDataConflictError(
            'Lần cho vay thêm đã thay đổi. Hãy tải lại trước khi sửa.',
          );
        if (
          existing.amount === updatedAdvance.amount &&
          existing.lentAt === updatedAdvance.lentAt &&
          existing.note === updatedAdvance.note
        )
          return { loan: current, committedTransactions: [] };

        const updatedLoan: LoanRecord = {
          ...current,
          advances: updatedAdvances,
          additionalAmount,
          lastEditedAdvanceIndex: index,
          updatedAt: nextRevision(current.updatedAt),
        };
        transaction.set(ref, updatedLoan);
        transaction.set(financeRef, expense);
        return { loan: updatedLoan, committedTransactions: [expense] };
      }),
    );
    const loans = await replaceLocalRecord(uid, saved.loan);
    return {
      loans,
      synced: true,
      committedTransactions: saved.committedTransactions,
    };
  });
}

export type LoanRepaymentCommit = {
  loan: LoanRecord;
  transaction: FinanceTransaction;
};

export function recordLoanRepaymentAtomically(
  uid: string,
  loanId: string,
  candidate: LoanRepayment,
): Promise<LoanRepaymentCommit> {
  requireUid(uid);
  const candidateRecord = parseRepayment(candidate, loanId);
  if (!candidateRecord)
    return Promise.reject(new Error('Thông tin khoản nhận lại không hợp lệ.'));

  const loanRef = loanDocument(uid, loanId);
  const deletedRef = deletedLoanDocument(uid, loanId);
  const financeRef = financeTransactionDocument(
    uid,
    candidate.financeTransactionId,
  );
  return withTimeout(
    runTransaction(getFirestore(), async (firestoreTransaction) => {
      const [loanSnapshot, financeSnapshot, deletedSnapshot] =
        await Promise.all([
          firestoreTransaction.get(loanRef),
          firestoreTransaction.get(financeRef),
          firestoreTransaction.get(deletedRef),
        ]);
      if (deletedSnapshot.exists())
        throw new LoanDataConflictError('Khoản cho vay này đã bị xóa.');
      const current = loanSnapshot.exists()
        ? parseLoanRecord(loanSnapshot.data(), uid)
        : null;
      if (!current || current.id !== loanId)
        throw new LoanDataConflictError(
          'Khoản vay chưa được đồng bộ. Kết nối mạng rồi tải lại sổ trước khi ghi nhận tiền.',
        );
      if (current.cancelledAt !== null)
        throw new LoanDataConflictError('Khoản cho vay này đã bị hủy.');

      const existing = current.repayments.find(({ id }) => id === candidate.id);
      if (
        existing &&
        (existing.amount !== candidate.amount ||
          existing.receivedAt !== candidate.receivedAt ||
          existing.financeTransactionId !== candidate.financeTransactionId)
      )
        throw new LoanDataConflictError(
          'Mã lần nhận tiền đã được dùng cho số tiền khác.',
        );
      if (
        !existing &&
        current.repayments.some(({ status }) => status === 'pending')
      )
        throw new LoanDataConflictError(
          'Khoản này đang có lần nhận tiền chờ đồng bộ. Hãy tải lại sổ và thử lại khoản đó trước.',
        );
      if (!existing) {
        const available =
          getLoanOutstandingAmount(current) - getLoanPendingAmount(current);
        if (candidate.amount > available)
          throw new LoanDataConflictError(
            'Số tiền nhận lại vượt quá số còn phải thu trên máy chủ.',
          );
        if (current.repayments.length >= 100)
          throw new LoanDataConflictError(
            'Một khoản có thể lưu tối đa 100 lần nhận tiền.',
          );
      }

      const repayment: LoanRepayment = { ...candidate, status: 'posted' };
      const transactionDate = new Date(repayment.receivedAt);
      transactionDate.setHours(12, 0, 0, 0);
      const financeTransaction: FinanceTransaction = {
        id: repayment.financeTransactionId,
        ownerId: uid,
        type: 'income',
        incomeSource: 'loan_repayment',
        loanId: current.id,
        repaymentId: repayment.id,
        repaymentReceivedAt: repayment.receivedAt,
        amount: repayment.amount,
        category: 'Thu hồi cho mượn',
        note: `Nhận lại tiền từ ${current.borrowerName}`.slice(0, 120),
        createdAt: transactionDate.getTime(),
      };

      let shouldWriteFinanceTransaction = !financeSnapshot.exists();
      if (financeSnapshot.exists()) {
        const stored = financeSnapshot.data() as Partial<FinanceTransaction>;
        const matches =
          stored.id === financeTransaction.id &&
          stored.ownerId === financeTransaction.ownerId &&
          stored.type === financeTransaction.type &&
          stored.incomeSource === financeTransaction.incomeSource &&
          stored.loanId === financeTransaction.loanId &&
          stored.repaymentId === financeTransaction.repaymentId &&
          (stored.repaymentReceivedAt === undefined ||
            stored.repaymentReceivedAt ===
              financeTransaction.repaymentReceivedAt) &&
          stored.amount === financeTransaction.amount &&
          stored.category === financeTransaction.category &&
          stored.note === financeTransaction.note &&
          stored.createdAt === financeTransaction.createdAt;
        if (!matches)
          throw new LoanDataConflictError(
            'Giao dịch liên kết đã tồn tại nhưng dữ liệu không khớp.',
          );
        shouldWriteFinanceTransaction =
          stored.repaymentReceivedAt === undefined;
      }
      if (shouldWriteFinanceTransaction) {
        // Upgrade legacy linked entries when finalizing an older pending
        // attempt so the reciprocal Firestore rule can verify the exact pair.
        firestoreTransaction.set(financeRef, financeTransaction);
      }

      let loan = current;
      if (!existing) {
        const recordedRepaymentAmount =
          current.recordedRepaymentAmount !== undefined
            ? current.recordedRepaymentAmount + repayment.amount
            : current.repayments.length === 0
              ? repayment.amount
              : undefined;
        loan = {
          ...current,
          repayments: [...current.repayments, repayment],
          ...(recordedRepaymentAmount !== undefined
            ? { recordedRepaymentAmount }
            : {}),
          updatedAt: nextRevision(current.updatedAt),
        };
        firestoreTransaction.set(loanRef, loan);
      } else if (existing.status === 'pending') {
        if (current.repayments.length !== 1)
          throw new LoanDataConflictError(
            'Lần nhận tiền cũ cần được đồng bộ lại trước khi có thể xác nhận.',
          );
        loan = {
          ...current,
          repayments: current.repayments.map((item) =>
            item.id === existing.id ? repayment : item,
          ),
          updatedAt: nextRevision(current.updatedAt),
        };
        firestoreTransaction.set(loanRef, loan);
      } else if (!financeSnapshot.exists()) {
        // Repairs a previously posted record whose linked income was not
        // confirmed on the server before the app was closed.
        firestoreTransaction.set(loanRef, current);
      }

      return { loan, transaction: financeTransaction };
    }),
  );
}

export function removeLoanRepaymentAtomically(
  uid: string,
  loanId: string,
  expected: LoanRepayment,
): Promise<LoanRecord> {
  requireUid(uid);
  if (
    !ID.test(loanId) ||
    !parseRepayment(expected, loanId) ||
    expected.status !== 'posted'
  )
    return Promise.reject(new Error('Lần nhận tiền không hợp lệ.'));

  const loanRef = loanDocument(uid, loanId);
  const financeRef = financeTransactionDocument(
    uid,
    expected.financeTransactionId,
  );
  const deletedRef = deletedLoanDocument(uid, loanId);
  const correctionRef = deletedRepaymentDocument(
    uid,
    expected.financeTransactionId,
  );
  return withTimeout(
    runTransaction(getFirestore(), async (transaction) => {
      const [
        loanSnapshot,
        financeSnapshot,
        deletedSnapshot,
        correctionSnapshot,
      ] = await Promise.all([
        transaction.get(loanRef),
        transaction.get(financeRef),
        transaction.get(deletedRef),
        transaction.get(correctionRef),
      ]);
      if (deletedSnapshot.exists())
        throw new LoanDataConflictError('Khoản cho vay đã bị xóa.');
      const current = loanSnapshot.exists()
        ? parseLoanRecord(loanSnapshot.data(), uid)
        : null;
      if (!current || current.id !== loanId)
        throw new LoanDataConflictError(
          'Khoản cho vay chưa đồng bộ. Hãy tải lại sổ trước khi xóa lần nhận.',
        );

      const existing = current.repayments.find(({ id }) => id === expected.id);
      if (correctionSnapshot.exists()) {
        const corrected = correctionSnapshot.data() as {
          ownerId?: string;
          loanId?: string;
          repayment?: Partial<LoanRepayment>;
        };
        if (
          corrected.ownerId === uid &&
          corrected.loanId === loanId &&
          corrected.repayment?.id === expected.id &&
          corrected.repayment?.amount === expected.amount &&
          corrected.repayment?.receivedAt === expected.receivedAt &&
          corrected.repayment?.financeTransactionId ===
            expected.financeTransactionId &&
          !existing &&
          !financeSnapshot.exists()
        )
          return current;
        throw new LoanDataConflictError(
          'Lần nhận tiền đã thay đổi. Hãy tải lại sổ.',
        );
      }
      if (
        !existing ||
        existing.status !== 'posted' ||
        existing.amount !== expected.amount ||
        existing.receivedAt !== expected.receivedAt ||
        existing.financeTransactionId !== expected.financeTransactionId ||
        current.repayments.some(({ status }) => status === 'pending')
      )
        throw new LoanDataConflictError(
          'Lần nhận tiền đã thay đổi. Hãy tải lại sổ.',
        );
      const finance = financeSnapshot.exists()
        ? parseFinanceTransaction(financeSnapshot.data(), uid)
        : null;
      if (
        !finance ||
        finance.id !== expected.financeTransactionId ||
        finance.type !== 'income' ||
        finance.incomeSource !== 'loan_repayment' ||
        finance.loanId !== loanId ||
        finance.repaymentId !== expected.id ||
        (finance.repaymentReceivedAt !== undefined &&
          finance.repaymentReceivedAt !== expected.receivedAt) ||
        finance.amount !== expected.amount
      )
        throw new LoanDataConflictError(
          'Giao dịch Tài chính liên kết không khớp. Chưa xóa lần nhận tiền.',
        );

      // Preserve any legacy keys on untouched repayments so the rules can
      // verify that exactly one element disappeared from the original list.
      const storedLoan = loanSnapshot.data() as LoanRecord;
      const rawRepayments = storedLoan.repayments;
      const removed = rawRepayments.find(({ id }) => id === expected.id);
      if (!removed)
        throw new LoanDataConflictError('Lịch sử nhận tiền không khớp.');
      const loan: LoanRecord = {
        ...storedLoan,
        repayments: rawRepayments.filter(({ id }) => id !== expected.id),
        ...(current.recordedRepaymentAmount !== undefined
          ? {
              recordedRepaymentAmount:
                current.recordedRepaymentAmount - expected.amount,
            }
          : {}),
        updatedAt: nextRevision(current.updatedAt),
      };
      delete loan.lastEditedRepaymentIndex;
      transaction.set(correctionRef, {
        id: expected.financeTransactionId,
        ownerId: uid,
        loanId,
        repayment: removed,
        updatedAt: loan.updatedAt,
      });
      transaction.set(loanRef, loan);
      transaction.delete(financeRef);
      return loan;
    }),
  );
}

export function updateLoanRepaymentAtomically(
  uid: string,
  loanId: string,
  expected: LoanRepayment,
  changes: { amount: number; receivedAt: number },
): Promise<{ loan: LoanRecord; transaction: FinanceTransaction }> {
  requireUid(uid);
  if (
    !ID.test(loanId) ||
    !parseRepayment(expected, loanId) ||
    expected.status !== 'posted' ||
    !Number.isSafeInteger(changes.amount) ||
    changes.amount <= 0 ||
    !Number.isSafeInteger(changes.receivedAt) ||
    changes.receivedAt < 0 ||
    changes.receivedAt > MAX_DATE
  )
    return Promise.reject(new Error('Thông tin lần nhận lại không hợp lệ.'));

  return enqueue(uid, async () => {
    const loanRef = loanDocument(uid, loanId);
    const financeRef = financeTransactionDocument(
      uid,
      expected.financeTransactionId,
    );
    const saved = await withTimeout(
      runTransaction(getFirestore(), async (transaction) => {
        const [loanSnapshot, financeSnapshot, deletedSnapshot] =
          await Promise.all([
            transaction.get(loanRef),
            transaction.get(financeRef),
            transaction.get(deletedLoanDocument(uid, loanId)),
          ]);
        if (deletedSnapshot.exists() || !loanSnapshot.exists())
          throw new LoanDataConflictError('Khoản cho vay đã bị xóa.');
        const current = parseLoanRecord(loanSnapshot.data(), uid);
        if (!current || current.cancelledAt !== null)
          throw new LoanDataConflictError(
            'Khoản cho vay đã thay đổi. Hãy tải lại sổ.',
          );
        const index = current.repayments.findIndex(
          ({ id }) => id === expected.id,
        );
        const existing = current.repayments[index];
        if (
          !existing ||
          existing.status !== 'posted' ||
          existing.amount !== expected.amount ||
          existing.receivedAt !== expected.receivedAt ||
          existing.financeTransactionId !== expected.financeTransactionId ||
          current.repayments.some(({ status }) => status === 'pending')
        )
          throw new LoanDataConflictError(
            'Lần nhận lại đã thay đổi. Hãy tải lại sổ.',
          );
        const receivedTotal =
          current.repayments.reduce((total, item) => total + item.amount, 0) -
          existing.amount +
          changes.amount;
        if (
          !Number.isSafeInteger(receivedTotal) ||
          receivedTotal >
            current.principalAmount + (current.additionalAmount ?? 0)
        )
          throw new Error('Tổng đã nhận không được vượt quá tổng đã cho vay.');
        if (
          current.recordedRepaymentAmount === undefined &&
          changes.amount > existing.amount
        )
          throw new Error(
            'Khoản cũ chưa xác minh tổng đã nhận, chỉ có thể giữ nguyên hoặc giảm số tiền.',
          );
        const finance = financeSnapshot.exists()
          ? parseFinanceTransaction(financeSnapshot.data(), uid)
          : null;
        if (
          !finance ||
          finance.id !== existing.financeTransactionId ||
          finance.type !== 'income' ||
          finance.incomeSource !== 'loan_repayment' ||
          finance.loanId !== loanId ||
          finance.repaymentId !== existing.id ||
          (finance.repaymentReceivedAt !== undefined &&
            finance.repaymentReceivedAt !== existing.receivedAt) ||
          finance.amount !== existing.amount
        )
          throw new LoanDataConflictError(
            'Giao dịch Tài chính liên kết không khớp. Hãy tải lại sổ.',
          );
        if (
          existing.amount === changes.amount &&
          existing.receivedAt === changes.receivedAt
        )
          return { loan: current, transaction: finance };
        const updatedRepayment: LoanRepayment = {
          ...existing,
          amount: changes.amount,
          receivedAt: changes.receivedAt,
        };
        const transactionDate = new Date(changes.receivedAt);
        transactionDate.setHours(12, 0, 0, 0);
        const updatedFinance: FinanceTransaction = {
          ...finance,
          amount: changes.amount,
          repaymentReceivedAt: changes.receivedAt,
          createdAt: transactionDate.getTime(),
        };
        const rawLoan = loanSnapshot.data() as LoanRecord;
        const repayments = [...rawLoan.repayments];
        repayments[index] = updatedRepayment;
        const loan: LoanRecord = {
          ...rawLoan,
          repayments,
          ...(current.recordedRepaymentAmount !== undefined
            ? { recordedRepaymentAmount: receivedTotal }
            : {}),
          lastEditedRepaymentIndex: index,
          updatedAt: nextRevision(current.updatedAt),
        };
        transaction.set(loanRef, loan);
        transaction.set(financeRef, updatedFinance);
        return { loan, transaction: updatedFinance };
      }),
    );
    return saved;
  });
}

export function removeLoanAdvanceAtomically(
  uid: string,
  loanId: string,
  expectedAdvance: LoanAdvance,
): Promise<LoanRecord> {
  requireUid(uid);
  const expected = parseAdvance(expectedAdvance, loanId);
  if (!ID.test(loanId) || !expected)
    return Promise.reject(new Error('Khoản vay thêm không hợp lệ.'));

  return enqueue(uid, async () => {
    const loanRef = loanDocument(uid, loanId);
    const financeRef = financeTransactionDocument(
      uid,
      expected.financeTransactionId,
    );
    const loan = await withTimeout(
      runTransaction(getFirestore(), async (transaction) => {
        const [loanSnapshot, financeSnapshot, deletedSnapshot] =
          await Promise.all([
            transaction.get(loanRef),
            transaction.get(financeRef),
            transaction.get(deletedLoanDocument(uid, loanId)),
          ]);
        if (deletedSnapshot.exists() || !loanSnapshot.exists())
          throw new LoanDataConflictError('Khoản cho vay đã bị xóa.');
        const current = parseLoanRecord(loanSnapshot.data(), uid);
        if (!current || current.cancelledAt !== null)
          throw new LoanDataConflictError(
            'Khoản cho vay đã thay đổi. Hãy tải lại sổ.',
          );
        const existing = current.advances?.find(({ id }) => id === expected.id);
        if (!existing || !hasConfirmedAdvance([existing], expected))
          throw new LoanDataConflictError(
            'Khoản vay thêm đã thay đổi. Hãy tải lại sổ.',
          );
        const previousExpense = createAdvanceTransaction(
          uid,
          current,
          existing,
        );
        if (
          !financeSnapshot.exists() ||
          !matchesLendingTransaction(
            financeSnapshot.data(),
            previousExpense,
            uid,
          )
        )
          throw new LoanDataConflictError(
            'Giao dịch Chi liên kết không khớp. Hãy tải lại sổ.',
          );
        const additionalAmount =
          (current.additionalAmount ?? 0) - existing.amount;
        const nextTotal = current.principalAmount + additionalAmount;
        if (!canSetLoanTotalAmount(current, nextTotal))
          throw new Error(
            'Không thể xóa khoản này vì tổng còn lại sẽ thấp hơn số đã nhận, hoặc hồ sơ cũ chưa xác minh tổng nhận lại.',
          );
        const updated: LoanRecord = {
          ...(loanSnapshot.data() as LoanRecord),
          advances: (loanSnapshot.data() as LoanRecord).advances?.filter(
            ({ id }) => id !== expected.id,
          ),
          additionalAmount,
          updatedAt: nextRevision(current.updatedAt),
        };
        delete updated.lastEditedAdvanceIndex;
        transaction.set(loanRef, updated);
        transaction.delete(financeRef);
        return updated;
      }),
    );
    return loan;
  });
}

export function removeInitialLoanEntryAtomically(
  uid: string,
  loanId: string,
  expectedUpdatedAt: number,
): Promise<{ loan: LoanRecord; transaction: FinanceTransaction }> {
  requireUid(uid);
  if (!ID.test(loanId))
    return Promise.reject(new Error('Khoản vay ban đầu không hợp lệ.'));

  return enqueue(uid, async () => {
    const loanRef = loanDocument(uid, loanId);
    const principalRef = financeTransactionDocument(
      uid,
      lendingTransactionId(loanId),
    );
    const saved = await withTimeout(
      runTransaction(getFirestore(), async (transaction) => {
        const [loanSnapshot, principalSnapshot, deletedSnapshot] =
          await Promise.all([
            transaction.get(loanRef),
            transaction.get(principalRef),
            transaction.get(deletedLoanDocument(uid, loanId)),
          ]);
        if (deletedSnapshot.exists() || !loanSnapshot.exists())
          throw new LoanDataConflictError('Khoản cho vay đã bị xóa.');
        const current = parseLoanRecord(loanSnapshot.data(), uid);
        if (
          !current ||
          current.updatedAt !== expectedUpdatedAt ||
          current.cancelledAt !== null
        )
          throw new LoanDataConflictError(
            'Khoản vay đã thay đổi. Hãy tải lại sổ.',
          );
        const promoted = current.advances?.[0];
        if (!promoted)
          throw new Error('Không có khoản vay thêm để giữ lại làm khoản gốc.');
        const previousPrincipal = createLendingTransaction(uid, current);
        if (
          !principalSnapshot.exists() ||
          !matchesLendingTransaction(
            principalSnapshot.data(),
            previousPrincipal,
            uid,
          )
        )
          throw new LoanDataConflictError(
            'Giao dịch Chi ban đầu không khớp. Hãy tải lại sổ.',
          );
        const promotedRef = financeTransactionDocument(
          uid,
          promoted.financeTransactionId,
        );
        const promotedSnapshot = await transaction.get(promotedRef);
        if (
          !promotedSnapshot.exists() ||
          !matchesLendingTransaction(
            promotedSnapshot.data(),
            createAdvanceTransaction(uid, current, promoted),
            uid,
          )
        )
          throw new LoanDataConflictError(
            'Giao dịch Chi của khoản được giữ lại không khớp.',
          );
        const additionalAmount =
          (current.additionalAmount ?? 0) - promoted.amount;
        const nextTotal = promoted.amount + additionalAmount;
        if (!canSetLoanTotalAmount(current, nextTotal))
          throw new Error(
            'Không thể xóa khoản ban đầu vì số đã nhận vượt quá các khoản còn lại, hoặc hồ sơ cũ chưa xác minh tổng nhận lại.',
          );
        const updated: LoanRecord = {
          ...(loanSnapshot.data() as LoanRecord),
          principalAmount: promoted.amount,
          lentAt: promoted.lentAt,
          note: promoted.note ?? '',
          advances: (loanSnapshot.data() as LoanRecord).advances?.slice(1),
          additionalAmount,
          updatedAt: nextRevision(current.updatedAt),
        };
        delete updated.lastEditedAdvanceIndex;
        const principal: FinanceTransaction = {
          ...previousPrincipal,
          amount: promoted.amount,
          createdAt: promoted.lentAt,
        };
        transaction.set(loanRef, updated);
        transaction.set(principalRef, principal);
        transaction.delete(promotedRef);
        return { loan: updated, transaction: principal };
      }),
    );
    return saved;
  });
}
