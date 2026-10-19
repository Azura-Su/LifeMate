import { create } from 'zustand';
import { readAvatar } from '../services/profile/avatarService';
import { useAuthStore } from './authStore';
type State = {
  uid: string | null;
  avatarUrl: string | null;
  revision: number;
  loading: boolean;
  error: string | null;
  expiresAt: number;
  load: (uid: string, force?: boolean) => Promise<void>;
  accept: (uid: string, url: string | null) => void;
  reset: () => void;
};
let generation = 0;
let pending: { uid: string; task: Promise<void> } | null = null;
export const useProfileStore = create<State>((set, get) => ({
  uid: null,
  avatarUrl: null,
  revision: 0,
  loading: false,
  error: null,
  expiresAt: 0,
  reset: () => {
    generation++;
    pending = null;
    set({
      uid: null,
      avatarUrl: null,
      loading: false,
      error: null,
      expiresAt: 0,
    });
  },
  accept: (uid, avatarUrl) => {
    if (useAuthStore.getState().user?.uid !== uid) return;
    generation++;
    pending = null;
    set((state) => ({
      uid,
      avatarUrl,
      revision: state.revision + 1,
      loading: false,
      error: null,
      expiresAt: Date.now() + 540000,
    }));
  },
  load: async (uid, force = false) => {
    if (useAuthStore.getState().user?.uid !== uid) return;
    if (pending?.uid === uid) return pending.task;
    if (get().uid === uid && !force && get().expiresAt > Date.now()) return;
    const mine = ++generation;
    set({
      uid,
      loading: true,
      error: null,
      ...(get().uid !== uid ? { avatarUrl: null, expiresAt: 0 } : {}),
    });
    const task = (async () => {
      try {
        const url = await readAvatar(uid);
        if (mine === generation && useAuthStore.getState().user?.uid === uid)
          set((state) => ({
            avatarUrl: url,
            loading: false,
            revision: state.revision + 1,
            expiresAt: Date.now() + 540000,
          }));
      } catch {
        if (mine === generation && useAuthStore.getState().user?.uid === uid)
          set({
            loading: false,
            error: 'Chưa tải được ảnh đại diện. Hãy thử lại.',
          });
      } finally {
        if (mine === generation) pending = null;
      }
    })();
    pending = { uid, task };
    return task;
  },
}));
