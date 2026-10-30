import type { PixelPetClipId, PixelPetSpeciesId } from '../../types/pixelPet';

type HomeSpeciesId = Exclude<PixelPetSpeciesId, 'celestial_stag'>;

const FRAME_TRACKS: Record<PixelPetClipId, readonly number[]> = {
  idle: [0, 1, 2, 3],
  eat: [0, 1, 2, 3],
  move: [4, 5, 6, 7],
  heal: [12, 13, 14, 15],
  happy: [8, 9, 10, 11],
  skill: [12, 13, 14, 15],
};

// The wolf uses a mirrored six-pose stride. Reversing the middle poses keeps
// the gait continuous instead of snapping from the last paw position to frame 0.
const RUNE_WOLF_MOVE_TRACK = [4, 5, 6, 7, 6, 5] as const;
const QILIN_MOVE_TRACK = [0, 1, 2, 3, 4, 5, 6, 7] as const;
// Sit, lift muzzle and hold the open-mouth howl, then settle back down.
const RUNE_WOLF_HOWL_TRACK = [12, 13, 13, 13, 14, 15] as const;

const MOVE_CYCLE_MS: Record<HomeSpeciesId, number> = {
  nine_tail_fox: 560,
  qilin: 620,
  alicorn: 580,
  rune_wolf: 720,
  black_tortoise: 980,
  sphinx: 700,
  centaur: 680,
  white_tiger: 500,
  azure_dragon: 840,
  koi_dragon: 700,
  scylla: 920,
  lac_bird: 660,
  phoenix: 540,
  anubis: 740,
  garuda: 600,
};

export function homePetFrameTrack(
  clip: PixelPetClipId,
  speciesId?: HomeSpeciesId,
) {
  if (clip === 'move' && speciesId === 'qilin') return QILIN_MOVE_TRACK;
  if (clip === 'skill' && speciesId === 'rune_wolf')
    return RUNE_WOLF_HOWL_TRACK;
  if (clip === 'move' && speciesId === 'rune_wolf') return RUNE_WOLF_MOVE_TRACK;
  return FRAME_TRACKS[clip];
}

export function homePetPlayback(
  speciesId: HomeSpeciesId,
  clip: PixelPetClipId,
  loopMovement: boolean,
) {
  if (clip === 'move' && loopMovement)
    return { durationMs: MOVE_CYCLE_MS[speciesId], loop: true };
  if (clip === 'idle') return { durationMs: 2200, loop: true };
  return {
    durationMs: clip === 'skill' || clip === 'heal' ? 2200 : 1800,
    loop: false,
  };
}
