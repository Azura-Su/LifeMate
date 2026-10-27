import type {
  PixelPetClipId,
  PixelPetEffect,
  PixelPetMotif,
  PixelPetRigId,
  PixelPetStage,
} from '../../types/pixelPet';
import type { PixelPetSpecies } from './pixelPetCatalog';

/**
 * Shared rigs: 4 bodies + 4 heads carry every species. A species only adds a
 * palette, a crest and a feature layer pinned to fixed anchors, and all three
 * evolution stages replay the same transform clips, so no per-stage frames.
 */
export const PIXEL_CANVAS = 32;

export type PixelLayer = {
  part: 'body' | 'head' | 'feature';
  x: number;
  y: number;
  grid: readonly string[];
};

type Rig = {
  body: readonly string[];
  bodyAt: readonly [number, number];
  head: readonly string[];
  headAt: readonly [number, number];
  featureAt: readonly [number, number];
  /** Extra sway for the feature layer (tails swish, wings flap). */
  featureSwing: number;
};

const HEAD = [
  '..11111..',
  '.1111111.',
  '111111111',
  '1w4111w41',
  '144111441',
  '111111111',
  '.1111111.',
  '..11111..',
];
const BEAK_HEAD = [
  '..11111..',
  '.1111111.',
  '111111111',
  '1w4111w41',
  '144111441',
  '111113331',
  '.1111131.',
  '..11111..',
];

export const PIXEL_RIGS: Record<PixelPetRigId, Rig> = {
  quadruped: {
    body: [
      '...111111111111.',
      '..11111111111111',
      '.111111111111111',
      '.122222222222221',
      '..1222222222221.',
      '..11.11....11.11',
      '..11.11....11.11',
      '..44.44....44.44',
    ],
    bodyAt: [10, 17],
    head: HEAD,
    headAt: [4, 11],
    featureAt: [22, 10],
    featureSwing: 8,
  },
  serpentine: {
    body: [
      '.....11111111.....',
      '...111222222111...',
      '..11211111111211..',
      '.11211122221111211',
      '.12111222222111121',
      '.12111122221111211',
      '..12211111111221..',
      '...112222222211...',
      '.....11111111.....',
    ],
    bodyAt: [7, 19],
    head: HEAD,
    headAt: [6, 11],
    featureAt: [21, 11],
    featureSwing: 4,
  },
  avian: {
    body: [
      '...111111...',
      '..11111111..',
      '.1111111111.',
      '.1222222221.',
      '.1222222221.',
      '..12222221..',
      '...111111...',
      '....3..3....',
      '...33..33...',
    ],
    bodyAt: [11, 17],
    head: BEAK_HEAD,
    headAt: [12, 9],
    featureAt: [4, 14],
    featureSwing: 10,
  },
  biped: {
    body: [
      '..111111..',
      '.11111111.',
      '1311111131',
      '1312222131',
      '1.122221.1',
      '..122221..',
      '..111111..',
      '..11..11..',
      '..11..11..',
      '..44..44..',
    ],
    bodyAt: [11, 17],
    head: HEAD,
    headAt: [11, 9],
    featureAt: [20, 13],
    featureSwing: 6,
  },
};

/** Stages only rescale and toggle layers; the body is never redrawn. */
export const STAGE_LOOK: Record<
  PixelPetStage,
  { scale: number; feature: boolean; aura: boolean }
> = {
  hatchling: { scale: 0.72, feature: false, aura: false },
  juvenile: { scale: 0.88, feature: true, aura: false },
  ascended: { scale: 1, feature: true, aura: true },
};

export function pixelPetLayers(
  species: PixelPetSpecies,
  stage: PixelPetStage,
): PixelLayer[] {
  const rig = PIXEL_RIGS[species.rig];
  const [hx, hy] = rig.headAt;
  return [
    ...(STAGE_LOOK[stage].feature
      ? [
          {
            part: 'feature' as const,
            x: rig.featureAt[0],
            y: rig.featureAt[1],
            grid: species.feature,
          },
        ]
      : []),
    { part: 'body', x: rig.bodyAt[0], y: rig.bodyAt[1], grid: rig.body },
    { part: 'head', x: hx, y: hy, grid: rig.head },
    // The crest rides on the head so both move with one transform.
    { part: 'head', x: hx, y: hy - species.crest.length, grid: species.crest },
  ];
}

/** Merges each row's runs of one colour into rects (fewer SVG nodes). */
export function gridRects(grid: readonly string[]) {
  const rects: { x: number; y: number; w: number; slot: string }[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const slot = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === slot) end += 1;
      if (slot !== '.') rects.push({ x, y, w: end - x, slot });
      x = end;
    }
  });
  return rects;
}

export function slotColor(slot: string, palette: PixelPetSpecies['palette']) {
  if (slot === 'w') return '#FFFFFF';
  const index = Number(slot) - 1;
  return palette[index] ?? palette[3];
}

/** Keyframe: [t 0..1, dx px, dy px, rotate deg, scale]. */
export type Keyframe = readonly [number, number, number, number, number];
export type ClipTrack = readonly Keyframe[];
export type PixelClip = {
  durationMs: number;
  loop: boolean;
  body: ClipTrack;
  head: ClipTrack;
  feature: ClipTrack;
};

