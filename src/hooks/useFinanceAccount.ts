import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useFinanceStore } from '../store/financeStore';
import type { FinanceTransaction } from '../types/finance';

const emptyTransactions: FinanceTransaction[] = [];

export function useFinanceAccount() {
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  const storeUid = useFinanceStore((state) => state.uid);
  const transactions = useFinanceStore((state) => state.transactions);
  const syncStatus = useFinanceStore((state) => state.syncStatus);
  const loading = useFinanceStore((state) => state.loading);
  const error = useFinanceStore((state) => state.error);
  const load = useFinanceStore((state) => state.load);
  const matchesAccount = !!uid && storeUid === uid;

  useEffect(() => {
    if (useFinanceStore.getState().uid !== uid) void load(uid);
  }, [load, storeUid, uid]);

  return {
    uid,
    transactions: matchesAccount ? transactions : emptyTransactions,
    syncStatus: matchesAccount ? syncStatus : null,
    loading: !!uid && (!matchesAccount || loading),
    error: matchesAccount ? error : null,
    refresh: () => load(uid),
  };
}
