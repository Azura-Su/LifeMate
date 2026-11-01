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
export const CELESTIAL_STAG_LV34_HOME_PHASE_DURATION = {
  ...CELESTIAL_STAG_HOME_PHASE_DURATION,
  runA: 4410,
  flap: CELESTIAL_STAG_FLAP_CYCLE_MS * 3,
  glide: 2000,
  runB: 3310,
} as const;
/**
 * Displayed standing height (px of a 320px cell) for each two-level art set,
 * rising with level, and the median walk-pose height actually drawn in that
 * set's atlas.
 */
const CELESTIAL_STAG_LEVEL_SIZE: readonly {
  maxLevel: number;
  height: number;
  artHeight: number;
}[] = [
  { maxLevel: 2, height: 140, artHeight: 193 },
  { maxLevel: 4, height: 165, artHeight: 224 },
  { maxLevel: 6, height: 185, artHeight: 176 },
  { maxLevel: 8, height: 198, artHeight: 195 },
  { maxLevel: 10, height: 208, artHeight: 224 },
  { maxLevel: 12, height: 214, artHeight: 228 },
  { maxLevel: 14, height: 218, artHeight: 212 },
  { maxLevel: 16, height: 221, artHeight: 211 },
  { maxLevel: 18, height: 224, artHeight: 222 },
  { maxLevel: Number.POSITIVE_INFINITY, height: 226, artHeight: 223 },
];

/** Displayed standing height for a level, or undefined when it is unknown. */
export function celestialStagLevelHeight(level?: number): number | undefined {
  if (level === undefined) return undefined;
  return CELESTIAL_STAG_LEVEL_SIZE.find((size) => level <= size.maxLevel)!.height;
}

/**
 * Render scale that draws the level's art at its standard height on every
 * screen (Home, dragging, details), replacing the coarser stage look scale.
 */
