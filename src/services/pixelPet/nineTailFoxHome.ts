/** Home-only movement cycle for the Nine-Tailed Fox. */
export const NINE_TAIL_FOX_HOME_PHASE_DURATION = {
  walk: 2800,
  run: 1400,
  jump: 720,
  turn: 480,
  land: 620,
  walkAway: 2200,
  sleep: 9000,
  wake: 1450,
} as const;

/** Duration of the Home shrine and cherry tree's staged growth. */
export const NINE_TAIL_FOX_HOME_SLEEP_SCENE_GROWTH_MS = 2400;
/** Blossoms wither, the shrine gate collapses, and the scene drifts to dust. */
export const NINE_TAIL_FOX_HOME_SLEEP_SCENE_WITHER_MS = 4800;

export type NineTailFoxHomePhase =
  keyof typeof NINE_TAIL_FOX_HOME_PHASE_DURATION;

/** Keep the hop at its current spot, clamped to the visible Home lane. */
export function nineTailFoxJumpTarget(currentX: number, range: number): number {
  const maxX = Math.max(0, range);
  return Math.min(maxX, Math.max(0, currentX));
}

/** Keep the hop visibly playful without lifting the fox too far from Home. */
export function nineTailFoxJumpHeight(size: number): number {
  return Math.max(0, size) * 0.75;
}

/** One full mid-air roll, clockwise when moving right and counterclockwise left. */
export function nineTailFoxFlipRotation(direction: number): number {
  return direction > 0 ? -360 : 360;
}

export function nextNineTailFoxHomePhase(
  phase: NineTailFoxHomePhase,
): NineTailFoxHomePhase {
  switch (phase) {
    case 'walk':
      return 'run';
    case 'run':
      return 'jump';
    case 'jump':
      return 'turn';
    case 'turn':
      return 'land';
    case 'land':
      return 'walkAway';
    case 'walkAway':
      return 'sleep';
    case 'sleep':
      return 'wake';
    case 'wake':
      return 'walk';
  }
}

/** Whole-character frame indices in home_nine_tail_fox.png. */
export const NINE_TAIL_FOX_HOME_FRAME_TRACKS: Record<
  NineTailFoxHomePhase,
  readonly number[]
> = {
  walk: [0, 1, 2, 3],
  run: [4, 5, 6, 7],
  jump: [8, 9, 10, 11],
  turn: [11, 12],
  land: [14, 15],
  walkAway: [0, 1, 2, 3],
  sleep: [],
  wake: [],
};

export function nineTailFoxHomePlayback(phase: NineTailFoxHomePhase) {
  if (phase === 'walk' || phase === 'walkAway')
    return { durationMs: 820, loop: true };
  if (phase === 'run') return { durationMs: 420, loop: true };
  return {
    durationMs: NINE_TAIL_FOX_HOME_PHASE_DURATION[phase],
    loop: false,
  };
}
