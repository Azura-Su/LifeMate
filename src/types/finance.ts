export type FinanceTransactionType = 'income' | 'expense';

export type FinanceTransaction = {
  id: string;
  ownerId: string;
  type: FinanceTransactionType;
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
  'Mua sắm',
  'Sức khỏe',
  'Khác',
] as const;
