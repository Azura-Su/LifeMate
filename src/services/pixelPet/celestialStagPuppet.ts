import type {
  PixelPetAnyClipId,
  PixelPetExtraClipId,
} from '../../types/pixelPet';
import type { ClipTrack, Keyframe } from './pixelPetRig';

/**
 * Celestial Stag: the admin-only pet. Instead of a 16-pose atlas it is a
 * puppet cut from one illustration (scripts/build-celestial-stag-layers.cjs):
 * wings, head and tail are separate layers that pivot at the joints, with
 * animated glow overlays on the hooves, gems and aura. That is what allows
 * 13 clips where the atlas pets have 6.
 */
export const CELESTIAL_STAG_ID = 'celestial_stag';

export type PuppetPart = 'body' | 'wingL' | 'wingR' | 'tail' | 'head';
type PuppetPlacement = {
  /** Fractions of the square canvas. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Joint position as a fraction of the canvas (undefined = layer centre). */
  pivot?: readonly [number, number];
};

export const PUPPET_LAYOUT: Record<PuppetPart, PuppetPlacement> = {
  body: { left: 0.34133, top: 0.45867, width: 0.476, height: 0.38267 },
  wingL: {
    left: 0.02533,
    top: 0.17733,
    width: 0.40667,
    height: 0.41467,
    pivot: [0.427, 0.522],
  },
  wingR: {
    left: 0.56933,
    top: 0.176,
    width: 0.408,
    height: 0.392,
    pivot: [0.595, 0.525],
  },
  tail: {
    left: 0.74533,
    top: 0.47333,
    width: 0.196,
    height: 0.27067,
    pivot: [0.772, 0.605],
  },
  head: {
    left: 0.36533,
    top: 0.16,
    width: 0.28267,
    height: 0.352,
    pivot: [0.487, 0.489],
  },
};

/** Overlay anchors, fractions of the canvas. */
export const PUPPET_ANCHORS = {
  hooves: [
    [0.382, 0.827],
    [0.559, 0.811],
    [0.587, 0.805],
    [0.723, 0.827],
  ],
  headGems: [
    [0.458, 0.359],
    [0.629, 0.181],
    [0.435, 0.237],
    [0.634, 0.287],
    [0.553, 0.242],
  ],
  bodyGems: [
    [0.444, 0.53],
    [0.537, 0.582],
    [0.572, 0.577],
    [0.517, 0.573],
    [0.478, 0.539],
  ],
  eyes: [
    [0.427, 0.389],
    [0.493, 0.394],
  ],
} as const;

/** Feet-centre pivot the whole body group pitches and squashes around. */
export const PUPPET_BODY_PIVOT = [0.62, 0.8] as const;

/**
 * Tracks use the shared keyframe shape [t, dx, dy, rotateDeg, scale] with dx/dy
 * in percent of the canvas. `fx` packs overlay strengths into the same slots
 * as [flames, gems, aura, motes]; `blink` uses the first slot as eyelid closure.
 */
export type PuppetClip = {
  durationMs: number;
  loop: boolean;
  /** Outer group: hops and turns (scale is the horizontal scale). */
  root: ClipTrack;
  /** Everything attached to the torso moves with this. */
  body: ClipTrack;
  head: ClipTrack;
  wingL: ClipTrack;
  wingR: ClipTrack;
  tail: ClipTrack;
  fx: ClipTrack;
  blink: ClipTrack;
};
export type PuppetTrackKey = PixelPetAnyClipId | 'roam' | 'trot';

const TAU = Math.PI * 2;
const sin = (t: number, cycles: number, phase = 0) =>
  Math.sin((t * cycles + phase) * TAU);
/** Smooth 0→1→0 hill between a and b. */
const bump = (t: number, a: number, b: number) =>
  t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI);
/** Like bump but with a flat top, so poses can be held. */
const hold = (t: number, a: number, b: number) =>
  Math.min(1, bump(t, a, b) * 1.6);
const breath = (t: number) => (1 - Math.cos(TAU * t)) / 2;

type Sample = readonly [number, number, number, number];
const wave = (steps: number, f: (t: number) => Sample): ClipTrack =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const [a, b, c, d] = f(t);
    return [t, a, b, c, d] as Keyframe;
  });
