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
  const backend = config
    .match(/LEVEL_THRESHOLDS = Object\.freeze\(\[([^\]]*)\]/)?.[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number);
  expect(backend).toEqual(LEVEL_THRESHOLDS);
  expect(LEVEL_THRESHOLDS).toHaveLength(20);
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
  expect(
    petUnlocks('celestial_stag', 'x').filter((u) => u.kind === 'scene'),
  ).toEqual([
    { level: 2, kind: 'scene', name: 'Vườn hoa thiên lộc' },
    { level: 4, kind: 'scene', name: 'Vườn suối nhỏ' },
    { level: 6, kind: 'scene', name: 'Cổ thụ hoa anh linh' },
    { level: 8, kind: 'scene', name: 'Đền đá rêu phong' },
    { level: 10, kind: 'scene', name: 'Cổ thụ rune' },
    { level: 12, kind: 'scene', name: 'Rừng lông vũ' },
    { level: 14, kind: 'scene', name: 'Thánh địa vàng kim' },
    { level: 16, kind: 'scene', name: 'Cây sao trời' },
    { level: 18, kind: 'scene', name: 'Cung điện sapphire' },
    { level: 20, kind: 'scene', name: 'Thiên giới ngọc lục bảo' },
  ]);
});
