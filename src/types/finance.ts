export type FinanceTransactionType = 'income' | 'expense';
export type FinanceIncomeSource =
  'company' | 'other' | 'loan_repayment' | 'expense_reimbursement';
export type FinanceExpenseSource = 'loan_lending';
export type RegularFinanceIncomeSource = Exclude<
  FinanceIncomeSource,
  'loan_repayment' | 'expense_reimbursement'
>;

export type SharedExpenseParticipant = {
  id: string;
  name: string;
  owedAmount: number;
};

export type SharedExpenseReceipt = {
  id: string;
  participantId: string;
  amount: number;
  receivedAt: number;
  note: string;
};

export type SharedExpense = {
  participants: SharedExpenseParticipant[];
  receipts: SharedExpenseReceipt[];
};

export type FinanceTransaction = {
  id: string;
  ownerId: string;
  type: FinanceTransactionType;
  incomeSource?: FinanceIncomeSource;
  expenseSource?: FinanceExpenseSource;
  loanId?: string;
  advanceId?: string;
  repaymentId?: string;
  repaymentReceivedAt?: number;
  sharedExpense?: SharedExpense;
  /** A report-only row derived from a shared expense receipt; never stored. */
  sharedExpenseReceipt?: {
    expenseId: string;
    participantId: string;
    receiptId: string;
    participantName: string;
  };
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
