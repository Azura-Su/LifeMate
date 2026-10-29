import type { PixelPetSpeciesId } from '../../types/pixelPet';

export type PixelPetExpression = 'excited';

export type PixelPetExpressionPlayback = {
  frameTrack: readonly number[];
  durationMs: number;
};

/** Authored resting/blink frames (0–3) and reaction frames (8–11). */
const DEFAULT_TRACKS: Record<PixelPetExpression, readonly number[]> = {
  excited: [8, 9, 10, 11, 10, 9],
};

/** These two atlases have especially readable blink and reaction poses. */
const SPECIES_TRACKS: Partial<
  Record<
    PixelPetSpeciesId,
    Partial<Record<PixelPetExpression, readonly number[]>>
  >
> = {
  rune_wolf: {
    excited: [8, 9, 10, 11, 10, 9],
  },
  nine_tail_fox: {
    excited: [9, 10, 11, 10, 9],
  },
};

const DURATION_MS: Record<PixelPetExpression, number> = {
  excited: 1050,
};

export function pixelPetExpressionPlayback(
  speciesId: PixelPetSpeciesId,
  expression: PixelPetExpression,
): PixelPetExpressionPlayback {
  return {
    frameTrack:
      SPECIES_TRACKS[speciesId]?.[expression] ?? DEFAULT_TRACKS[expression],
    durationMs: DURATION_MS[expression],
  };
}
