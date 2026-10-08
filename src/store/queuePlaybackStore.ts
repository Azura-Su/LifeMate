import { create } from 'zustand';

type QueuePlaybackState = {
  currentId: string | null;
  playing: boolean;
  setCurrentId: (currentId: string | null) => void;
  setPlaying: (playing: boolean) => void;
};

export const useQueuePlaybackStore = create<QueuePlaybackState>((set) => ({
  currentId: null,
  playing: false,
  setCurrentId: (currentId) => set({ currentId }),
  setPlaying: (playing) =>
    set((state) => (state.playing === playing ? state : { playing })),
}));
