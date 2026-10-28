import { useEffect } from 'react';
import { callPixelPet } from '../services/pixelPet/pixelPetApi';
import type { PixelPetState } from '../types/pixelPet';

/** Lightweight ownership reads only while visible; no finance scan or animation. */
export function usePixelPetRefresh(
  uid: string | null | undefined,
  enabled: boolean,
  onState?: (state: PixelPetState) => void,
  immediate = true,
) {
  useEffect(() => {
    if (!uid || !enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const state = await callPixelPet(uid, { type: 'state' });
        if (!stopped) onState?.(state);
      } catch {
        /* Offline keeps the last known pet; the next read retries. */
      } finally {
        if (!stopped) timer = setTimeout(() => void read(), 30000);
      }
    };
    if (immediate) void read();
    else timer = setTimeout(() => void read(), 30000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [uid, enabled, onState, immediate]);
}
