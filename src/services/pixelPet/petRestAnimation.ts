export const PET_REST_DURATION_MS = 1600;
export const PET_WAKE_DURATION_MS = 1450;
export const PET_REST_FRAMES = Array.from({ length: 16 }, (_, frame) => frame);
export const PET_WAKE_FRAMES = [...PET_REST_FRAMES].reverse();

export type PetRestPhase = 'awake' | 'sleeping' | 'waking';

export function petRestPlayback(phase: PetRestPhase) {
  if (phase === 'awake') return undefined;
  return {
    durationMs:
      phase === 'sleeping' ? PET_REST_DURATION_MS : PET_WAKE_DURATION_MS,
    loop: false,
  };
}