const flat: ClipTrack = [
  [0, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
];
/** Mirrored wings: a positive angle raises both. */
const wings = (up: (t: number) => number, lift = (_t: number) => 0) => ({
  wingL: wave(24, (t) => [0, lift(t), up(t), 1]),
  wingR: wave(24, (t) => [0, lift(t), -up(t), 1]),
});
const fx = (
  steps: number,
  f: (t: number) => readonly [number, number, number, number],
) => wave(steps, (t) => f(t));
const blink = (f: (t: number) => number): ClipTrack =>
  wave(40, (t) => [f(t), 0, 0, 1]);

/**
 * Head rotation: the stag faces left, so a negative angle lowers the nose and
 * a positive one lifts it. Wings: positive raises them.
 */
const BASE_CLIPS: Record<Exclude<PuppetTrackKey, 'trot'>, PuppetClip> = {
  idle: {
    durationMs: 3200,
    loop: true,
    root: flat,
    body: wave(16, (t) => [0, -0.5 * breath(t), 0, 1 + 0.012 * breath(t)]),
    head: wave(16, (t) => [0, -0.3 * breath(t), 1.6 * sin(t, 1), 1]),
    ...wings((t) => 2 + 5 * breath(t) + 1.5 * sin(t, 2)),
    tail: wave(16, (t) => [0, 0, 5 * sin(t, 1, 0.2), 1]),
    fx: fx(16, (t) => [
      0.55 + 0.25 * sin(t, 2),
      0.35 + 0.25 * breath(t),
      0.2 + 0.1 * breath(t),
      0.25,
    ]),
    blink: blink((t) => bump(t, 0.6, 0.67)),
  },
  eat: {
    durationMs: 1500,
    loop: false,
    root: flat,
    body: wave(20, (t) => [0, 0.3 * bump(t, 0, 1), -2 * bump(t, 0, 1), 1]),
    head: wave(24, (t) => [
      0,
      1.4 * breath(t * 2) * bump(t, 0, 1) ** 0.3,
      -14 * breath(t * 2) * bump(t, 0, 1) ** 0.3,
      1,
    ]),
    ...wings((t) => -4 * bump(t, 0, 1)),
    tail: wave(20, (t) => [0, 0, 7 * sin(t, 2), 1]),
    fx: fx(10, (t) => [0.55, 0.5, 0.2, 0.3 * bump(t, 0, 1)]),
    blink: blink((t) => bump(t, 0.45, 0.55)),
  },
  move: {
    durationMs: 1000,
    loop: false,
    root: flat,
    body: wave(24, (t) => [0, -1.4 * Math.abs(sin(t, 1)), 1.2 * sin(t, 2), 1]),
    head: wave(24, (t) => [
      0,
      -0.5 * Math.abs(sin(t, 1)),
      2 * sin(t, 2, 0.25),
      1,
    ]),
    ...wings((t) => 4 + 6 * sin(t, 2, 0.25)),
    tail: wave(24, (t) => [0, 0, 8 * sin(t, 2), 1]),
    fx: fx(12, () => [1, 0.4, 0.2, 0.4]),
    blink: blink(() => 0),
  },
  // Home roaming: a looping flap-glide instead of a one-shot trot.
  roam: {
    durationMs: 900,
    loop: true,
    root: wave(18, () => [0, -1.5, 0, 1]),
    body: wave(18, (t) => [0, 1.1 * sin(t, 1), 1.5 * sin(t, 1, 0.1), 1]),
    head: wave(18, (t) => [0, 0, 2 * sin(t, 1, 0.2), 1]),
    ...wings((t) => 5 + 20 * sin(t, 1)),
    tail: wave(18, (t) => [0, 0, 7 * sin(t, 1, -0.2), 1]),
    fx: fx(9, () => [1, 0.5, 0.25, 0.6]),
    blink: blink(() => 0),
  },
  heal: {
    durationMs: 1800,
    loop: false,
    root: flat,
    body: wave(18, (t) => [
      0,
      -0.6 * bump(t, 0, 1),
      0,
      1 + 0.015 * bump(t, 0, 1),
    ]),
    head: wave(18, (t) => [0, -0.5 * bump(t, 0, 1), 4 * bump(t, 0, 1), 1]),
    ...wings((t) => 10 * hold(t, 0, 1)),
    tail: wave(18, (t) => [0, 0, 3 * sin(t, 2), 1]),
    fx: fx(18, (t) => [
      0.7,
      hold(t, 0, 1),
      0.9 * bump(t, 0, 1),
      0.9 * bump(t, 0, 1),
    ]),
    blink: blink((t) => 0.85 * hold(t, 0.2, 0.8)),
  },
  happy: {
    durationMs: 900,
    loop: false,
    root: flat,
    body: wave(18, (t) => [
      0,
      -6 * bump(t, 0, 0.6),
      0,
      1 + 0.03 * bump(t, 0, 0.3) - 0.05 * bump(t, 0.6, 1),
    ]),
    head: wave(18, (t) => [
      0,
      -0.5 * bump(t, 0, 0.6),
      6 * bump(t, 0, 0.6) - 3 * bump(t, 0.6, 1),
      1,
    ]),
    ...wings((t) => (20 * sin(t, 2) + 8) * bump(t, 0, 1) ** 0.4),
    tail: wave(18, (t) => [0, 0, 14 * sin(t, 3) * bump(t, 0, 1) ** 0.3, 1]),
    fx: fx(10, (t) => [
      0.9,
      0.9 * bump(t, 0, 1),
      0.5 * bump(t, 0, 1),
      0.9 * bump(t, 0, 1),
    ]),
    blink: blink((t) => 0.9 * hold(t, 0.12, 0.75)),
  },
  skill: {
    durationMs: 2200,
    loop: false,
    root: flat,
    body: wave(30, (t) => [
      0,
      1.2 * bump(t, 0, 0.3) - 4 * bump(t, 0.28, 0.85),
      7 * hold(t, 0.28, 0.85) - 1 * bump(t, 0, 0.3),
      1 - 0.03 * bump(t, 0, 0.3),
    ]),
    head: wave(30, (t) => [0, 0, 10 * hold(t, 0.3, 0.85), 1]),
    ...wings((t) => (38 + 4 * sin(t, 6)) * hold(t, 0.2, 0.9)),
    tail: wave(30, (t) => [0, 0, 9 * sin(t, 3) * bump(t, 0, 1), 1]),
    fx: fx(30, (t) => [
      1.5 * hold(t, 0.2, 0.9),
      hold(t, 0.1, 0.95),
      hold(t, 0.2, 0.92),
      hold(t, 0.2, 0.95),
    ]),
    blink: blink(() => 0),
  },
  fly: {
    durationMs: 1000,
    loop: true,
    root: wave(20, () => [0, -3, 0, 1]),
    body: wave(20, (t) => [0, 1.8 * sin(t, 1), 2 * sin(t, 1, 0.15), 1]),
    head: wave(20, (t) => [0, 0, 2.5 * sin(t, 1, 0.2) + 2, 1]),
    ...wings((t) => 6 + 28 * sin(t, 1)),
    tail: wave(20, (t) => [0, 0, 7 * sin(t, 1, -0.25), 1]),
    fx: fx(10, () => [1.1, 0.5, 0.35, 0.95]),
    blink: blink(() => 0),
  },
  flap: {
    durationMs: 1800,
    loop: false,
    root: flat,
    body: wave(24, (t) => [0, -1.2 * hold(t, 0, 1), 2 * hold(t, 0, 1), 1]),
    head: wave(24, (t) => [0, -0.4 * hold(t, 0, 1), 8 * hold(t, 0, 1), 1]),
    ...wings((t) => (38 + 3 * sin(t, 10)) * hold(t, 0, 1)),
    tail: wave(24, (t) => [0, 0, 4 * sin(t, 2) * bump(t, 0, 1), 1]),
    fx: fx(18, (t) => [
      0.8,
      hold(t, 0, 1),
      0.9 * hold(t, 0, 1),
      0.8 * hold(t, 0, 1),
    ]),
    blink: blink(() => 0),
  },
  prance: {
    durationMs: 1200,
    loop: true,
    root: flat,
    body: wave(24, (t) => [
      0,
      -4.5 * Math.abs(sin(t, 1)),
      2 * sin(t, 2, 0.25),
      1,
    ]),
    head: wave(24, (t) => [0, 0, 5 * sin(t, 2, 0.5), 1]),
    ...wings((t) => 8 + 12 * sin(t, 2, 0.15)),
    tail: wave(24, (t) => [0, 0, 14 * sin(t, 2, 0.1), 1]),
    fx: fx(12, (t) => [0.9 + 0.3 * sin(t, 2), 0.7, 0.3, 0.5]),
    blink: blink(() => 0),
  },
  bow: {
    durationMs: 2200,
    loop: false,
    root: flat,
    body: wave(24, (t) => [
      0,
      1.5 * hold(t, 0.08, 0.92),
      -9 * hold(t, 0.08, 0.92),
      1,
    ]),
    head: wave(24, (t) => [
      0,
      hold(t, 0.08, 0.92),
      -16 * hold(t, 0.08, 0.92),
      1,
    ]),
    ...wings((t) => -18 * hold(t, 0.08, 0.92)),
    tail: wave(24, (t) => [0, 0, -6 * hold(t, 0.08, 0.92), 1]),
    fx: fx(12, (t) => [0.5, 0.4 + 0.4 * bump(t, 0.5, 1), 0.25, 0.2]),
    blink: blink((t) => 0.9 * hold(t, 0.15, 0.85)),
  },
  glow: {
    durationMs: 2600,
    loop: false,
    root: flat,
    body: wave(26, (t) => [0, 0, 0, 1 + 0.015 * sin(t, 3) * bump(t, 0, 1)]),
    head: wave(26, (t) => [0, -0.3 * bump(t, 0, 1), 4 * bump(t, 0, 1), 1]),
    ...wings((t) => 6 * hold(t, 0, 1)),
    tail: wave(26, (t) => [0, 0, 4 * sin(t, 1) * bump(t, 0, 1), 1]),
    fx: fx(26, (t) => [
      0.8 * hold(t, 0, 1),
      hold(t, 0, 1) * (0.8 + 0.2 * sin(t, 4)),
      hold(t, 0, 1),
      0.6 * bump(t, 0, 1),
    ]),
    blink: blink((t) => 0.7 * hold(t, 0.2, 0.8)),
  },
  blaze: {
    durationMs: 1800,
    loop: false,
    root: flat,
    body: wave(24, (t) => [
      0,
      -3 * bump(t, 0.2, 0.55),
      3 * bump(t, 0.2, 0.6),
      1,
    ]),
    head: wave(24, (t) => [0, 0, 5 * bump(t, 0.2, 0.6), 1]),
    ...wings((t) => 20 * bump(t, 0.15, 0.7)),
    tail: wave(24, (t) => [0, 0, 8 * sin(t, 3) * bump(t, 0, 1), 1]),
    fx: fx(24, (t) => [
      0.6 + 1.4 * hold(t, 0.05, 0.9),
      0.7 * bump(t, 0, 1),
      0.7 * hold(t, 0.1, 0.9),
      hold(t, 0.1, 0.95),
    ]),
    blink: blink(() => 0),
  },
  // A full turn: the outer group squashes through zero width and back.
  spin: {
    durationMs: 1600,
    loop: false,
    root: wave(32, (t) => [0, -3 * bump(t, 0, 1), 0, Math.cos(TAU * t)]),
    body: flat,
    head: wave(32, (t) => [0, 0, 3 * bump(t, 0, 1), 1]),
    ...wings((t) => 18 * bump(t, 0, 1)),
    tail: wave(32, (t) => [0, 0, 10 * sin(t, 2) * bump(t, 0, 1), 1]),
    fx: fx(16, (t) => [
      0.9,
      0.9 * bump(t, 0, 1),
      0.5 * bump(t, 0, 1),
      bump(t, 0, 1),
    ]),
    blink: blink(() => 0),
  },
};

// Home walking: the trot on a loop, so the puppet never remounts per stride.
const CLIPS: Record<PuppetTrackKey, PuppetClip> = {
  ...BASE_CLIPS,
  trot: { ...BASE_CLIPS.move, loop: true },
};
export const PUPPET_CLIPS = CLIPS;

/** Home roaming (looping `move`) flaps in flight and trots when walking. */
export function puppetTrackKey(
  clip: PixelPetAnyClipId,
  loopMovement: boolean,
  walking = false,
): PuppetTrackKey {
  if (clip !== 'move' || !loopMovement) return clip;
  return walking ? 'trot' : 'roam';
}

export function puppetPlayback(
  clip: PixelPetAnyClipId,
  loopMovement = false,
  walking = false,
) {
  const { durationMs, loop } =
    CLIPS[puppetTrackKey(clip, loopMovement, walking)];
  return { durationMs, loop };
}

/** Labels for the extra care-screen buttons, in display order. */
export const PUPPET_EXTRA_CLIPS: readonly {
  clip: PixelPetExtraClipId;
  label: string;
}[] = [
  { clip: 'fly', label: 'Bay lượn' },
  { clip: 'flap', label: 'Xòe cánh' },
  { clip: 'prance', label: 'Nhảy múa' },
  { clip: 'bow', label: 'Cúi chào' },
  { clip: 'glow', label: 'Tỏa sáng' },
  { clip: 'blaze', label: 'Hỏa linh' },
  { clip: 'spin', label: 'Xoay vòng' },
];

export function isExtraClip(
  clip: PixelPetAnyClipId,
): clip is PixelPetExtraClipId {
  return PUPPET_EXTRA_CLIPS.some((extra) => extra.clip === clip);
}