export function celestialStagLevelLookScale(level?: number): number | undefined {
  if (level === undefined) return undefined;
  const size = CELESTIAL_STAG_LEVEL_SIZE.find((entry) => level <= entry.maxLevel)!;
  return size.height / size.artHeight;
}
export const CELESTIAL_STAG_LV12_HOP_DURATION_MS = 1600;
export const CELESTIAL_STAG_LV12_SLEEP_DURATION_MS = 2000;
export const CELESTIAL_STAG_LV12_RUN_B_DURATION_MS = 2880;
export const CELESTIAL_STAG_LV12_WALK_FRAMES = Array.from(
  { length: 8 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_LV12_RUN_FRAMES = [...CELESTIAL_STAG_LV12_WALK_FRAMES];
export const CELESTIAL_STAG_LV12_HOP_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
/** Twelve authored frames lower the stag to the ground before sleep. */
export const CELESTIAL_STAG_LV12_SETTLE_FRAMES = Array.from(
  { length: 12 },
  (_, frame) => frame,
);
/** Four frames form the gentle breathing loop at the end of the sleep atlas. */
export const CELESTIAL_STAG_LV12_SLEEP_FRAMES = [12, 13, 14, 15] as const;

const CELESTIAL_STAG_HOME_NEXT_PHASE: Record<
  CelestialStagHomePhase,
  CelestialStagHomePhase
> = {
  runA: 'walkToFlight',
  walkToFlight: 'takeoff',
  takeoff: 'flap',
  flap: 'glide',
  glide: 'landing',
  landing: 'walkAfterLanding',
  walkAfterLanding: 'runB',
  runB: 'settle',
  settle: 'sleep',
  sleep: 'sleep',
};

export function celestialStagHomePhaseDuration(
  phase: CelestialStagHomePhase,
  level = Number.POSITIVE_INFINITY,
): number {
  if (level <= 2 && phase === 'takeoff')
    return CELESTIAL_STAG_LV12_HOP_DURATION_MS;
  if (level <= 2 && phase === 'runB')
    return CELESTIAL_STAG_LV12_RUN_B_DURATION_MS;
  return (level >= 3 && level <= 4
    ? CELESTIAL_STAG_LV34_HOME_PHASE_DURATION
    : CELESTIAL_STAG_HOME_PHASE_DURATION)[phase];
}

export function celestialStagNextHomePhase(
  phase: CelestialStagHomePhase,
  level = Number.POSITIVE_INFINITY,
): CelestialStagHomePhase {
  if (level <= 2 && phase === 'takeoff') return 'walkAfterLanding';
  return CELESTIAL_STAG_HOME_NEXT_PHASE[phase];
}
/** A gallop stride covers this much more ground than a walk stride. */
export const CELESTIAL_STAG_RUN_STRIDE_RATIO = 1.3;

/**
 * Gait strides drawn in one loop of the level's ground frame track. Lv1–2 and
 * the legacy ground atlas (no level) draw one stride in eight frames; every
 * other level repeats its eight authored poses across 16 frames.
 */
export function celestialStagStridesPerGaitLoop(level?: number): number {
  return level === undefined || level <= 2 ? 1 : 2;
}

/** Ground covered by one loop of the gait frames, so hooves never slide. */
export function celestialStagGaitLoopDistance(
  walkStride: number,
  pace: 'walk' | 'run',
  level?: number,
): number {
  return (
    walkStride *
    (pace === 'run' ? CELESTIAL_STAG_RUN_STRIDE_RATIO : 1) *
    celestialStagStridesPerGaitLoop(level)
  );
}

/**
 * Travel time for a ground leg. A short leg that would crawl below 3/4 of the
 * walk speed is walked at that speed instead; the Stag then stands until the
 * phase ends.
 */
export function celestialStagGroundTravelMs(
  distance: number,
  phaseMs: number,
  walkSpeed: number,
): number {
  return distance > 1 && (distance / phaseMs) * 1000 < walkSpeed * 0.75
    ? (distance / walkSpeed) * 1000
    : phaseMs;
}

/** Every level has authored lie-down frames that play in place. */
export function celestialStagLiesDownInPlace(level?: number): boolean {
  return level !== undefined;
}
/** Eight walk beats use six Gemini-authored leg poses, with held contacts. */
export const CELESTIAL_STAG_MOVEMENT_FRAMES = [
  0, 1, 2, 3, 4, 5, 4, 1,
] as const;
export type CelestialStagFlightPhase = 'takeoff' | 'flap' | 'glide' | 'landing';
export function celestialStagFlightPlayback(
  phase: CelestialStagFlightPhase | undefined,
  clip: PixelPetAnyClipId,
  level?: number,
) {
  if (phase === 'takeoff' || phase === 'landing' || phase === 'glide')
    return {
      durationMs: celestialStagHomePhaseDuration(phase, level),
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
export const CELESTIAL_STAG_LV34_WALK_FRAMES = Array.from({ length: 16 }, (_, frame) => frame);
export const CELESTIAL_STAG_LV34_RUN_FRAMES = Array.from({ length: 16 }, (_, frame) => frame);
export const CELESTIAL_STAG_LV34_TAKEOFF_FRAMES = [0, 1, 2, 3] as const;
export const CELESTIAL_STAG_LV34_FLAP_FRAMES = [4, 5, 6, 7] as const;
export const CELESTIAL_STAG_LV34_GLIDE_FRAMES = [8, 9, 10, 11] as const;
export const CELESTIAL_STAG_LV34_LANDING_FRAMES = [12, 13, 14, 15] as const;
export const CELESTIAL_STAG_LV34_SETTLE_FRAMES = Array.from({ length: 12 }, (_, frame) => frame);
export const CELESTIAL_STAG_LV34_SLEEP_FRAMES = [12, 13, 14, 15] as const;
/** Level 13–14 walk atlas, also played faster for the run pace. */
export const CELESTIAL_STAG_LV1314_WALK_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_LV1314_TAKEOFF_FRAMES = [0, 1, 2, 3] as const;
export const CELESTIAL_STAG_LV1314_FLAP_FRAMES = [4, 5, 6, 7] as const;
export const CELESTIAL_STAG_LV1314_GLIDE_FRAMES = [8, 9, 10, 11] as const;
export const CELESTIAL_STAG_LV1314_LANDING_FRAMES = [12, 13, 14, 15] as const;
export const CELESTIAL_STAG_LV1314_SETTLE_FRAMES = Array.from(
  { length: 12 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_LV1314_SLEEP_FRAMES = [12, 13, 14, 15] as const;

/** Level 15–16 uses distinct 4×4 tracks for gait, flight, and sleep. */
export const CELESTIAL_STAG_LV1516_WALK_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_LV1516_RUN_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_LV1516_TAKEOFF_FRAMES = [0, 1, 2, 3] as const;
export const CELESTIAL_STAG_LV1516_FLAP_FRAMES = [4, 5, 6, 7] as const;
export const CELESTIAL_STAG_LV1516_GLIDE_FRAMES = [8, 9, 10, 11] as const;
export const CELESTIAL_STAG_LV1516_LANDING_FRAMES = [12, 13, 14, 15] as const;
export const CELESTIAL_STAG_LV1516_SETTLE_FRAMES = Array.from(
  { length: 12 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_LV1516_SLEEP_FRAMES = [12, 13, 14, 15] as const;

/** Level 17–18 dedicated walk/run, flight and sleep tracks. */
export const CELESTIAL_STAG_LV1718_WALK_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_LV1718_RUN_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_LV1718_TAKEOFF_FRAMES = [0, 1, 2, 3] as const;
export const CELESTIAL_STAG_LV1718_FLAP_FRAMES = [4, 5, 6, 7] as const;
export const CELESTIAL_STAG_LV1718_GLIDE_FRAMES = [8, 9, 10, 11] as const;
/**
 * Authored landing frames 14–16 are off-model: hold the reaching-down pose 13
 * while descending, then touch down on the grounded takeoff pose.
 */
export const CELESTIAL_STAG_LV1718_LANDING_FRAMES = [12, 12, 12, 0] as const;
export const CELESTIAL_STAG_LV1718_SETTLE_FRAMES = Array.from(
  { length: 8 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_LV1718_SLEEP_FRAMES = Array.from(
  { length: 8 },
  (_, frame) => frame + 8,
);

export const CELESTIAL_STAG_LV78_WALK_FRAMES = Array.from({ length: 16 }, (_, frame) => frame);
export const CELESTIAL_STAG_LV78_RUN_FRAMES = Array.from({ length: 16 }, (_, frame) => frame);
export const CELESTIAL_STAG_LV78_TAKEOFF_FRAMES = [0, 1, 2, 3] as const;
export const CELESTIAL_STAG_LV78_FLAP_FRAMES = [4, 5, 6, 7] as const;
export const CELESTIAL_STAG_LV78_GLIDE_FRAMES = [8, 9, 10, 11] as const;
export const CELESTIAL_STAG_LV78_LANDING_FRAMES = [12, 13, 14, 15] as const;
export const CELESTIAL_STAG_LV78_SETTLE_FRAMES = Array.from({ length: 12 }, (_, frame) => frame);
export const CELESTIAL_STAG_LV78_SLEEP_FRAMES = [12, 13, 14, 15] as const;

/** Level 9–10 reviewed ground loops and authored sleep transition/loop. */
export const CELESTIAL_STAG_LV910_WALK_FRAMES = Array.from({ length: 16 }, (_, frame) => frame);
export const CELESTIAL_STAG_LV910_RUN_FRAMES = Array.from({ length: 16 }, (_, frame) => frame);
export const CELESTIAL_STAG_LV910_SETTLE_FRAMES = Array.from({ length: 12 }, (_, frame) => frame);
export const CELESTIAL_STAG_LV910_SLEEP_FRAMES = [12, 13, 14, 15] as const;
export const CELESTIAL_STAG_LV910_TAKEOFF_FRAMES = [0, 1, 2, 3] as const;
export const CELESTIAL_STAG_LV910_FLAP_FRAMES = [4, 5, 6, 7] as const;
export const CELESTIAL_STAG_LV910_GLIDE_FRAMES = [8, 9, 10, 11] as const;
export const CELESTIAL_STAG_LV910_LANDING_FRAMES = [12, 13, 14, 15] as const;

export function isCelestialStagLevel78(level?: number): boolean {
  return level === 7 || level === 8;
}

export function isCelestialStagLevel910(level?: number): boolean {
  return level === 9 || level === 10;
}

export function isCelestialStagLevel1314(level?: number): boolean {
  return level === 13 || level === 14;
}

export function isCelestialStagLevel1516(level?: number): boolean {
  return level === 15 || level === 16;
}

export function isCelestialStagLevel1718(level?: number): boolean {
  return level === 17 || level === 18;
}

/** Final authored level set is limited to the two cap levels. */
export function isCelestialStagLevel1920(level?: number): boolean {
  return level !== undefined && level >= 19;
}

/** Completed ground gait atlases use eight poses repeated across the 4×4 sheet. */
export const CELESTIAL_STAG_LV1920_WALK_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_LV1920_RUN_FRAMES = Array.from(
  { length: 16 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_LV1920_TAKEOFF_FRAMES = [0, 1, 2, 3] as const;
export const CELESTIAL_STAG_LV1920_FLAP_FRAMES = [4, 5, 6, 7] as const;
export const CELESTIAL_STAG_LV1920_GLIDE_FRAMES = [8, 9, 10, 11] as const;
export const CELESTIAL_STAG_LV1920_LANDING_FRAMES = [12, 13, 14, 15] as const;
export const CELESTIAL_STAG_LV1920_SETTLE_FRAMES = Array.from(
  { length: 12 },
  (_, frame) => frame,
);
export const CELESTIAL_STAG_LV1920_SLEEP_FRAMES = [12, 13, 14, 15] as const;
/** Drag phases a held or released Stag plays from its own level's atlas. */
export type CelestialStagDragPhase = 'lifted' | 'circle' | 'descend' | 'land';
export type CelestialStagDragTracks = Record<
  CelestialStagDragPhase,
  readonly number[]
>;
/**
 * Level flight atlases (takeoff 0–3, flap 4–7, glide 8–11, landing 12–15):
 * flap while held or circling, then the landing poses down to the ground.
 */
export const CELESTIAL_STAG_DRAG_FLIGHT_TRACKS: CelestialStagDragTracks = {
  lifted: CELESTIAL_STAG_LV1920_FLAP_FRAMES,
  circle: CELESTIAL_STAG_LV1920_FLAP_FRAMES,
  descend: [12, 13, 14],
  land: [15],
};
/** Lv17–18 landing frames 14–16 are off-model, so touch down on the ground pose. */
export const CELESTIAL_STAG_LV1718_DRAG_TRACKS: CelestialStagDragTracks = {
  ...CELESTIAL_STAG_DRAG_FLIGHT_TRACKS,
  descend: [12],
  land: [CELESTIAL_STAG_LV1718_LANDING_FRAMES.at(-1)!],
};
/** Lv1–2 cannot fly: kick in the tucked hop poses, then the hop landing. */
export const CELESTIAL_STAG_LV12_DRAG_TRACKS: CelestialStagDragTracks = {
  lifted: [2, 4, 6, 4],
  circle: [2, 4, 6, 4],
  descend: [7],
  land: [8, 9, 10, 11],
};
/** Lv9–10 uses its authored takeoff, flight, descent and landing tracks. */
export const CELESTIAL_STAG_LV910_DRAG_TRACKS: CelestialStagDragTracks = {
  lifted: CELESTIAL_STAG_LV910_TAKEOFF_FRAMES,
  circle: [...CELESTIAL_STAG_LV910_FLAP_FRAMES, ...CELESTIAL_STAG_LV910_GLIDE_FRAMES],
  descend: CELESTIAL_STAG_LV910_LANDING_FRAMES,
  land: [CELESTIAL_STAG_LV910_LANDING_FRAMES.at(-1)!],
};
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
