import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useFinanceLockStore } from '../store/financeLockStore';

export function useFinancePrivacy() {
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  const state = useFinanceLockStore();
  const { load, uid: storeUid } = state;
  const matches = !!uid && state.uid === uid;
  useEffect(() => {
    if (useFinanceLockStore.getState().uid !== uid) void load(uid);
  }, [uid, storeUid, load]);
  return {
    ...state,
    uid,
    enabled: matches ? state.enabled : null,
    unlocked: matches && state.unlocked,
    loading: !!uid && (!matches || state.loading),
    error: matches ? state.error : null,
    ready: matches && state.enabled !== null && !state.loading,
  };
}
