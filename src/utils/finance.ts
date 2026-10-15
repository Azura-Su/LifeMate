import type { FinanceIncomeSource, FinanceTransaction } from '../types/finance';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types/finance';
import { parseSharedExpense } from './sharedExpense';

export function getFinanceErrorMessage(cause: unknown, fallback: string) {
  const code =
    cause &&
    typeof cause === 'object' &&
    'code' in cause &&
    typeof cause.code === 'string'
      ? cause.code
      : '';
  if (code.endsWith('permission-denied'))
    return 'Tài khoản chưa có quyền truy cập sổ thu chi.';
  if (code.endsWith('unauthenticated'))
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
  if (code.endsWith('unavailable') || code.endsWith('deadline-exceeded'))
    return 'Chưa kết nối được sổ thu chi. Kiểm tra mạng rồi thử lại.';
  const localMessages = [
    'Chưa đọc được sổ thu chi trên thiết bị.',
    'Dữ liệu sổ thu chi trên thiết bị không hợp lệ.',
    'Giao dịch không thuộc tài khoản đang đăng nhập.',
    'Số tiền phải là số nguyên lớn hơn 0.',
    'Thông tin giao dịch không hợp lệ.',
    'Mã giao dịch không hợp lệ.',
    'Giao dịch đã thay đổi trên tài khoản. Tải lại để chọn bản cần giữ.',
    'Xung đột đã được xử lý. Hãy tải lại danh sách.',
    'Giao dịch trên thiết bị đã thay đổi. Hãy tải lại.',
  ];
  return cause instanceof Error && localMessages.includes(cause.message)
    ? cause.message
    : fallback;
}

export function parseFinanceAmount(value: string): number | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function parseFinanceDate(value: string): number | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  if (
    year < 1900 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null;
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date.getTime()
    : null;
}

export function formatFinanceDate(date: Date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function parseFinanceTransaction(
  value: unknown,
  expectedOwnerId: string,
): FinanceTransaction | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<FinanceTransaction>;
  if (
    row.ownerId !== expectedOwnerId ||
    typeof row.id !== 'string' ||
    !row.id ||
    (row.type !== 'income' && row.type !== 'expense') ||
    typeof row.amount !== 'number' ||
    !Number.isSafeInteger(row.amount) ||
    row.amount <= 0 ||
    typeof row.category !== 'string' ||
    !row.category.trim() ||
    typeof row.note !== 'string' ||
    typeof row.createdAt !== 'number' ||
    !Number.isFinite(row.createdAt) ||
    row.createdAt < 0
  )
    return null;
  if (
    row.incomeSource !== undefined &&
    row.incomeSource !== 'company' &&
    row.incomeSource !== 'other' &&
    row.incomeSource !== 'loan_repayment'
  )
    return null;
  if (row.sharedExpenseReceipt !== undefined) return null;
  const sharedExpense =
    row.sharedExpense === undefined
      ? undefined
      : parseSharedExpense(row.sharedExpense, row.amount);
  if (
    (row.sharedExpense !== undefined && !sharedExpense) ||
    (sharedExpense &&
      (row.type !== 'expense' || row.expenseSource !== undefined))
  )
    return null;
  if (row.expenseSource !== undefined && row.expenseSource !== 'loan_lending')
    return null;
  const linkedLoanRepayment = row.incomeSource === 'loan_repayment';
  const linkedLoanLending = row.expenseSource === 'loan_lending';
  if (linkedLoanRepayment && linkedLoanLending) return null;
  if (
    (linkedLoanRepayment &&
      (row.type !== 'income' ||
        row.advanceId !== undefined ||
        typeof row.loanId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(row.loanId) ||
        typeof row.repaymentId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(row.repaymentId) ||
        row.id !== `loan-${row.loanId}-${row.repaymentId}` ||
        (row.repaymentReceivedAt !== undefined &&
          (typeof row.repaymentReceivedAt !== 'number' ||
            !Number.isFinite(row.repaymentReceivedAt) ||
            row.repaymentReceivedAt < 0 ||
            row.repaymentReceivedAt > 253402300799999)) ||
        row.category.trim() !== 'Thu hồi cho mượn')) ||
    (linkedLoanLending &&
      (row.type !== 'expense' ||
        typeof row.loanId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(row.loanId) ||
        (row.advanceId !== undefined &&
          (typeof row.advanceId !== 'string' ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(row.advanceId))) ||
        row.id !==
          `loan-lent-${row.loanId}${row.advanceId ? `-${row.advanceId}` : ''}` ||
        row.category.trim() !== 'Cho mượn' ||
        row.incomeSource !== undefined ||
        row.repaymentId !== undefined ||
        row.repaymentReceivedAt !== undefined)) ||
    (!linkedLoanRepayment &&
      !linkedLoanLending &&
      (row.loanId !== undefined ||
        row.advanceId !== undefined ||
        row.repaymentId !== undefined ||
        row.repaymentReceivedAt !== undefined ||
        row.expenseSource !== undefined))
  )
    return null;
  return {
    id: row.id,
    ownerId: row.ownerId,
    type: row.type,
    amount: row.amount,
    category: row.category.trim(),
    note: row.note.trim(),
    createdAt: row.createdAt,
    ...(row.type === 'income' && row.incomeSource
      ? { incomeSource: row.incomeSource }
      : {}),
    ...(linkedLoanRepayment
      ? {
          loanId: row.loanId,
          repaymentId: row.repaymentId,
          ...(row.repaymentReceivedAt !== undefined
            ? { repaymentReceivedAt: row.repaymentReceivedAt }
            : {}),
        }
      : {}),
    ...(linkedLoanLending
      ? {
          expenseSource: row.expenseSource,
          loanId: row.loanId,
          ...(row.advanceId !== undefined ? { advanceId: row.advanceId } : {}),
        }
      : {}),
    ...(sharedExpense ? { sharedExpense } : {}),
  };
}

