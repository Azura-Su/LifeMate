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
import type { LoanRecord, LoanRepayment } from '../../types/loan';
import {
  getLoanOutstandingAmount,
  getLoanPendingAmount,
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
    new Set(validRepayments.map(({ id }) => id)).size !==
      validRepayments.length ||
    validRepayments.reduce((sum, repayment) => sum + repayment.amount, 0) >
      (row.principalAmount as number)
  )
    return null;
  return {
    id: row.id,
    ownerId: row.ownerId,
    borrowerName: row.borrowerName.trim(),
    principalAmount: row.principalAmount as number,
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
      'Mã khoản cho mượn quá dài để liên kết với giao dịch Tài chính.',
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
    stored.amount === expected.amount &&
    stored.category === expected.category &&
    stored.note === expected.note &&
    stored.createdAt === expected.createdAt
  );
}

function mergeByLatest(local: LoanRecord[], remote: LoanRecord[]) {
  const merged = new Map(remote.map((loan) => [loan.id, loan]));
  for (const loan of local) {
    const cloud = merged.get(loan.id);
    if (!cloud || loan.updatedAt > cloud.updatedAt) merged.set(loan.id, loan);
  }
  return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
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
            value.repayments.length === 0
          );
        })
        .map(({ id }) => id);
      const activeLocal = local.filter(({ id }) => !deletedIds.has(id));
      const remote = snapshot.docs
        .filter(({ id }) => !deletedIds.has(id))
        .map((item) => parseLoanRecord(item.data(), uid))
        .filter((item): item is LoanRecord => item !== null);
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
      }
      for (const id of deletedIds)
        await removeEncryptedItem(attemptKey(uid, id));
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
    return Promise.reject(new Error('Thông tin khoản cho mượn chưa hợp lệ.'));
  return enqueue(uid, async () => {
    const local = await readLocal(uid);
    const existedLocally = local.some(({ id }) => id === parsed.id);
    let saved: LoanWriteResult;
    try {
      saved = await writeLoanOnline(uid, parsed);
    } catch (error) {
      if (error instanceof LoanDataConflictError) throw error;
      if (!existedLocally)
        throw new Error(
          'Cần có kết nối mạng để lưu khoản cho mượn và khoản chi liên kết cùng lúc.',
        );
      const loans = mergeByLatest(local, [parsed]);
      await writeLocal(uid, loans);
      return { loans, synced: false, committedTransactions: [] };
    }
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

export function deleteLoanData(
  uid: string,
  loanId: string,
): Promise<LoanStorageResult> {
  requireUid(uid);
  if (!ID.test(loanId))
    return Promise.reject(new Error('Khoản cho mượn không hợp lệ.'));
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
        if (deletedSnapshot.exists()) {
          if (snapshot.exists())
            throw new LoanDataConflictError(
              'Khoản này đã được xóa trên một thiết bị khác.',
            );
          return undefined;
        }
        if (!snapshot.exists()) return undefined;
        const sourceData = snapshot.data();
        const loan = parseLoanRecord(sourceData, uid);
        if (!loan)
          throw new LoanDataConflictError(
            'Dữ liệu khoản cho mượn không hợp lệ nên không thể xóa.',
          );
        const rawRepayments = (
          sourceData as { repayments?: unknown } | undefined
        )?.repayments;
        if (!Array.isArray(rawRepayments))
          throw new LoanDataConflictError(
            'Lịch sử nhận tiền không hợp lệ nên không thể xóa khoản này.',
          );
        const deletedLoan: DeletedLoanRecord = {
          id: loan.id,
          ownerId: uid,
          deleted: true,
          updatedAt: nextRevision(loan.updatedAt),
          // Preserve legacy fields such as repayment.updatedAt. Firestore
          // rules require the tombstone history to exactly match the source.
          repayments: rawRepayments as LoanRepayment[],
        };
        if (loan.repayments.length === 0 && lendingSnapshot.exists()) {
          const expected = createLendingTransaction(uid, loan);
          if (!matchesLendingTransaction(lendingSnapshot.data(), expected, uid))
            throw new LoanDataConflictError(
              'Giao dịch chi liên kết không khớp, chưa thể xóa khoản này.',
            );
        }
        transaction.set(deletedRef, deletedLoan);
        transaction.delete(ref);
        if (loan.repayments.length === 0 && lendingSnapshot.exists()) {
          transaction.delete(lendingRef);
          return lendingTransactionId(loanId);
        }
        return undefined;
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
  amount: number,
  expectedUpdatedAt: number,
): Promise<LoanStorageResult> {
  requireUid(uid);
  if (!ID.test(loanId) || !Number.isSafeInteger(amount) || amount <= 0)
    return Promise.reject(new Error('Số tiền cho mượn chưa hợp lệ.'));
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
          throw new LoanDataConflictError('Khoản cho mượn đã được xóa.');
        const loan = parseLoanRecord(loanSnapshot.data(), uid);
        if (!loan || loan.updatedAt !== expectedUpdatedAt)
          throw new LoanDataConflictError(
            'Khoản này đã thay đổi. Hãy tải lại trước khi sửa.',
          );
        if (loan.cancelledAt !== null)
          throw new LoanDataConflictError('Không thể sửa khoản đã hủy.');
        if (loan.repayments.reduce((sum, row) => sum + row.amount, 0) > amount)
          throw new Error('Số tiền mới không được thấp hơn số đã nhận lại.');
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
        if (loan.principalAmount === amount)
          return { loan, committedTransaction: previousExpense };
        const updatedLoan = {
          ...loan,
          principalAmount: amount,
          updatedAt: nextRevision(loan.updatedAt),
        };
        const updatedExpense = { ...previousExpense, amount };
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
          'Khoản cho mượn này đã bị xóa trên thiết bị khác.',
        );
      if (!snapshot.exists()) {
        if (proposed.repayments.length > 0)
          throw new LoanDataConflictError(
            'Không thể đồng bộ lịch sử nhận tiền khi khoản vay chưa có trên máy chủ.',
          );
        if (financeSnapshot.exists())
          throw new LoanDataConflictError(
            'Mã giao dịch chi cho mượn đã được dùng cho dữ liệu khác.',
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
          'Dữ liệu khoản cho mượn trên máy chủ không hợp lệ.',
        );
      if (
        proposed.borrowerName !== current.borrowerName ||
        proposed.principalAmount !== current.principalAmount ||
        proposed.lentAt !== current.lentAt
      )
        throw new LoanDataConflictError(
          'Tên người mượn, số tiền gốc và ngày cho mượn không thể sửa sau khi đã ghi vào Tài chính.',
        );
      if (
        JSON.stringify(proposed.repayments) !==
        JSON.stringify(current.repayments)
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
    return Promise.reject(new Error('Thông tin khoản cho mượn chưa hợp lệ.'));
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
        throw new LoanDataConflictError('Khoản cho mượn này đã bị xóa.');
      const current = loanSnapshot.exists()
        ? parseLoanRecord(loanSnapshot.data(), uid)
        : null;
      if (!current || current.id !== loanId)
        throw new LoanDataConflictError(
          'Khoản vay chưa được đồng bộ. Kết nối mạng rồi tải lại sổ trước khi ghi nhận tiền.',
        );
      if (current.cancelledAt !== null)
        throw new LoanDataConflictError('Khoản cho mượn này đã bị hủy.');

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
        loan = {
          ...current,
          repayments: [...current.repayments, repayment],
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
