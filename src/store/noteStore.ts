import { create } from 'zustand';
import type { LifeNote } from '../types/note';
import { deleteNote, readNotes, saveNote } from '../services/notes/noteStorage';

type NoteState = {
  uid: string | null;
  notes: LifeNote[];
  synced: boolean;
  loading: boolean;
  error: string | null;
  load: (uid: string | null) => Promise<void>;
  save: (uid: string, note: LifeNote) => Promise<void>;
  remove: (uid: string, id: string) => Promise<void>;
};

let request = 0;
export const useNoteStore = create<NoteState>((set, get) => ({
  uid: null,
  notes: [],
  synced: false,
  loading: false,
  error: null,
  load: async (uid) => {
    const mine = ++request;
    set({
      uid,
      notes: uid && get().uid === uid ? get().notes : [],
      synced: false,
      loading: !!uid,
      error: null,
    });
    if (!uid) return;
    try {
      const result = await readNotes(uid);
      if (request === mine && get().uid === uid)
        set({
          notes: result.notes,
          synced: result.synced,
          loading: false,
          error: null,
        });
    } catch {
      if (request === mine && get().uid === uid)
        set({ loading: false, error: 'Chưa tải được ghi chú. Hãy thử lại.' });
    }
  },
  save: async (uid, note) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    const result = await saveNote(uid, note);
    if (get().uid === uid)
      set({ notes: result.notes, synced: result.synced, error: null });
  },
  remove: async (uid, id) => {
    if (get().uid !== uid)
      throw new Error('Tài khoản đã thay đổi. Hãy thử lại.');
    const result = await deleteNote(uid, id);
    if (get().uid === uid)
      set({ notes: result.notes, synced: result.synced, error: null });
  },
}));
