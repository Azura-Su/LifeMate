import { create } from 'zustand';
import { useAuthStore } from './authStore';
import type { AgendaItem } from '../types/agenda';
import {
  cancelAgendaReminder,
  cancelAllAgendaReminders,
  reconcileAgendaReminders,
  scheduleAgendaReminder,
} from '../services/agenda/agendaReminders';
import {
  deleteAgendaItem,
  readAgenda,
  saveAgendaItem,
} from '../services/agenda/agendaStorage';

type AgendaState = {
  uid: string | null;
  items: AgendaItem[];
  synced: boolean;
  loading: boolean;
  error: string | null;
  reminderStatus: 'scheduled' | 'denied' | 'past' | null;
  load: (uid: string | null) => Promise<void>;
  save: (
    uid: string,
    item: AgendaItem,
    expected: AgendaItem | null,
  ) => Promise<AgendaState['reminderStatus']>;
  complete: (uid: string, id: string, completed: boolean) => Promise<void>;
  remove: (uid: string, id: string) => Promise<void>;
};

let request = 0;

function isActiveAccount(uid: string, epoch: number) {
  const auth = useAuthStore.getState();
  return auth.user?.uid === uid && auth.sessionEpoch === epoch;
}

export const useAgendaStore = create<AgendaState>((set, get) => ({
  uid: null,
  items: [],
  synced: false,
  loading: false,
  error: null,
  reminderStatus: null,
  load: async (uid) => {
    const epoch = useAuthStore.getState().sessionEpoch;
    const previousUid = get().uid;
    if (previousUid && previousUid !== uid)
      void cancelAllAgendaReminders(previousUid);
    const mine = ++request;
    set({
      uid,
      items: uid && get().uid === uid ? get().items : [],
      synced: false,
      loading: !!uid,
      error: null,
      reminderStatus: null,
    });
    if (!uid) return;
    try {
      const result = await readAgenda(uid);
      if (
        mine === request &&
        get().uid === uid &&
        isActiveAccount(uid, epoch)
      ) {
        set({
          items: result.items,
          synced: result.synced,
          loading: false,
          error: null,
        });
        if (result.synced)
          void reconcileAgendaReminders(uid, result.items).catch(
            () => undefined,
          );
      }
    } catch {
      if (mine === request && get().uid === uid && isActiveAccount(uid, epoch))
        set({
          loading: false,
          error: 'Chưa tải được danh sách việc. Hãy thử lại.',
        });
    }
  },
  save: async (uid, item, expected) => {
    const epoch = useAuthStore.getState().sessionEpoch;
    if (get().uid !== uid || !isActiveAccount(uid, epoch))
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    const result = await saveAgendaItem(uid, item, expected);
    let reminderStatus: AgendaState['reminderStatus'] = null;
    if (get().uid !== uid || !isActiveAccount(uid, epoch)) return null;
    // A sync conflict can replace this id with the remote version and move the
    // local edit to a conflict copy, so schedule from what was actually saved.
    const saved = result.items.find((current) => current.id === item.id);
    if (saved && !saved.completed && saved.reminderAt !== null) {
      try {
        reminderStatus = await scheduleAgendaReminder(
          uid,
          saved.id,
          saved.reminderAt,
        );
      } catch {
        reminderStatus = 'denied';
      }
    } else await cancelAgendaReminder(uid, item.id);
    if (get().uid !== uid || !isActiveAccount(uid, epoch)) return null;
    if (saved !== item)
      void reconcileAgendaReminders(uid, result.items).catch(() => undefined);
    if (get().uid === uid && isActiveAccount(uid, epoch))
      set({
        items: result.items,
        synced: result.synced,
        reminderStatus,
        error: null,
      });
    return reminderStatus;
  },
  complete: async (uid, id, completed) => {
    const epoch = useAuthStore.getState().sessionEpoch;
    if (get().uid !== uid || !isActiveAccount(uid, epoch))
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    const current = get().items.find((item) => item.id === id);
    if (!current) return;
    const item = { ...current, completed, updatedAt: Date.now() };
    const result = await saveAgendaItem(uid, item, current);
    if (get().uid !== uid || !isActiveAccount(uid, epoch)) return;
    // Sync may retain the remote row and move this edit to a conflict copy.
    await reconcileAgendaReminders(uid, result.items).catch(() => undefined);
    if (get().uid === uid && isActiveAccount(uid, epoch))
      set({ items: result.items, synced: result.synced, error: null });
  },
  remove: async (uid, id) => {
    const epoch = useAuthStore.getState().sessionEpoch;
    if (get().uid !== uid || !isActiveAccount(uid, epoch))
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    const result = await deleteAgendaItem(uid, id);
    if (get().uid !== uid || !isActiveAccount(uid, epoch)) return;
    await cancelAgendaReminder(uid, id);
    if (get().uid === uid && isActiveAccount(uid, epoch))
      set({ items: result.items, synced: result.synced, error: null });
  },
}));