const still: ClipTrack = [
  [0, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
];
/** One clip set for every rig and stage. */
export const PIXEL_CLIPS: Record<PixelPetClipId, PixelClip> = {
  idle: {
    durationMs: 2400,
    loop: true,
    body: [
      [0, 0, 0, 0, 1],
      [0.5, 0, 0.4, 0, 1.02],
      [1, 0, 0, 0, 1],
    ],
    head: [
      [0, 0, 0, 0, 1],
      [0.5, 0, 0.6, -2, 1],
      [1, 0, 0, 0, 1],
    ],
    feature: [
      [0, 0, 0, -1, 1],
      [0.5, 0, 0, 1, 1],
      [1, 0, 0, -1, 1],
    ],
  },
  eat: {
    durationMs: 1200,
    loop: false,
    body: still,
    head: [
      [0, 0, 0, 0, 1],
      [0.25, -0.5, 1.5, 12, 1],
      [0.5, 0, 0, 0, 1],
      [0.75, -0.5, 1.5, 12, 1],
      [1, 0, 0, 0, 1],
    ],
    feature: still,
  },
  move: {
    durationMs: 1000,
    loop: false,
    body: [
      [0, 0, 0, 0, 1],
      [0.25, -2, -1, 0, 1],
      [0.5, -4, 0, 0, 1],
      [0.75, -2, -1, 0, 1],
      [1, 0, 0, 0, 1],
    ],
    head: [
      [0, 0, 0, 0, 1],
      [0.25, -2, -1.5, 0, 1],
      [0.5, -4, 0, 0, 1],
      [0.75, -2, -1.5, 0, 1],
      [1, 0, 0, 0, 1],
    ],
    feature: [
      [0, 0, 0, 0, 1],
      [0.5, -4, 0, 1, 1],
      [1, 0, 0, 0, 1],
    ],
  },
  heal: {
    durationMs: 1400,
    loop: false,
    body: [
      [0, 0, 0, 0, 1],
      [0.5, 0, -1, 0, 1.06],
      [1, 0, 0, 0, 1],
    ],
    head: [
      [0, 0, 0, 0, 1],
      [0.5, 0, -2, 0, 1.04],
      [1, 0, 0, 0, 1],
    ],
    feature: still,
  },
  happy: {
    durationMs: 900,
    loop: false,
    body: [
      [0, 0, 0, 0, 1],
      [0.3, 0, -4, 0, 0.96],
      [0.6, 0, 0, 0, 1.04],
      [1, 0, 0, 0, 1],
    ],
    head: [
      [0, 0, 0, 0, 1],
      [0.3, 0, -5, 6, 1],
      [0.6, 0, 0, -6, 1],
      [1, 0, 0, 0, 1],
    ],
    feature: [
      [0, 0, 0, 0, 1],
      [0.3, 0, -4, 1, 1],
      [0.6, 0, 0, -1, 1],
      [1, 0, 0, 0, 1],
    ],
  },
  skill: {
    durationMs: 1600,
    loop: false,
    body: [
      [0, 0, 0, 0, 1],
      [0.3, 1, 0.5, 0, 0.94],
      [0.55, -2, -2, 0, 1.08],
      [1, 0, 0, 0, 1],
    ],
    head: [
      [0, 0, 0, 0, 1],
      [0.3, 1, 1, 8, 1],
      [0.55, -3, -3, -10, 1.06],
      [1, 0, 0, 0, 1],
    ],
    feature: [
      [0, 0, 0, 0, 1],
      [0.55, -2, -2, 1, 1.1],
      [1, 0, 0, 0, 1],
    ],
  },
};

/** Interpolates one track; runs on the UI thread. */
export function sampleTrack(track: ClipTrack, t: number) {
  'worklet';
  let index = 1;
  while (index < track.length - 1 && track[index][0] < t) index += 1;
  const a = track[index - 1];
  const b = track[index];
  const span = b[0] - a[0];
  const k = span > 0 ? Math.min(1, Math.max(0, (t - a[0]) / span)) : 1;
  return [
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
    a[3] + (b[3] - a[3]) * k,
    a[4] + (b[4] - a[4]) * k,
  ] as const;
}

/** Care effects reuse the shared clips; none needs bespoke frames. */
export const EFFECT_CLIP: Record<PixelPetEffect, PixelPetClipId> = {
  eat: 'eat',
  move: 'move',
  heal: 'heal',
  mood: 'happy',
  wardrobe: 'happy',
  neutral: 'idle',
};

/** Shared skill motif glyphs (8×8), recoloured with the species palette. */
export const MOTIF_GRIDS: Record<PixelPetMotif, readonly string[]> = {
  flame: ['...3....', '..33..3.', '..333.3.', '.33233..', '.322233.', '.322223.', '..3223..', '...33...'],
  water: ['...3....', '..333...', '..333...', '.33w33..', '.333333.', '.333333.', '..3333..', '........'],
  wind: ['........', '.3333...', '.....3..', '..3333.3', '.......3', '.33333..', '......3.', '..333...'],
  light: ['...3....', '...3....', '.3.3.3..', '..333...', '3333333.', '..333...', '.3.3.3..', '...3....'],
  earth: ['........', '...33...', '..3223..', '.322223.', '.322223.', '3222222.', '33333333', '........'],
  arcane: ['..3333..', '.3....3.', '3..33..3', '3.3..3.3', '3.3..3.3', '3..33..3', '.3....3.', '..3333..'],
};
