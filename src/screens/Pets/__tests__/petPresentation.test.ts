import { generatePetDNA } from '../../../services/pets/petGenetics';
import {
  consumePetAction,
  createPetArtRecipe,
  resolvePetFacing,
  resolvePetPresentation,
} from '../petPresentation';
import { createHash } from 'node:crypto';
import { digestStringAsync } from 'expo-crypto';

beforeEach(() => {
  jest
    .mocked(digestStringAsync)
    .mockImplementation(async (_algorithm, value) =>
      createHash('sha256').update(value).digest('hex'),
    );
});

const dna = async (
  interaction: 'greet' | 'bounce' | 'happy' = 'greet',
  idle: 'breathe' | 'curious' | 'sway' = 'breathe',
) => {
  const result = await generatePetDNA(
    ['cat', 'fox', 'rabbit'],
    '0123456789abcdef0123456789abcdef',
  );
  return {
    ...result,
    animation: {
      ...result.animation,
      idle: { ...result.animation.idle, clipId: idle },
      interaction: { clipId: interaction, variant: 2 },
    },
  };
};

it.each([
  [0, 'front'],
  [Math.PI / 2, 'sideLeft'],
  [Math.PI, 'back'],
  [Math.PI * 1.5, 'sideRight'],
  [Math.PI * 2, 'front'],
] as const)(
  'maps swipe rotation %s to a distinct 2D facing',
  (angle, facing) => {
    expect(resolvePetFacing(angle)).toBe(facing);
  },
);

it.each(['breathe', 'curious', 'sway'] as const)(
  'keeps the DNA-selected %s idle motion',
  async (idleMotion) => {
    expect(
      resolvePetPresentation(await dna('greet', idleMotion), null, true, false)
        .idleMotion,
    ).toBe(idleMotion);
  },
);

it('builds a deterministic art recipe from the chosen DNA parts and palette', async () => {
  const first = createPetArtRecipe(await dna());
  const second = createPetArtRecipe(await dna());
  expect(first).toEqual(second);
  expect(
    Object.values(first.species)
      .filter(Boolean)
      .every((id) => ['cat', 'fox', 'rabbit'].includes(id!)),
  ).toBe(true);
  expect(first.palette).toHaveLength(3);
});

it.each([
  ['greet', 'fly'],
  ['bounce', 'cloudRide'],
  ['happy', 'hop'],
] as const)('maps %s to its 2D interaction', async (clip, interaction) => {
  expect(
    resolvePetPresentation(
      await dna(clip),
      { type: 'reaction', id: 1, started: 10 },
      true,
      false,
    ),
  ).toEqual({
    idle: false,
    idleMotion: 'breathe',
    interaction,
    effect: null,
  });
});

it('uses the existing skill for casts and suppresses all animation when inactive or reduced', async () => {
  const pet = await dna('bounce');
  const cast = { type: 'cast' as const, id: 2, started: 20 };
  expect(resolvePetPresentation(pet, cast, true, false).effect).toBe(
    pet.skill.effectId,
  );
  expect(resolvePetPresentation(pet, cast, true, false).idleMotion).toBe(
    'breathe',
  );
  expect(resolvePetPresentation(pet, null, false, false)).toEqual({
    idle: false,
    idleMotion: null,
    interaction: null,
    effect: null,
  });
  expect(resolvePetPresentation(pet, cast, true, true)).toEqual({
    idle: false,
    idleMotion: null,
    interaction: null,
    effect: null,
  });
});

it('does not replay a consumed action after an equivalent DNA render or preference change', () => {
  expect(consumePetAction(null, 7, true, false)).toEqual({
    consumedId: 7,
    shouldPlay: true,
  });
  expect(consumePetAction(7, 7, true, false)).toEqual({
    consumedId: 7,
    shouldPlay: false,
  });
  expect(consumePetAction(null, 8, true, true)).toEqual({
    consumedId: 8,
    shouldPlay: false,
  });
  expect(consumePetAction(8, 8, true, false)).toEqual({
    consumedId: 8,
    shouldPlay: false,
  });
  expect(consumePetAction(null, 9, false, false)).toEqual({
    consumedId: 9,
    shouldPlay: false,
  });
  expect(consumePetAction(9, 9, true, false).shouldPlay).toBe(false);
});
