import { createHash } from 'node:crypto';
import { digestStringAsync } from 'expo-crypto';
import {
  generatePetDNA as generateVersionedPetDNA,
  parsePetDNA,
  petAppearanceHash,
  petDNAHash,
} from '../petGenetics';
import { PET_SPECIES as ALL_SPECIES, PET_SPECIES_V1 } from '../petCatalog';
import type { PetSpecies } from '../../../types/pet';
const PET_SPECIES = ALL_SPECIES.filter((s) => PET_SPECIES_V1.includes(s.id));
const generatePetDNA = (species: PetSpecies[], seed: string) =>
  generateVersionedPetDNA(species, seed, 'hybrid-3d-v1');

beforeEach(() => {
  jest
    .mocked(digestStringAsync)
    .mockImplementation(async (_algorithm, value) =>
      createHash('sha256').update(value).digest('hex'),
    );
});
const seed = '0123456789abcdef0123456789abcdef';

it('recreates the complete appearance/motion/skill genome independent of selection order', async () => {
  const dna = await generatePetDNA(['cat', 'rabbit', 'owl'], seed);
  expect(await generatePetDNA(['owl', 'cat', 'rabbit'], seed)).toEqual(dna);
  expect(parsePetDNA(JSON.parse(JSON.stringify(dna)))).toEqual(dna);
  expect(dna.animation.idle.clipId).toBeTruthy();
  expect(dna.animation.interaction.clipId).toBeTruthy();
  expect(dna.skill.variant).toBeGreaterThanOrEqual(0);
  expect(dna.animation.idle.variant).toBeGreaterThanOrEqual(0);
  // V1 vectors must survive generator/serialization refactors and asset updates.
  expect(await petDNAHash(dna)).toBe(
    '4ad1d661d41eaa6642b059e40fbdcb91c5cb155dd13569aa5d9a70e63e1c8062',
  );
  expect(await petAppearanceHash(dna)).toBe(
    '629c8f94a9a1045ad71b27fafb0e102194017503617acb309a3c740fcdf5b37e',
  );
});

it('rejects empty, repeated, excessive or unknown species and malformed seeds', async () => {
  for (const species of [
    [],
    ['cat', 'cat'],
    ['cat', 'dog', 'bear', 'fox'],
    ['dragon'],
  ])
    await expect(generatePetDNA(species as never, seed)).rejects.toThrow();
  await expect(generatePetDNA(['cat'], 'abc')).rejects.toThrow();
});

it('includes visible signature parts from every selected species in all 41 species sets', async () => {
  const ids = PET_SPECIES.map((s) => s.id);
  let sets = 0;
  for (let mask = 1; mask < 1 << ids.length; mask++) {
    const species = ids.filter((_, i) => mask & (1 << i));
    if (species.length > 3) continue;
    sets++;
    for (let i = 0; i < 12; i++) {
      const dna = await generatePetDNA(
        species,
        i.toString(16).padStart(32, '0'),
      );
      const sources = Object.values(dna.parts).map((part) => part.species);
      expect(sources.every((source) => species.includes(source))).toBe(true);
      expect(species.every((source) => sources.includes(source))).toBe(true);
      expect(() => parsePetDNA(dna)).not.toThrow();
      expect(dna.parts.wings?.species).not.toBe('cat');
      if (!species.includes('owl')) expect(dna.parts.wings).toBeUndefined();
    }
  }
  expect(sets).toBe(41);
});

it('does not mistake a new seed or animation for a different appearance', async () => {
  const dna = await generatePetDNA(['fox', 'bear'], seed);
  const changed = structuredClone(dna);
  changed.seed = 'ffffffffffffffffffffffffffffffff';
  changed.skill.effectId = changed.skill.effectId === 'fire' ? 'water' : 'fire';
  changed.animation.idle.variant = (changed.animation.idle.variant + 1) % 8;
  expect(await petAppearanceHash(changed)).toBe(await petAppearanceHash(dna));
  expect(await petDNAHash(changed)).not.toBe(await petDNAHash(dna));
});

it('rejects remote genes outside the catalog/style/species/capability contract', async () => {
  const dna = await generatePetDNA(['cat'], seed);
  const mutate = (fn: (value: Record<string, any>) => void) => {
    const value = JSON.parse(JSON.stringify(dna));
    fn(value);
    expect(() => parsePetDNA(value)).toThrow();
  };
  mutate((v) => {
    v.parts.ears.species = 'rabbit';
  });
  mutate((v) => {
    v.shape.head = 9000;
  });
  mutate((v) => {
    v.parts.head.variant = 100;
  });
  mutate((v) => {
    v.catalogVersion = 'unknown';
  });
  mutate((v) => {
    v.skill.emitterSocket = 'arbitrary';
  });
  mutate((v) => {
    v.url = 'https://example.invalid/model';
  });
});

it('measures visual diversity across 10000 seeds per single species and 1000 per hybrid set', async () => {
  const ids = PET_SPECIES.map((s) => s.id);
  let total = 0;
  for (let mask = 1; mask < 1 << ids.length; mask++) {
    const species = ids.filter((_s, i) => mask & (1 << i));
    if (species.length > 3) continue;
    const count = species.length === 1 ? 10000 : 1000,
      seen = new Set<string>();
    for (let i = 0; i < count; i++) {
      const dna = await generatePetDNA(
        species,
        i.toString(16).padStart(32, '0'),
      );
      seen.add(await petAppearanceHash(dna));
    }
    expect((count - seen.size) / count).toBeLessThan(0.01);
    total += count;
  }
  expect(total).toBe(95000);
}, 120000);
