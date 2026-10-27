import { DAILY_EFFECT_CAP } from './expConfig.mjs';

// Adapter over the existing FinanceTransaction contract (src/types/finance.ts).
// Category values are stored strings, so they are mapped here to stable effect
// IDs; Finance itself is not changed. Unknown or user-created categories fall
// back to a neutral effect instead of being guessed.
export const CATEGORY_EFFECTS = Object.freeze({
  'Ăn uống': 'eat',
  'Mua sắm': 'wardrobe',
  'Di chuyển': 'move',
  'Xăng xe': 'move',
  'Sức khỏe': 'heal',
  'Vui chơi': 'mood',
  'Điện nước': 'neutral',
  Khác: 'neutral',
});

const DAY_MS = 86400000;

export function dayKey(ms, offsetMinutes) {
  return new Date(ms + offsetMinutes * 60000).toISOString().slice(0, 10);
}

/** Returns { recordsDay, effect } for one stored transaction, or null. */
export function classifyTransaction(transaction) {
  if (!transaction || typeof transaction !== 'object') return null;
  const { type, incomeSource, expenseSource, category, createdAt } =
    transaction;
  if (!Number.isFinite(createdAt) || createdAt < 0) return null;
  if (transaction.sharedExpenseReceipt) return null; // report-only row
  if (type === 'expense') {
    // Lending money is not consumption and not a recorded spending habit.
    if (expenseSource !== undefined) return null;
    return {
      recordsDay: true,
      effect: CATEGORY_EFFECTS[category] ?? 'neutral',
    };
  }
  if (type === 'income') {
    // Repayments and reimbursements only settle an earlier expense/loan.
    if (incomeSource === 'loan_repayment') return null;
    if (incomeSource === 'expense_reimbursement') return null;
    return { recordsDay: true, effect: 'mood' };
  }
  return null;
}

/**
 * Days with at least one valid record in [fromDay, toDay], plus capped care
 * effects for `toDay`. Amounts are intentionally ignored.
 */
export function summarizeTransactions(
  transactions,
  { fromDay, toDay, offsetMinutes },
) {
  const days = new Set();
  const today = {};
  for (const transaction of transactions) {
    const kind = classifyTransaction(transaction);
    if (!kind) continue;
    const day = dayKey(transaction.createdAt, offsetMinutes);
    if (day < fromDay || day > toDay) continue;
    if (kind.recordsDay) days.add(day);
    if (day === toDay)
      today[kind.effect] = Math.min(
        DAILY_EFFECT_CAP,
        (today[kind.effect] ?? 0) + 1,
      );
  }
  return { days: [...days].sort(), todayEffects: today };
}

export function nextDay(day) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS)
    .toISOString()
    .slice(0, 10);
}
