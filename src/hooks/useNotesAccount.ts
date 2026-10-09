import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNoteStore } from '../store/noteStore';

export function useNotesAccount() {
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  const storeUid = useNoteStore((state) => state.uid);
  const notes = useNoteStore((state) => state.notes);
  const synced = useNoteStore((state) => state.synced);
  const loading = useNoteStore((state) => state.loading);
  const error = useNoteStore((state) => state.error);
  const load = useNoteStore((state) => state.load);
  const save = useNoteStore((state) => state.save);
  const remove = useNoteStore((state) => state.remove);
  const matches = !!uid && storeUid === uid;
  useEffect(() => {
    if (useNoteStore.getState().uid !== uid) void load(uid);
  }, [load, storeUid, uid]);
  return {
    uid,
    notes: matches ? notes : [],
    synced: matches ? synced : false,
    loading: !!uid && (!matches || loading),
    error: matches ? error : null,
    save,
    remove,
    refresh: () => load(uid),
  };
}