/** Add report-only receipt rows without creating income records in storage. */
export function expandFinanceTransactions(transactions: FinanceTransaction[]) {
  return transactions.flatMap((transaction) => {
    const shared = transaction.sharedExpense;
    if (!shared) return [transaction];
    const people = new Map(
      shared.participants.map((person) => [person.id, person.name]),
    );
    const receipts: FinanceTransaction[] = shared.receipts.map((receipt) => ({
      id: `shared-receipt-${transaction.id}-${receipt.id}`,
      ownerId: transaction.ownerId,
      type: 'income',
      incomeSource: 'expense_reimbursement',
      amount: receipt.amount,
      category: transaction.category,
      note: receipt.note,
      createdAt: receipt.receivedAt,
      sharedExpenseReceipt: {
        expenseId: transaction.id,
        participantId: receipt.participantId,
        receiptId: receipt.id,
        participantName: people.get(receipt.participantId) ?? '',
      },
    }));
    return [transaction, ...receipts];
  });
}

export function getFinanceIncomeSource(
  transaction: FinanceTransaction,
): FinanceIncomeSource {
  if (transaction.type !== 'income') return 'company';
  if (
    transaction.incomeSource === 'other' ||
    transaction.incomeSource === 'loan_repayment'
  )
    return transaction.incomeSource;
  return 'company';
}

// Keep the stored repayment transaction intact; only its report contribution changes.
export function getFinanceReportContribution(transaction: FinanceTransaction) {
  if (
    transaction.type === 'income' &&
    transaction.incomeSource === 'loan_repayment'
  ) {
    return {
      kind: 'expense' as const,
      amount: -transaction.amount,
      category: 'Cho vay',
    };
  }
  if (transaction.sharedExpenseReceipt) {
    return {
      kind: 'expense' as const,
      amount: -transaction.amount,
      category: transaction.category,
    };
  }
  return {
    kind: transaction.type,
    amount: transaction.amount,
    category: getFinanceTransactionCategoryLabel(transaction),
  };
}

export function getFinanceReport(
  transactions: FinanceTransaction[],
  year: number,
  startMonth: number,
  endMonth: number,
) {
  const empty = {
    income: 0,
    expense: 0,
    balance: 0,
    months: [] as {
      month: number;
      transactions: FinanceTransaction[];
      income: number;
      expense: number;
      balance: number;
    }[],
  };
  if (
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 9999 ||
    !Number.isInteger(startMonth) ||
    !Number.isInteger(endMonth) ||
    startMonth < 1 ||
    startMonth > 12 ||
    endMonth < 1 ||
    endMonth > 12 ||
    startMonth > endMonth
  )
    return empty;

  const months = [];
  let income = 0;
  let expense = 0;
  const reportTransactions = expandFinanceTransactions(transactions);
  for (let month = startMonth; month <= endMonth; month += 1) {
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 1).getTime();
    const monthlyTransactions = reportTransactions
      .filter(
        (transaction) =>
          transaction.createdAt >= start && transaction.createdAt < end,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    if (monthlyTransactions.length === 0) continue;
    const monthlyTotals = monthlyTransactions.reduce(
      (totals, transaction) => {
        const contribution = getFinanceReportContribution(transaction);
        totals[contribution.kind] += contribution.amount;
        return totals;
      },
      { income: 0, expense: 0 },
    );
    const monthlyIncome = monthlyTotals.income;
    const monthlyExpense = monthlyTotals.expense;
    income += monthlyIncome;
    expense += monthlyExpense;
    months.push({
      month,
      transactions: monthlyTransactions,
      income: monthlyIncome,
      expense: monthlyExpense,
      balance: monthlyIncome - monthlyExpense,
    });
  }
  return { income, expense, balance: income - expense, months };
}

