import { readFileSync } from 'fs';
import { join } from 'path';
import { PIXEL_PET_EXCLUSIVE, PIXEL_PET_SPECIES } from '../pixelPetCatalog';
import { CARE_TASKS, LEVEL_THRESHOLDS, petUnlocks } from '../pixelPetGuide';

const config = readFileSync(
  join(__dirname, '../../../../supabase/functions/pet-access/expConfig.mjs'),
  'utf8',
);

it('shows the same EXP per task as the backend policy', () => {
  for (const task of CARE_TASKS)
    expect(config).toMatch(new RegExp(`\\b${task.id}: ${task.exp},`));
});

it('shows the same level thresholds as the backend policy', () => {
  expect(config).toContain(`${LEVEL_THRESHOLDS.join(', ')},`);
});

it('gives every species its own skill and outfits', () => {
  const names = new Set<string>();
  for (const species of [...PIXEL_PET_SPECIES, ...PIXEL_PET_EXCLUSIVE]) {
    const unlocks = petUnlocks(species.id, species.skill);
    expect(
      unlocks.filter((u) => u.kind !== 'scene').map((u) => u.level),
    ).toEqual([3, 4, 5, 6, 8, 8, 10]);
    for (const unlock of unlocks.filter((u) => u.kind !== 'stage')) {
      if (unlock.level !== 5) {
        expect(names.has(unlock.name)).toBe(false);
        names.add(unlock.name);
      }
    }
  }
});

it('lists the Home sleep scene at level 2 only for species that have one', () => {
  expect(petUnlocks('garuda', 'x')[0]).toEqual({
    level: 2,
    kind: 'scene',
    name: 'Chùa núi mây',
  });
  expect(petUnlocks('phoenix', 'x').some((u) => u.kind === 'scene')).toBe(
    false,
  );
});
