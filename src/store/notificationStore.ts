import { create } from 'zustand';
import type { AppNotification, PushPermission } from '../types/models';

type NotificationState = {
  permission: PushPermission;
  token: string | null;
  error: string | null;
  lastMessage: AppNotification | null;
  reset: () => void;
};
const initial = {
  permission: 'unknown' as const,
  token: null,
  error: null,
  lastMessage: null,
};
export const useNotificationStore = create<NotificationState>((set) => ({
  ...initial,
  reset: () => set(initial),
}));
