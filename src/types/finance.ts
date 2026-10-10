export type FinanceTransactionType = 'income' | 'expense';
export type FinanceIncomeSource = 'company' | 'other';

export type FinanceTransaction = {
  id: string;
  ownerId: string;
  type: FinanceTransactionType;
  incomeSource?: FinanceIncomeSource;
  amount: number;
  category: string;
  note: string;
  createdAt: number;
};

export const INCOME_CATEGORIES = ['Lương', 'Thưởng', 'Thu nhập khác'] as const;
export const EXPENSE_CATEGORIES = [
  'Ăn uống',
  'Di chuyển',
  'Nhà cửa',
  'Điện nước',
  'Xăng xe',
  'Mua sắm',
  'Sức khỏe',
  'Khác',
] as const;
