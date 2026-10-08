import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useFinanceStore } from '../../store/financeStore';
import type {
  FinanceTransaction,
  FinanceTransactionType,
} from '../../types/finance';
import { getMonthlySummary, parseFinanceAmount } from '../../utils/finance';

type Draft = {
  type: FinanceTransactionType;
  amount: string;
  category: string;
  note: string;
};

export function useFinanceScreen() {
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  const transactions = useFinanceStore((state) => state.transactions);
  const loading = useFinanceStore((state) => state.loading);
  const error = useFinanceStore((state) => state.error);
  const load = useFinanceStore((state) => state.load);
  const add = useFinanceStore((state) => state.add);
  const remove = useFinanceStore((state) => state.remove);

  useEffect(() => {
    void load(uid);
  }, [load, uid]);

  async function addTransaction(draft: Draft) {
    if (!uid) throw new Error('Bạn cần đăng nhập để lưu giao dịch.');
    const amount = parseFinanceAmount(draft.amount);
    if (amount === null) throw new Error('Nhập số tiền lớn hơn 0.');
    const transaction: FinanceTransaction = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      ownerId: uid,
      type: draft.type,
      amount,
      category: draft.category,
      note: draft.note.trim(),
      createdAt: Date.now(),
    };
    await add(uid, transaction);
  }

  async function removeTransaction(id: string) {
    if (!uid) throw new Error('Bạn cần đăng nhập để xóa giao dịch.');
    await remove(uid, id);
  }

  return {
    transactions,
    loading,
    error,
    summary: getMonthlySummary(transactions),
    addTransaction,
    removeTransaction,
    refresh: () => load(uid),
  };
}
