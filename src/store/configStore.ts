import { create } from 'zustand';
import { DEFAULT_USERS } from '../config/defaults';
import type { DirectoryUser } from '../types/models';
import { loadRemoteUsers } from '../services/firebase/remoteConfigService';

type ConfigState = {
  users: DirectoryUser[];
  loading: boolean;
  warning: string | null;
  refresh: () => Promise<void>;
};

export const useConfigStore = create<ConfigState>((set, get) => ({
  users: DEFAULT_USERS,
  loading: false,
  warning: null,
  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      set(await loadRemoteUsers(get().users));
    } catch {
      set({ warning: 'Chưa thể cập nhật. Đang dùng thông tin đã lưu.' });
    } finally {
      set({ loading: false });
    }
  },
}));
