import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAgendaStore } from '../store/agendaStore';

export function useAgendaAccount() {
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  const storeUid = useAgendaStore((state) => state.uid);
  const items = useAgendaStore((state) => state.items);
  const synced = useAgendaStore((state) => state.synced);
  const loading = useAgendaStore((state) => state.loading);
  const error = useAgendaStore((state) => state.error);
  const reminderStatus = useAgendaStore((state) => state.reminderStatus);
  const load = useAgendaStore((state) => state.load);
  const save = useAgendaStore((state) => state.save);
  const complete = useAgendaStore((state) => state.complete);
  const remove = useAgendaStore((state) => state.remove);
  const matches = !!uid && storeUid === uid;
  useEffect(() => {
    if (useAgendaStore.getState().uid !== uid) void load(uid);
  }, [load, storeUid, uid]);
  return {
    uid,
    items: matches ? items : [],
    synced: matches ? synced : false,
    loading: !!uid && (!matches || loading),
    error: matches ? error : null,
    reminderStatus: matches ? reminderStatus : null,
    save,
    complete,
    remove,
    refresh: () => load(uid),
  };
}
