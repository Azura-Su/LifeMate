import type { FinanceTransaction } from '../types/finance';

export function parseFinanceAmount(value: string): number | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
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

export function formatFinanceAmount(amount: number) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)} ₫`;
}