export function getSalaryReport(
  transactions: FinanceTransaction[],
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
) {
  const empty = {
    total: 0,
    months: [] as {
      year: number;
      month: number;
      total: number;
      transactions: FinanceTransaction[];
    }[],
  };
  if (
    !Number.isInteger(startYear) ||
    !Number.isInteger(endYear) ||
    startYear < 1900 ||
    endYear > 9999 ||
    startYear > 9999 ||
    endYear < 1900 ||
    !Number.isInteger(startMonth) ||
    !Number.isInteger(endMonth) ||
    startMonth < 1 ||
    startMonth > 12 ||
    endMonth < 1 ||
    endMonth > 12 ||
    startYear * 12 + startMonth > endYear * 12 + endMonth
  )
    return empty;

  const start = new Date(startYear, startMonth - 1, 1).getTime();
  const end = new Date(endYear, endMonth, 1).getTime();
  const grouped = new Map<
    string,
    {
      year: number;
      month: number;
      total: number;
      transactions: FinanceTransaction[];
    }
  >();

  for (const transaction of transactions) {
    if (
      transaction.type !== 'income' ||
      transaction.category.trim().toLocaleLowerCase('vi-VN') !== 'lương' ||
      transaction.createdAt < start ||
      transaction.createdAt >= end
    )
      continue;
    const date = new Date(transaction.createdAt);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${month}`;
    const group = grouped.get(key) ?? {
      year,
      month,
      total: 0,
      transactions: [],
    };
    group.total += transaction.amount;
    group.transactions.push(transaction);
    grouped.set(key, group);
  }

  const months = [...grouped.values()]
    .map((group) => ({
      ...group,
      transactions: group.transactions.sort(
        (a, b) => a.createdAt - b.createdAt,
      ),
    }))
    .sort((a, b) => a.year - b.year || a.month - b.month);
  return {
    total: months.reduce((sum, month) => sum + month.total, 0),
    months,
  };
}

function getCategorizedReport<Category extends string>(
  transactions: FinanceTransaction[],
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  type: FinanceTransaction['type'],
  allowedCategories: readonly Category[],
  fallbackCategory?: string,
) {
  const reportTransactions = expandFinanceTransactions(transactions);
  const reportCategories = [
    ...new Set([
      ...allowedCategories,
      ...reportTransactions
        .filter(
          (transaction) =>
            getFinanceReportContribution(transaction).kind === type &&
            transaction.createdAt >=
              new Date(startYear, startMonth - 1, 1).getTime() &&
            transaction.createdAt < new Date(endYear, endMonth, 1).getTime(),
        )
        .map(
          (transaction) => getFinanceReportContribution(transaction).category,
        )
        .filter(Boolean),
      ...(fallbackCategory ? [fallbackCategory] : []),
    ]),
  ];
  type CategoryTotals = Record<string, number>;
  const emptyCategories = (): CategoryTotals => ({
    ...Object.fromEntries(reportCategories.map((category) => [category, 0])),
  });
  const empty = {
    total: 0,
    categories: emptyCategories(),
    months: [] as {
      year: number;
      month: number;
      total: number;
      categories: CategoryTotals;
      transactions: FinanceTransaction[];
    }[],
  };
  if (
    !Number.isInteger(startYear) ||
    !Number.isInteger(endYear) ||
    startYear < 1900 ||
    endYear > 9999 ||
    startYear > 9999 ||
    endYear < 1900 ||
    !Number.isInteger(startMonth) ||
    !Number.isInteger(endMonth) ||
    startMonth < 1 ||
    startMonth > 12 ||
    endMonth < 1 ||
    endMonth > 12 ||
    startYear * 12 + startMonth > endYear * 12 + endMonth
  )
    return empty;

  const start = new Date(startYear, startMonth - 1, 1).getTime();
  const end = new Date(endYear, endMonth, 1).getTime();
  const grouped = new Map<
    string,
    {
      year: number;
      month: number;
      total: number;
      categories: CategoryTotals;
      transactions: FinanceTransaction[];
    }
  >();

  for (const transaction of reportTransactions) {
    const contribution = getFinanceReportContribution(transaction);
    if (
      contribution.kind !== type ||
      transaction.createdAt < start ||
      transaction.createdAt >= end
    )
      continue;
    const category =
      reportCategories.find(
        (value) =>
          value.toLocaleLowerCase('vi-VN') ===
          contribution.category.toLocaleLowerCase('vi-VN'),
      ) ?? fallbackCategory;
    if (!category) continue;

    const date = new Date(transaction.createdAt);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${month}`;
    const group = grouped.get(key) ?? {
      year,
      month,
      total: 0,
      categories: emptyCategories(),
      transactions: [],
    };
    group.total += contribution.amount;
    group.categories[category] += contribution.amount;
    group.transactions.push(transaction);
    grouped.set(key, group);
  }

  const months = [...grouped.values()]
    .map((group) => ({
      ...group,
      transactions: group.transactions.sort(
        (a, b) => b.createdAt - a.createdAt,
      ),
    }))
    .sort((a, b) => a.year - b.year || a.month - b.month);
  const categories = emptyCategories();
  for (const month of months) {
    for (const category of reportCategories) {
      categories[category] += month.categories[category];
    }
  }
  return {
    total: months.reduce((sum, month) => sum + month.total, 0),
    categories,
    months,
  };
}

