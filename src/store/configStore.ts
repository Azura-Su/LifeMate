import { create } from 'zustand';
import { DEFAULT_USERS } from '../config/defaults';
import type { DirectoryUser } from '../types/models';
import {
  loadRemoteConfig,
  readActivatedRemoteConfig,
} from '../services/firebase/remoteConfigService';

type ConfigState = {
  users: DirectoryUser[];
  registrationEnabled: boolean;
  loading: boolean;
  warning: string | null;
  refresh: () => Promise<void>;
  applyActivated: () => void;
};

let activeRevision = 0;

export const useConfigStore = create<ConfigState>((set, get) => ({
  users: DEFAULT_USERS,
  registrationEnabled: false,
  loading: false,
  warning: null,
  applyActivated: () => {
    activeRevision += 1;
    set((state) => ({
      ...readActivatedRemoteConfig(state.users),
    }));
  },
  refresh: async () => {
    if (get().loading) return;
    const revision = activeRevision;
    set({ loading: true });
    try {
      const result = await loadRemoteConfig(get().users);
      set(
        activeRevision === revision
          ? result
          : {
              ...readActivatedRemoteConfig(get().users),
              warning: result.warning,
            },
      );
    } catch {
      set({ warning: 'Chưa thể cập nhật. Đang dùng thông tin đã lưu.' });
    } finally {
      set({ loading: false });
    }
  },
}));
