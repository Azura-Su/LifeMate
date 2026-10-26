import type { PetDNA, PetEffect } from '../../types/pet';
import { speciesInfo } from '../../services/pets/petCatalog';

export type PetAction = {
  type: 'reaction' | 'cast';
  id: number;
  started: number;
};
export type PetInteraction = 'fly' | 'cloudRide' | 'hop';
export type PetIdleMotion = 'breathe' | 'curious' | 'sway';
export type PetFacing = 'front' | 'sideLeft' | 'back' | 'sideRight';

export function resolvePetFacing(rotation: number): PetFacing {
  const fullTurn = Math.PI * 2;
  const normalized = ((rotation % fullTurn) + fullTurn) % fullTurn;
  const sector = Math.round(normalized / (Math.PI / 2)) % 4;
  return (['front', 'sideLeft', 'back', 'sideRight'] as const)[sector];
}

export function consumePetAction(
  previousId: number | null,
  nextId: number | null,
  active: boolean,
  reduced: boolean,
) {
  if (nextId === null) return { consumedId: previousId, shouldPlay: false };
  return {
    consumedId: nextId,
    shouldPlay: nextId !== previousId && active && !reduced,
  };
}

export function createPetArtRecipe(dna: PetDNA) {
  return {
    species: {
      head: dna.parts.head.species,
      ears: dna.parts.ears.species,
      muzzle: dna.parts.muzzle.species,
      body: dna.parts.body.species,
      feet: dna.parts.feet.species,
      tail: dna.parts.tail.species,
      wings: dna.parts.wings?.species ?? null,
    },
    variants: {
      head: dna.parts.head.variant,
      ears: dna.parts.ears.variant,
      muzzle: dna.parts.muzzle.variant,
      body: dna.parts.body.variant,
      feet: dna.parts.feet.variant,
      tail: dna.parts.tail.variant,
      wings: dna.parts.wings?.variant ?? null,
    },
    palette: speciesInfo(dna.material.paletteSpecies).palettes[
      dna.material.palette
    ],
    pattern: dna.material.pattern,
    patternVariant: dna.material.patternVariant,
    iris: dna.material.iris,
    shape: dna.shape,
    seed: dna.seed,
  };
}

export function resolvePetPresentation(
  dna: PetDNA,
  action: PetAction | null,
  active: boolean,
  reduced: boolean,
): {
  idle: boolean;
  idleMotion: PetIdleMotion | null;
  interaction: PetInteraction | null;
  effect: PetEffect | null;
} {
  if (!active || reduced)
    return {
      idle: false,
      idleMotion: null,
      interaction: null,
      effect: null,
    };
  const idleMotion = dna.animation.idle.clipId as PetIdleMotion;
  if (!action)
    return {
      idle: true,
      idleMotion,
      interaction: null,
      effect: null,
    };
  if (action.type === 'cast')
    return {
      idle: false,
      idleMotion,
      interaction: null,
      effect: dna.skill.effectId,
    };
  const interaction: PetInteraction =
    dna.animation.interaction.clipId === 'greet'
      ? 'fly'
      : dna.animation.interaction.clipId === 'bounce'
        ? 'cloudRide'
        : 'hop';
  return { idle: false, idleMotion, interaction, effect: null };
}
