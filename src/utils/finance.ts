import type { FinanceTransaction } from '../types/finance';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types/finance';

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
  return {
    id: row.id,
    ownerId: row.ownerId,
    type: row.type,
    amount: row.amount,
    category: row.category.trim(),
    note: row.note.trim(),
    createdAt: row.createdAt,
  };
}

export function getMonthlySummary(
  transactions: FinanceTransaction[],
  date: Date = new Date(),
) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  const currentMonth = transactions.filter(
    (transaction) =>
      transaction.createdAt >= start && transaction.createdAt < end,
  );
  const income = currentMonth.reduce(
    (sum, transaction) =>
      transaction.type === 'income' ? sum + transaction.amount : sum,
    0,
  );
  const expense = currentMonth.reduce(
    (sum, transaction) =>
      transaction.type === 'expense' ? sum + transaction.amount : sum,
    0,
  );
  return { income, expense, balance: income - expense };
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
  for (let month = startMonth; month <= endMonth; month += 1) {
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 1).getTime();
    const monthlyTransactions = transactions
      .filter(
        (transaction) =>
          transaction.createdAt >= start && transaction.createdAt < end,
      )
      .sort((a, b) => a.createdAt - b.createdAt);
    if (monthlyTransactions.length === 0) continue;
    const monthlyIncome = monthlyTransactions.reduce(
      (sum, transaction) =>
        transaction.type === 'income' ? sum + transaction.amount : sum,
      0,
    );
    const monthlyExpense = monthlyTransactions.reduce(
      (sum, transaction) =>
        transaction.type === 'expense' ? sum + transaction.amount : sum,
      0,
    );
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
  const reportCategories = [
    ...new Set([
      ...allowedCategories,
      ...transactions
        .filter(
          (transaction) =>
            transaction.type === type &&
            transaction.createdAt >=
              new Date(startYear, startMonth - 1, 1).getTime() &&
            transaction.createdAt < new Date(endYear, endMonth, 1).getTime(),
        )
        .map((transaction) => transaction.category.trim())
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

  for (const transaction of transactions) {
    if (
      transaction.type !== type ||
      transaction.createdAt < start ||
      transaction.createdAt >= end
    )
      continue;
    const category =
      reportCategories.find(
        (value) =>
          value.toLocaleLowerCase('vi-VN') ===
          transaction.category.trim().toLocaleLowerCase('vi-VN'),
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
    group.total += transaction.amount;
    group.categories[category] += transaction.amount;
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

export function filterFinanceTransactions(
  transactions: FinanceTransaction[],
  query: string,
) {
  const normalized = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .trim();
  if (!normalized) return transactions;
  const digits = normalized.replace(/\D/g, '');
  return transactions.filter((transaction) => {
    const text = `${transaction.note} ${transaction.category}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('vi');
    return (
      text.includes(normalized) ||
      (!!digits && String(transaction.amount).includes(digits))
    );
  });
}
