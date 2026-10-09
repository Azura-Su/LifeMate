import { create } from 'zustand';
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
  ) => Promise<AgendaState['reminderStatus']>;
  complete: (uid: string, id: string, completed: boolean) => Promise<void>;
  remove: (uid: string, id: string) => Promise<void>;
};

let request = 0;
export const useAgendaStore = create<AgendaState>((set, get) => ({
  uid: null,
  items: [],
  synced: false,
  loading: false,
  error: null,
  reminderStatus: null,
  load: async (uid) => {
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
      if (mine === request && get().uid === uid) {
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
      if (mine === request && get().uid === uid)
        set({
          loading: false,
          error: 'Chưa tải được danh sách việc. Hãy thử lại.',
        });
    }
  },
  save: async (uid, item) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    const result = await saveAgendaItem(uid, item);
    let reminderStatus: AgendaState['reminderStatus'] = null;
    if (!item.completed && item.reminderAt !== null) {
      try {
        reminderStatus = await scheduleAgendaReminder(
          uid,
          item.id,
          item.reminderAt,
        );
      } catch {
        reminderStatus = 'denied';
      }
    } else await cancelAgendaReminder(uid, item.id);
    if (get().uid === uid)
      set({
        items: result.items,
        synced: result.synced,
        reminderStatus,
        error: null,
      });
    return reminderStatus;
  },
  complete: async (uid, id, completed) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    const current = get().items.find((item) => item.id === id);
    if (!current) return;
    const item = { ...current, completed, updatedAt: Date.now() };
    const result = await saveAgendaItem(uid, item);
    if (completed) await cancelAgendaReminder(uid, id);
    else if (item.reminderAt !== null)
      await scheduleAgendaReminder(uid, id, item.reminderAt, false).catch(
        () => undefined,
      );
    if (get().uid === uid)
      set({ items: result.items, synced: result.synced, error: null });
  },
  remove: async (uid, id) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    const result = await deleteAgendaItem(uid, id);
    await cancelAgendaReminder(uid, id);
    if (get().uid === uid)
      set({ items: result.items, synced: result.synced, error: null });
  },
}));
