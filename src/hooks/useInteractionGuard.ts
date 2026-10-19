import { useEffect, useRef } from 'react';

// A callback keeps its render's generation, so reopening cannot revive it.
export function useInteractionGuard(active: boolean, owner: string | null) {
  const current = useRef({ active, owner, generation: 0, mounted: true });
  if (current.current.active !== active || current.current.owner !== owner) {
    current.current = {
      active,
      owner,
      generation: current.current.generation + 1,
      mounted: current.current.mounted,
    };
  }
  const generation = current.current.generation;
  useEffect(() => {
    current.current.mounted = true;
    return () => {
      current.current.mounted = false;
    };
  }, []);
  return () =>
    active &&
    owner !== null &&
    current.current.mounted &&
    current.current.generation === generation;
}
