import type { PixelPetSpecies } from './pixelPetCatalog';
import type {
  DragFallStyle,
  DragPhase,
  PixelPetClipId,
} from '../../types/pixelPet';
import { PIXEL_CLIPS } from './pixelPetRig';

export const PET_ATLAS = { columns: 4, rows: 4, cellSize: 256 } as const;

const PET_DRAG_FRAME_TRACKS: Partial<Record<DragPhase, readonly number[]>> = {
  lifted: [0, 1, 2, 3],
  circle: [4, 5, 6, 7],
  descend: [4, 5, 6, 7],
  fall: [4, 5, 6, 7],
  land: [8, 9, 10, 11],
};

const FALL_FRAME_TRACKS: Record<DragFallStyle, readonly number[]> = {
  fall: [4, 5, 6, 7, 6, 5],
  coil: [4, 5, 6, 7, 7, 6],
  flop: [4, 5, 6, 5, 4, 5],
  tentacle: [4, 6, 5, 7, 6, 5],
  shell: [4, 5, 6, 7, 4, 5],
  wings: [4, 5, 6, 7],
};

/** Reuses each species' own locomotion cells as the code-driven fall poses. */
export function petDragFallbackFrameTrack(
  phase: DragPhase,
  fallStyle: DragFallStyle,
): readonly number[] | undefined {
  if (phase === 'lifted' || phase === 'land') return [8, 9, 10, 11];
  if (phase === 'circle' || phase === 'descend' || phase === 'fall')
    return FALL_FRAME_TRACKS[fallStyle];
  return undefined;
}

export function petDragFrameTrack(phase: DragPhase) {
  return PET_DRAG_FRAME_TRACKS[phase];
}

export function petDragFallbackClip(phase: DragPhase): PixelPetClipId | null {
  if (phase === 'lifted') return 'happy';
  if (phase === 'land') return 'idle';
  if (phase === 'roam') return null;
  return 'move';
}

export function petDragDurationMs(
  phase: DragPhase,
  fallStyle: DragFallStyle,
  reducedMotion: boolean,
) {
  if (reducedMotion || phase === 'roam') return 0;
  if (phase === 'lifted') return 120;
  if (phase === 'circle') return 1500;
  if (phase === 'descend') return 750;
  if (phase === 'land') return 180;
  if (fallStyle === 'shell') return 620;
  if (fallStyle === 'coil' || fallStyle === 'flop') return 950;
  return 820;
}

export type PixelPetDragPose = {
  translateY: number;
  rotateDeg: number;
  scaleX: number;
  scaleY: number;
};

type DragPoseFrame = readonly [
  translateY: number,
  rotateDeg: number,
  scaleX: number,
  scaleY: number,
];

/** Six anatomy-specific keyframes, sampled and eased on the UI thread. */
const FALL_POSE_FRAMES: Record<DragFallStyle, readonly DragPoseFrame[]> = {
  fall: [
    [0, -4, 1, 1],
    [-1, -15, 1.03, 0.96],
    [1, 9, 0.96, 1.05],
    [2, -8, 1.04, 0.95],
    [0, 5, 0.98, 1.03],
    [0, 0, 1, 1],
  ],
  coil: [
    [0, -5, 0.98, 1],
    [1, -18, 0.88, 1.08],
    [2, 12, 0.94, 1.05],
    [0, -10, 0.9, 1.07],
    [-1, 8, 0.97, 1.02],
    [0, 0, 1, 1],
  ],
  flop: [
    [0, 0, 1, 1],
    [-1, -24, 1.05, 0.93],
    [2, 20, 0.96, 1.08],
    [1, -16, 1.06, 0.94],
    [0, 10, 0.98, 1.02],
    [0, 0, 1, 1],
  ],
  tentacle: [
    [0, 0, 1, 1],
    [-2, -10, 0.96, 1.12],
    [2, 12, 1.05, 0.9],
    [0, -8, 0.95, 1.1],
    [2, 8, 1.04, 0.94],
    [0, 0, 1, 1],
  ],
  shell: [
    [0, 0, 1, 1],
    [-1, 4, 1.04, 0.96],
    [1, -3, 0.97, 1.05],
    [0, 5, 1.03, 0.97],
    [-1, -2, 0.98, 1.03],
    [0, 0, 1, 1],
  ],
  wings: [
    [0, -2, 1, 1],
    [-2, -7, 0.99, 1.05],
    [1, 2, 1.02, 0.93],
    [-2, -6, 1, 1.05],
    [1, 1, 0.99, 0.95],
    [0, 0, 1, 1],
  ],
};

