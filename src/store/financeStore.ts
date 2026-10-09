import { create } from 'zustand';
import type { FinanceTransaction } from '../types/finance';
import { getFinanceErrorMessage } from '../utils/finance';
import {
  addFinanceTransaction,
  deleteFinanceTransaction,
  readFinanceData,
  updateFinanceTransaction,
  type FinanceStorageResult,
} from '../services/finance/financeStorage';

type FinanceState = {
  uid: string | null;
  transactions: FinanceTransaction[];
  syncStatus: 'synced' | 'local' | 'recovery' | null;
  loading: boolean;
  error: string | null;
  load: (uid: string | null) => Promise<void>;
  add: (uid: string, transaction: FinanceTransaction) => Promise<void>;
  remove: (uid: string, id: string) => Promise<void>;
  update: (uid: string, transaction: FinanceTransaction) => Promise<void>;
};

let loadRequest = 0;

function syncStatusFor(result: FinanceStorageResult) {
  if (result.cacheNeedsRecovery) return 'recovery' as const;
  return result.synced ? ('synced' as const) : ('local' as const);
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  uid: null,
  transactions: [],
  syncStatus: null,
  loading: false,
  error: null,
  load: async (uid) => {
    const request = ++loadRequest;
    const sameAccount = get().uid === uid;
    set({
      uid,
      transactions: sameAccount ? get().transactions : [],
      syncStatus: sameAccount ? get().syncStatus : null,
      loading: !!uid,
      error: null,
    });
    if (!uid) return;
    try {
      const result = await readFinanceData(uid);
      if (request === loadRequest && get().uid === uid)
        set({
          transactions: result.transactions,
          syncStatus: syncStatusFor(result),
          loading: false,
          error: null,
        });
    } catch (error) {
      if (request === loadRequest && get().uid === uid)
        set({
          loading: false,
          syncStatus: 'local',
          error: getFinanceErrorMessage(
            error,
            'Chưa tải được sổ thu chi. Hãy thử lại.',
          ),
        });
    }
  },
  add: async (uid, transaction) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    try {
      const result = await addFinanceTransaction(uid, transaction);
      if (get().uid === uid)
        set({
          transactions: result.transactions,
          syncStatus: syncStatusFor(result),
          error: null,
        });
    } catch (error) {
      const message = getFinanceErrorMessage(
        error,
        'Chưa lưu được giao dịch. Hãy thử lại.',
      );
      if (get().uid === uid) set({ error: message });
      throw new Error(message);
    }
  },
  remove: async (uid, id) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    try {
      const result = await deleteFinanceTransaction(uid, id);
      if (get().uid === uid)
        set({
          transactions: result.transactions,
          syncStatus: syncStatusFor(result),
          error: null,
        });
    } catch (error) {
      const message = getFinanceErrorMessage(
        error,
        'Chưa xóa được giao dịch. Hãy thử lại.',
      );
      if (get().uid === uid) set({ error: message });
      throw new Error(message);
    }
  },
  update: async (uid, transaction) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    try {
      const result = await updateFinanceTransaction(uid, transaction);
      if (get().uid === uid)
        set({
          transactions: result.transactions,
          syncStatus: syncStatusFor(result),
          error: null,
        });
    } catch (error) {
      const message = getFinanceErrorMessage(
        error,
        'Chưa sửa được giao dịch. Hãy thử lại.',
      );
      if (get().uid === uid) set({ error: message });
      throw new Error(message);
    }
  },
}));
