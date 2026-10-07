import { create } from 'zustand';
import type { SessionUser } from '../types/models';

type AuthState = {
  user: SessionUser | null;
  initializing: boolean;
  setUser: (user: SessionUser | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initializing: true,
  setUser: (user) => set({ user, initializing: false }),
}));
