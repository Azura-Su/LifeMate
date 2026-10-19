import { create } from 'zustand';
import type { FinanceTransaction } from '../types/finance';
import { getFinanceErrorMessage } from '../utils/finance';
import {
  addFinanceTransaction,
  cacheCommittedFinanceTransaction,
  deleteFinanceTransaction,
  readFinanceData,
  resolveFinanceConflict,
  updateFinanceTransaction,
  type FinanceConflict,
  type FinanceStorageResult,
} from '../services/finance/financeStorage';

type FinanceState = {
  uid: string | null;
  transactions: FinanceTransaction[];
  conflicts: FinanceConflict[];
  syncStatus: 'synced' | 'local' | 'recovery' | null;
  loading: boolean;
  error: string | null;
  load: (uid: string | null) => Promise<void>;
  add: (uid: string, transaction: FinanceTransaction) => Promise<void>;
  addCommitted: (uid: string, transaction: FinanceTransaction) => Promise<void>;
  remove: (uid: string, id: string) => Promise<void>;
  update: (
    uid: string,
    transaction: FinanceTransaction,
    expected: FinanceTransaction,
  ) => Promise<void>;
  resolveConflict: (
    uid: string,
    conflict: FinanceConflict,
    choice: 'local' | 'server',
  ) => Promise<void>;
};

let loadRequest = 0;

function syncStatusFor(result: FinanceStorageResult) {
  if (result.cacheNeedsRecovery) return 'recovery' as const;
  return result.synced ? ('synced' as const) : ('local' as const);
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  uid: null,
  transactions: [],
  conflicts: [],
  syncStatus: null,
  loading: false,
  error: null,
  load: async (uid) => {
    const request = ++loadRequest;
    const sameAccount = get().uid === uid;
    set({
      uid,
      transactions: sameAccount ? get().transactions : [],
      conflicts: sameAccount ? get().conflicts : [],
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
          conflicts: result.conflicts ?? [],
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
  addCommitted: async (uid, transaction) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    try {
      const result = await cacheCommittedFinanceTransaction(uid, transaction);
      if (get().uid === uid)
        set({
          transactions: result.transactions,
          syncStatus: syncStatusFor(result),
          error: null,
        });
    } catch (error) {
      const message = getFinanceErrorMessage(
        error,
        'Đã ghi nhận giao dịch; chưa cập nhật được danh sách Tài chính trên thiết bị.',
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
  update: async (uid, transaction, expected) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    try {
      const result = await updateFinanceTransaction(uid, transaction, expected);
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
  resolveConflict: async (uid, conflict, choice) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    try {
      const result = await resolveFinanceConflict(uid, conflict, choice);
      if (get().uid === uid)
        set({
          transactions: result.transactions,
          conflicts: result.conflicts ?? [],
          syncStatus: syncStatusFor(result),
          error: null,
        });
    } catch (error) {
      const message = getFinanceErrorMessage(
        error,
        'Chưa xử lý được xung đột.',
      );
      if (get().uid === uid) set({ error: message });
      throw new Error(message);
    }
  },
}));
