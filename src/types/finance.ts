export type FinanceTransactionType = 'income' | 'expense';
export type FinanceIncomeSource = 'company' | 'other' | 'loan_repayment';
export type FinanceExpenseSource = 'loan_lending';
export type RegularFinanceIncomeSource = Exclude<
  FinanceIncomeSource,
  'loan_repayment'
>;

export type FinanceTransaction = {
  id: string;
  ownerId: string;
  type: FinanceTransactionType;
  incomeSource?: FinanceIncomeSource;
  expenseSource?: FinanceExpenseSource;
  loanId?: string;
  repaymentId?: string;
  repaymentReceivedAt?: number;
  amount: number;
  category: string;
  note: string;
  createdAt: number;
};

export function isLoanLedgerTransaction(transaction: FinanceTransaction) {
  return (
    transaction.incomeSource === 'loan_repayment' ||
    transaction.expenseSource === 'loan_lending'
  );
}

export const INCOME_CATEGORIES = ['Lương', 'Thưởng', 'Thu nhập khác'] as const;
export const EXPENSE_CATEGORIES = [
  'Ăn uống',
  'Di chuyển',
  'Điện nước',
  'Xăng xe',
  'Mua sắm',
  'Sức khỏe',
  'Vui chơi',
  'Khác',
] as const;
