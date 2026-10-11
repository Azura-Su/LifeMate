import { create } from 'zustand';
import { AppState } from 'react-native';
import { useAuthStore } from './authStore';
import { authenticateDevice } from '../services/security/deviceAuthentication';

type NotesLockState = {
  uid: string | null;
  unlocked: boolean;
  authenticating: boolean;
  error: string | null;
  setUser: (uid: string | null) => void;
  lock: () => void;
  unlock: (uid: string) => Promise<boolean>;
};

let accessEpoch = 0;

function isAppBackgrounded() {
  return AppState.currentState === 'background';
}

export const useNotesLockStore = create<NotesLockState>((set, get) => ({
  uid: null,
  unlocked: false,
  authenticating: false,
  error: null,
  setUser: (uid) => {
    if (get().uid === uid) return;
    ++accessEpoch;
    set({ uid, unlocked: false, authenticating: false, error: null });
  },
  lock: () => {
    ++accessEpoch;
    set({ unlocked: false, authenticating: false, error: null });
  },
  unlock: async (uid) => {
    if (
      !uid ||
      get().uid !== uid ||
      useAuthStore.getState().user?.uid !== uid ||
      AppState.currentState !== 'active' ||
      get().authenticating
    )
      return false;
    if (get().unlocked) return true;

    const epoch = accessEpoch;
    set({ authenticating: true, error: null });
    try {
      const result = await authenticateDevice('Mở Ghi chú');
      if (
        epoch !== accessEpoch ||
        get().uid !== uid ||
        useAuthStore.getState().user?.uid !== uid ||
        isAppBackgrounded()
      )
        return false;
      if (result.success) set({ unlocked: true });
      else set({ error: result.message });
      return result.success;
    } catch {
      if (epoch === accessEpoch && get().uid === uid)
        set({ error: 'Chưa xác thực được. Hãy thử lại.' });
      return false;
    } finally {
      if (epoch === accessEpoch && get().uid === uid)
        set({ authenticating: false });
    }
  },
}));
