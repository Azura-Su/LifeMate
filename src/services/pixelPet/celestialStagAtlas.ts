import type { PixelPetAnyClipId } from '../../types/pixelPet';

export const CELESTIAL_STAG_ATLAS_LAYOUT = { columns: 8, rows: 8 } as const;
export const CELESTIAL_STAG_MOVEMENT_LAYOUT = { columns: 4, rows: 4 } as const;
export const CELESTIAL_STAG_TAKEOFF_LAYOUT = {
  columns: 4,
  rows: 4,
} as const;
export const CELESTIAL_STAG_LANDING_LAYOUT = {
  columns: 4,
  rows: 4,
} as const;
export const CELESTIAL_STAG_FLAP_CYCLE_MS = 720;
/** One shared clock for the Home path and its authored pose transitions. */
export const CELESTIAL_STAG_HOME_PHASE_DURATION = {
  runA: 3400,
  walkToFlight: 1500,
  takeoff: 1400,
  flap: CELESTIAL_STAG_FLAP_CYCLE_MS * 4,
  glide: 3300,
  landing: 1400,
  walkAfterLanding: 1400,
  runB: 2300,
  settle: 2420,
  sleep: Number.POSITIVE_INFINITY,
} as const;
export type CelestialStagHomePhase =
  keyof typeof CELESTIAL_STAG_HOME_PHASE_DURATION;
/** Eight walk beats use six Gemini-authored leg poses, with held contacts. */
export const CELESTIAL_STAG_MOVEMENT_FRAMES = [
  0, 1, 2, 3, 4, 5, 4, 1,
] as const;
export type CelestialStagFlightPhase = 'takeoff' | 'flap' | 'glide' | 'landing';
export function celestialStagFlightPlayback(
  phase: CelestialStagFlightPhase | undefined,
  clip: PixelPetAnyClipId,
) {
  if (phase === 'takeoff' || phase === 'landing' || phase === 'glide')
    return {
      durationMs: CELESTIAL_STAG_HOME_PHASE_DURATION[phase],
      loop: false,
    };
  return {
    durationMs:
      phase !== 'flap' && clip === 'fly' ? 900 : CELESTIAL_STAG_FLAP_CYCLE_MS,
    loop: true,
  };
}
/** High wing support, downstroke, and recovery; terminal pose closes the loop. */
export const CELESTIAL_STAG_FLAP_FRAMES = [
  3, 2, 1, 0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
] as const;
/** Grounded crouch, push-off, and lift into the airborne wingbeat. */
export const CELESTIAL_STAG_TAKEOFF_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
/** Descent, hoof contact, wing fold, and a stable grounded run pose. */
export const CELESTIAL_STAG_LANDING_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
/** Full-body transition from standing to the curled sleeping pose. */
export const CELESTIAL_STAG_SLEEP_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
/** Empty opening frame followed by 15 meadow, flower, and tree growth poses. */
export const CELESTIAL_STAG_SLEEP_GARDEN_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_GARDEN_GROWTH_MS = 3800;
export const CELESTIAL_STAG_GARDEN_WITHER_MS = 4800;
export const CELESTIAL_STAG_GARDEN_EARLY_WITHER_MS = 1200;
export const CELESTIAL_STAG_GARDEN_WITHER_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_GARDEN_DUST_FRAMES = [12, 13, 14, 15] as const;

export function celestialStagGardenFrameAt(elapsedMs: number) {
  return Math.round(
    Math.max(0, Math.min(1, elapsedMs / CELESTIAL_STAG_GARDEN_GROWTH_MS)) * 15,
  );
}
/** Settle the raised wings, then flex gently at pose cadence until landing. */
export const CELESTIAL_STAG_GLIDE_FRAMES = [
  3,
  2,
  1,
  0,
  4,
  5,
  6,
  7,
  ...Array.from({ length: 9 }, () => [6, 5, 6, 7]).flat(),
] as const;

const row = (index: number) =>
  Array.from(
    { length: CELESTIAL_STAG_ATLAS_LAYOUT.columns },
    (_, frame) => index * CELESTIAL_STAG_ATLAS_LAYOUT.columns + frame,
  );

/** Sixteen full-body poses per expression, each spanning two atlas rows. */
export const CELESTIAL_STAG_FRAME_TRACKS: Record<
  PixelPetAnyClipId,
  readonly number[]
> = {
  idle: [...row(0), ...row(1)],
  eat: [...row(0), ...row(1)],
  move: [...row(2), ...row(3)],
  heal: [...row(4), ...row(5)],
  happy: [...row(4), ...row(5)],
  skill: [...row(6), ...row(7)],
  fly: [...row(2), ...row(3)],
  flap: [...row(2), ...row(3)],
  prance: [...row(4), ...row(5)],
  bow: [...row(6), ...row(7)],
  glow: [...row(6), ...row(7)],
  blaze: [...row(6), ...row(7)],
  spin: [...row(4), ...row(5)],
};
