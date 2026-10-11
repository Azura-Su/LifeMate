import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNotesLockStore } from '../store/notesLockStore';

export function useNotesPrivacy() {
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  const state = useNotesLockStore();
  const storeUid = state.uid;
  useEffect(() => {
    if (useNotesLockStore.getState().uid !== uid)
      useNotesLockStore.getState().setUser(uid);
  }, [uid, storeUid]);

  const matches = !!uid && state.uid === uid;
  return {
    uid,
    unlocked: matches && state.unlocked,
    authenticating: matches && state.authenticating,
    error: matches ? state.error : null,
    unlock: state.unlock,
    lock: state.lock,
  };
}
