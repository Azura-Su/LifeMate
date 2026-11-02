import type { PixelPetAppearance, PixelPetSpeciesId, PixelPetState } from '../../types/pixelPet';
import { petUnlocks, stageForLevel } from './pixelPetGuide';

export const STAG_APPEARANCE_LEVELS = [1, 3, 4, 5, 7, 8, 9, 11, 13, 15, 17, 19] as const;
export const STAGE_APPEARANCE_LEVELS = [1, 4, 8] as const;
export type PetAppearanceOption = { level: number; name: string };
type OwnedPet = NonNullable<PixelPetState['pet']>;

export function appearanceOptions(speciesId: PixelPetSpeciesId): PetAppearanceOption[] {
  return (speciesId === 'celestial_stag' ? STAG_APPEARANCE_LEVELS : STAGE_APPEARANCE_LEVELS)
    .map((level) => ({
      level,
      name: level === 1 ? 'Ấu thể' : level === 4 ? 'Trưởng thành' : level === 8 ? 'Thăng hoa' : `Hình dạng Lv ${level}`,
    }));
}

export function sleepSceneOptions(speciesId: PixelPetSpeciesId): PetAppearanceOption[] {
  return petUnlocks(speciesId, '').filter((unlock) => unlock.kind === 'scene')
    .map(({ level, name }) => ({ level, name }));
}

export function petUnlockedLevel(pet: OwnedPet): number {
  return Math.max(1, Math.min(20, Math.max(pet.level, pet.maxUnlockedLevel ?? pet.level)));
}

export function validPetAppearance(
  pet: OwnedPet,
  selection: PixelPetAppearance,
): boolean {
  const max = petUnlockedLevel(pet);
  return [
    [selection.appearanceLevel, appearanceOptions(pet.speciesId)],
    [selection.sleepSceneLevel, sleepSceneOptions(pet.speciesId)],
  ].every(([level, options]) => level === null || (
    typeof level === 'number' && level <= max &&
    (options as PetAppearanceOption[]).some((option) => option.level === level)
  ));
}

/** Presentation only: never replaces EXP, actual level or skill permissions. */
export function resolvePetAppearance(pet: OwnedPet, draft?: PixelPetAppearance) {
  const selection = draft ?? {
    appearanceLevel: pet.appearanceLevel ?? null,
    sleepSceneLevel: pet.sleepSceneLevel ?? null,
  };
  const valid = validPetAppearance(pet, selection);
  const level = valid ? selection.appearanceLevel ?? pet.level : pet.level;
  const availableScenes = sleepSceneOptions(pet.speciesId).filter((scene) => scene.level <= pet.level);
  const sceneLevel = valid && selection.sleepSceneLevel !== null
    ? selection.sleepSceneLevel
    : availableScenes[availableScenes.length - 1]?.level ?? null;
  const stage = valid && selection.appearanceLevel !== null ? stageForLevel(level) : pet.stage;
  return { level, stage, sceneLevel };
}
