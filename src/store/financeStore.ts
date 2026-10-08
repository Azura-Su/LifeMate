import { create } from 'zustand';
import type { FinanceTransaction } from '../types/finance';
import {
  addFinanceTransaction,
  deleteFinanceTransaction,
  readFinanceTransactions,
} from '../services/finance/financeStorage';

type FinanceState = {
  uid: string | null;
  transactions: FinanceTransaction[];
  loading: boolean;
  error: string | null;
  load: (uid: string | null) => Promise<void>;
  add: (uid: string, transaction: FinanceTransaction) => Promise<void>;
  remove: (uid: string, id: string) => Promise<void>;
};

let loadRequest = 0;

export const useFinanceStore = create<FinanceState>((set, get) => ({
  uid: null,
  transactions: [],
  loading: false,
  error: null,
  load: async (uid) => {
    const request = ++loadRequest;
    set({ uid, transactions: [], loading: !!uid, error: null });
    if (!uid) return;
    try {
      const transactions = await readFinanceTransactions(uid);
      if (request === loadRequest && get().uid === uid)
        set({ transactions, loading: false, error: null });
    } catch (error) {
      if (request === loadRequest && get().uid === uid)
        set({ loading: false, error: (error as Error).message });
    }
  },
  add: async (uid, transaction) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    try {
      const transactions = await addFinanceTransaction(uid, transaction);
      if (get().uid === uid) set({ transactions, error: null });
    } catch (error) {
      if (get().uid === uid)
        set({ error: (error as Error).message || 'Chưa lưu được giao dịch.' });
      throw error;
    }
  },
  remove: async (uid, id) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    try {
      const transactions = await deleteFinanceTransaction(uid, id);
      if (get().uid === uid) set({ transactions, error: null });
    } catch (error) {
      if (get().uid === uid)
        set({ error: (error as Error).message || 'Chưa xóa được giao dịch.' });
      throw error;
    }
  },
}));
