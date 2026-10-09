import { create } from 'zustand';

type QueuePlaybackState = {
  currentId: string | null;
  playing: boolean;
  // Whether the MP3 screen is on screen; decorative animations pause otherwise.
  visible: boolean;
  setCurrentId: (currentId: string | null) => void;
  setPlaying: (playing: boolean) => void;
  setVisible: (visible: boolean) => void;
};

export const useQueuePlaybackStore = create<QueuePlaybackState>((set) => ({
  currentId: null,
  playing: false,
  visible: true,
  setCurrentId: (currentId) => set({ currentId }),
  setPlaying: (playing) =>
    set((state) => (state.playing === playing ? state : { playing })),
  setVisible: (visible) =>
    set((state) => (state.visible === visible ? state : { visible })),
}));
