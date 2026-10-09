import { create } from 'zustand';
import { useAuthStore } from './authStore';
import {
  authenticateFinance,
  getFinanceBiometrics,
  readFinanceLock,
  writeFinanceLock,
} from '../services/security/financeLock';

type FinanceLockState = {
  uid: string | null;
  enabled: boolean | null;
  loading: boolean;
  authenticating: boolean;
  changing: boolean;
  unlocked: boolean;
  lockVersion: number;
  appActive: boolean;
  biometricLabel: string;
  canEnable: boolean;
  error: string | null;
  load: (uid: string | null) => Promise<void>;
  lock: () => void;
  setAppActive: (active: boolean) => void;
  unlock: (uid: string) => Promise<boolean>;
  revealHome: (uid: string) => Promise<boolean>;
  setEnabled: (uid: string, enabled: boolean) => Promise<void>;
};

let loadRequest = 0;
let accessEpoch = 0;

export const useFinanceLockStore = create<FinanceLockState>((set, get) => {
  const isCurrent = (uid: string) =>
    get().uid === uid && useAuthStore.getState().user?.uid === uid;

  async function authorize(uid: string, prompt: string) {
    if (
      !isCurrent(uid) ||
      get().loading ||
      get().enabled === null ||
      get().authenticating ||
      !get().appActive
    )
      return false;
    const epoch = accessEpoch;
    set({ authenticating: true, error: null });
    try {
      const result = await authenticateFinance(prompt);
      if (!isCurrent(uid) || epoch !== accessEpoch) return false;
      if (!result.success) set({ error: result.message });
      return result.success;
    } catch {
      if (isCurrent(uid)) set({ error: 'Chưa xác thực được. Hãy thử lại.' });
      return false;
    } finally {
      if (get().uid === uid) set({ authenticating: false });
    }
  }

  return {
    uid: null,
    enabled: null,
    loading: false,
    authenticating: false,
    changing: false,
    unlocked: false,
    lockVersion: 0,
    appActive: true,
    biometricLabel: 'Face ID / vân tay',
    canEnable: false,
    error: null,
    load: async (uid) => {
      const request = ++loadRequest;
      ++accessEpoch;
      set({
        uid,
        enabled: null,
        loading: !!uid,
        unlocked: false,
        lockVersion: get().lockVersion + 1,
        authenticating: false,
        changing: false,
        error: null,
        canEnable: false,
      });
      if (!uid) return;
      try {
        const [enabled, biometrics] = await Promise.all([
          readFinanceLock(uid),
          getFinanceBiometrics(),
        ]);
        if (request === loadRequest && isCurrent(uid))
          set({
            enabled,
            biometricLabel: biometrics.label,
            canEnable: biometrics.canEnable,
            loading: false,
          });
      } catch {
        if (request === loadRequest && isCurrent(uid))
          set({
            loading: false,
            error: 'Chưa đọc được thiết lập bảo mật. Hãy thử lại.',
          });
      }
    },
    lock: () => {
      ++accessEpoch;
      set((state) => ({
        unlocked: false,
        lockVersion: state.lockVersion + 1,
      }));
    },
    setAppActive: (appActive) => set({ appActive }),
    unlock: async (uid) => {
      if (!isCurrent(uid) || get().changing || get().enabled === null)
        return false;
      if (!get().enabled) return true;
      if (get().unlocked) return true;
      const epoch = accessEpoch;
      const allowed = await authorize(uid, 'Mở khóa Tài chính');
      if (allowed && isCurrent(uid) && epoch === accessEpoch) {
        set({ unlocked: true });
        return true;
      }
      return false;
    },
    revealHome: async (uid) => {
      if (!isCurrent(uid) || get().changing || get().enabled === null)
        return false;
      if (!get().enabled) return true;
      if (get().unlocked) return true;
      const epoch = accessEpoch;
      const allowed = await authorize(uid, 'Xem số tiền trên Home');
      if (allowed && isCurrent(uid) && epoch === accessEpoch) {
        set({ unlocked: true });
        return true;
      }
      return false;
    },
    setEnabled: async (uid, enabled) => {
      if (
        !isCurrent(uid) ||
        get().enabled === null ||
        get().loading ||
        get().changing ||
        get().authenticating ||
        get().enabled === enabled
      )
        return;
      if (enabled && !get().canEnable) {
        set({
          error:
            'Thiết lập Face ID hoặc vân tay trong cài đặt thiết bị để bật khóa.',
        });
        return;
      }
      const epoch = accessEpoch;
      set({ changing: true });
      try {
        if (
          !(await authorize(
            uid,
            enabled ? 'Bật khóa Tài chính' : 'Tắt khóa Tài chính',
          ))
        )
          return;
        if (!isCurrent(uid) || epoch !== accessEpoch) return;
        await writeFinanceLock(uid, enabled);
        if (isCurrent(uid)) {
          ++accessEpoch;
          // The setting prompt has already authorized this foreground session.
          set({ enabled, unlocked: enabled, error: null });
        }
      } catch {
        if (isCurrent(uid))
          set({ error: 'Chưa lưu được thiết lập khóa. Hãy thử lại.' });
      } finally {
        if (get().uid === uid) set({ changing: false });
      }
    },
  };
});
