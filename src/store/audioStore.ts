import { create } from 'zustand';
import type { AudioTrack } from '../types/audio';

type AudioState = {
  uid: string | null;
  tracks: AudioTrack[];
  bind: (uid: string | null) => void;
  replace: (uid: string, tracks: AudioTrack[]) => void;
  upsert: (track: AudioTrack) => void;
  remove: (uid: string, id: string) => void;
};

export const useAudioStore = create<AudioState>((set) => ({
  uid: null,
  tracks: [],
  bind: (uid) => set({ uid, tracks: [] }),
  replace: (uid, tracks) =>
    set((state) => (state.uid === uid ? { tracks } : state)),
  upsert: (track) =>
    set((state) =>
      state.uid === track.ownerId
        ? {
            tracks: [
              track,
              ...state.tracks.filter((t) => t.id !== track.id),
            ].sort((a, b) => b.createdAt - a.createdAt),
          }
        : state,
    ),
  remove: (uid, id) =>
    set((state) =>
      state.uid === uid
        ? { tracks: state.tracks.filter((track) => track.id !== id) }
        : state,
    ),
}));
