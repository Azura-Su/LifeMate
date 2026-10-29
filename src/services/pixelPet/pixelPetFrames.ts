import type { PixelPetSpecies } from './pixelPetCatalog';
import type { PixelPetClipId } from '../../types/pixelPet';
import { PIXEL_CLIPS } from './pixelPetRig';

export const PET_ATLAS = { columns: 4, rows: 4, cellSize: 256 } as const;

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