export function getIncomeReport(
  transactions: FinanceTransaction[],
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  customCategories: readonly string[] = [],
) {
  return getCategorizedReport(
    transactions,
    startYear,
    startMonth,
    endYear,
    endMonth,
    'income',
    [...INCOME_CATEGORIES, ...customCategories],
  );
}

export function getExpenseReport(
  transactions: FinanceTransaction[],
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  customCategories: readonly string[] = [],
) {
  return getCategorizedReport(
    transactions,
    startYear,
    startMonth,
    endYear,
    endMonth,
    'expense',
    [...EXPENSE_CATEGORIES, ...customCategories],
    'Khác',
  );
}

// Intl formatters are costly to build on Hermes; create it once.
const amountFormat = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

export function formatFinanceAmount(amount: number) {
  return `${amountFormat.format(amount)} ₫`;
}

export function getFinanceTransactionCategoryLabel(
  transaction: FinanceTransaction,
) {
  if (transaction.expenseSource === 'loan_lending') return 'Cho vay';
  if (transaction.incomeSource === 'loan_repayment') return 'Thu hồi cho vay';
  if (transaction.sharedExpenseReceipt) return transaction.category.trim();
  return transaction.category.trim();
}

function normalizeFinanceSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/đ/g, 'd')
    .trim();
}

export function matchesFinanceSearch(
  query: string,
  text: string,
  amounts: readonly number[] = [],
) {
  const normalized = normalizeFinanceSearchText(query);
  if (!normalized) return true;
  // Only treat a numeric query as an amount; words containing digits stay text.
  const amountQuery =
    /^(?:(?:₫|d|dong|vnd)\s*)?[\d.,\s]+(?:\s*(?:₫|d|dong|vnd))?$/;
  const digits = amountQuery.test(normalized)
    ? normalized.replace(/\D/g, '')
    : '';
  return (
    normalizeFinanceSearchText(text).includes(normalized) ||
    (!!digits && amounts.some((amount) => String(amount).includes(digits)))
  );
}

export function filterFinanceTransactions(
  transactions: FinanceTransaction[],
  query: string,
  getAdditionalSearchText?: (transaction: FinanceTransaction) => string,
) {
  if (!normalizeFinanceSearchText(query)) return transactions;
  return transactions.filter((transaction) => {
    const additionalText = getAdditionalSearchText?.(transaction) ?? '';
    return matchesFinanceSearch(
      query,
      [
        transaction.note,
        transaction.category,
        additionalText,
        transaction.sharedExpenseReceipt?.participantName ?? '',
        ...(transaction.sharedExpense?.participants.map(
          (person) => person.name,
        ) ?? []),
        ...(transaction.sharedExpense?.receipts.map(
          (receipt) => receipt.note,
        ) ?? []),
      ].join(' '),
      [transaction.amount],
    );
  });
}