/** Samples eased whole-body poses so falling feels continuous at display FPS. */
export function petDragPoseAt(
  fallStyle: DragFallStyle,
  progress: number,
): PixelPetDragPose {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  const frames = FALL_POSE_FRAMES[fallStyle];
  const framePosition = t * (frames.length - 1);
  const fromIndex = Math.floor(framePosition);
  const from = frames[fromIndex];
  const to = frames[Math.min(fromIndex + 1, frames.length - 1)];
  const localProgress = framePosition - fromIndex;
  const eased = localProgress * localProgress * (3 - 2 * localProgress);
  return {
    translateY: from[0] + (to[0] - from[0]) * eased,
    rotateDeg: from[1] + (to[1] - from[1]) * eased,
    scaleX: from[2] + (to[2] - from[2]) * eased,
    scaleY: from[3] + (to[3] - from[3]) * eased,
  };
}

const FRAME_TRACKS: Record<PixelPetClipId, readonly number[]> = {
  idle: [0, 0, 0, 1, 0, 0, 0, 2, 3, 0, 0, 0],
  eat: [0, 1, 0, 1],
  move: [4, 5, 6, 7],
  heal: [0, 8, 9, 10, 11],
  happy: [8, 9, 10, 11],
  skill: [12, 13, 14, 15],
};

/** Home loops a complete gait; care's one-shot move retains its old duration. */
export function petPlayback(clip: PixelPetClipId, loopMovement = false) {
  'worklet';
  return clip === 'move' && loopMovement
    ? { durationMs: 400, loop: true }
    : {
        durationMs: PIXEL_CLIPS[clip].durationMs,
        loop: PIXEL_CLIPS[clip].loop,
      };
}

/** Discrete atlas sampling; no React state or JS timer participates in playback. */
export function petFrameAt(
  clip: PixelPetClipId,
  progress: number,
  loopMovement = false,
) {
  'worklet';
  const playback = petPlayback(clip, loopMovement);
  const t = Math.max(0, Math.min(1, progress));
  if (t === 1 && !playback.loop)
    return clip === 'move' ? 0 : FRAME_TRACKS[clip].at(-1)!;
  const cycleMs = clip === 'move' ? 400 : playback.durationMs;
  const elapsed = (t * playback.durationMs) % cycleMs;
  const track = FRAME_TRACKS[clip];
  return track[
    Math.min(track.length - 1, Math.floor((elapsed / cycleMs) * track.length))
  ];
}

/** Most of each pose interval blends continuously on the UI thread. */
const BLEND_SHARE = 0.82;

/**
 * Like petFrameAt, plus the next pose and how far to fade into it. Reanimated
 * samples this blend on each display refresh instead of holding a static pose.
 */
export function petFrameBlendAt(
  clip: PixelPetClipId,
  progress: number,
  loopMovement = false,
) {
  'worklet';
  const playback = petPlayback(clip, loopMovement);
  const t = Math.max(0, Math.min(1, progress));
  const track = FRAME_TRACKS[clip];
  if (t === 1 && !playback.loop) {
    const last = clip === 'move' ? 0 : track[track.length - 1];
    return { from: last, to: last, mix: 0 };
  }
  const cycleMs = clip === 'move' ? 400 : playback.durationMs;
  const position =
    (((t * playback.durationMs) % cycleMs) / cycleMs) * track.length;
  const index = Math.min(track.length - 1, Math.floor(position));
  const wraps = playback.loop || clip === 'move';
  const next = index + 1 < track.length ? index + 1 : wraps ? 0 : index;
  const local = (position - index - (1 - BLEND_SHARE)) / BLEND_SHARE;
  const k = Math.max(0, Math.min(1, local));
  return { from: track[index], to: track[next], mix: k * k * (3 - 2 * k) };
}

export function petMovementKind(species: PixelPetSpecies) {
  if (
    [
      'alicorn',
      'sphinx',
      'lac_bird',
      'phoenix',
      'garuda',
      'celestial_stag',
    ].includes(species.id)
  )
    return 'wings';
  return species.rig === 'serpentine' ? 'slither' : 'walk';
}

export function petMovementLabel(species: PixelPetSpecies) {
  return { wings: 'Vỗ cánh', slither: 'Lượn mình', walk: 'Đi dạo' }[
    petMovementKind(species)
  ];
}

/** Reference art facing left needs a flip on the outgoing Home pass. */
export function petFacesLeft(species: PixelPetSpecies) {
  return [
    'rune_wolf',
    'sphinx',
    'azure_dragon',
    'white_tiger',
    'celestial_stag',
  ].includes(species.id);
}
