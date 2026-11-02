import { appearanceOptions, petUnlockedLevel, resolvePetAppearance, sleepSceneOptions, validPetAppearance } from '../pixelPetAppearance';
import type { PixelPetState } from '../../../types/pixelPet';

const pet: NonNullable<PixelPetState['pet']> = {
  speciesId: 'celestial_stag', adoptionId: 'a', adoptedAt: 1, totalExp: 4650,
  caredToday: false, level: 20, stage: 'ascended', skillTier: 2,
  levelFloorExp: 4650, nextLevelExp: null,
};

it('keeps legacy automatic appearance and scene selection', () => {
  expect(resolvePetAppearance(pet)).toEqual({ level: 20, stage: 'ascended', sceneLevel: 20 });
  expect(resolvePetAppearance({ ...pet, level: 1, stage: 'hatchling' })).toEqual({ level: 1, stage: 'hatchling', sceneLevel: null });
  expect(sleepSceneOptions('phoenix')).toEqual([]);
});

it('resolves every unlocked Stag form/scene combination independently without changing progression', () => {
  for (const form of appearanceOptions('celestial_stag')) {
    for (const scene of sleepSceneOptions('celestial_stag')) {
      const selection = { appearanceLevel: form.level, sleepSceneLevel: scene.level };
      expect(validPetAppearance(pet, selection)).toBe(true);
      expect(resolvePetAppearance(pet, selection)).toMatchObject({ level: form.level, sceneLevel: scene.level });
    }
  }
  expect(pet).toMatchObject({ level: 20, totalExp: 4650, skillTier: 2 });
});

it('retains unlocked cosmetics after EXP decreases but rejects a locked or different-species choice', () => {
  const lower = { ...pet, level: 1, stage: 'hatchling' as const, maxUnlockedLevel: 8 };
  expect(petUnlockedLevel(lower)).toBe(8);
  expect(resolvePetAppearance(lower, { appearanceLevel: 8, sleepSceneLevel: 6 })).toEqual({ level: 8, stage: 'ascended', sceneLevel: 6 });
  expect(validPetAppearance(lower, { appearanceLevel: 9, sleepSceneLevel: 6 })).toBe(false);
  expect(validPetAppearance({ ...pet, speciesId: 'phoenix' }, { appearanceLevel: 3, sleepSceneLevel: null })).toBe(false);
  expect(validPetAppearance({ ...pet, speciesId: 'phoenix' }, { appearanceLevel: 4, sleepSceneLevel: 2 })).toBe(false);
  expect(resolvePetAppearance(lower, { appearanceLevel: 19, sleepSceneLevel: 20 })).toEqual({ level: 1, stage: 'hatchling', sceneLevel: null });
});

