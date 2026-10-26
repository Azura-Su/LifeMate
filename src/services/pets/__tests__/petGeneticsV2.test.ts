import { createHash } from 'node:crypto';
import { digestStringAsync } from 'expo-crypto';
import {
  generatePetDNA,
  parsePetDNA,
  petDNAHash,
  petAppearanceHash,
} from '../petGenetics';
import { encodePetSlot, decodePetSlot } from '../petWire';
import { PET_SPECIES } from '../petCatalog';
import type { PetSpecies, PetSlot } from '../../../types/pet';
const seed = '0123456789abcdef0123456789abcdef';
beforeEach(() => {
  jest
    .mocked(digestStringAsync)
    .mockImplementation(async (_algorithm, value) =>
      createHash('sha256').update(value).digest('hex'),
    );
});
it('keeps the frozen V1 seed vector while new drafts use the V2 contract', async () => {
  const legacy = await generatePetDNA(
    ['cat', 'rabbit', 'owl'],
    seed,
    'hybrid-3d-v1',
  );
  expect(await petDNAHash(legacy)).toBe(
    '4ad1d661d41eaa6642b059e40fbdcb91c5cb155dd13569aa5d9a70e63e1c8062',
  );
  const next = await generatePetDNA(['panda', 'penguin', 'fox'], seed);
  expect(next).toMatchObject({
    generatorVersion: 'hybrid-3d-v2',
    catalogVersion: 'chibi-v2',
  });
  expect(await generatePetDNA(['fox', 'penguin', 'panda'], seed)).toEqual(next);
  const slot: PetSlot = {
    schemaVersion: 1,
    ownerId: 'a',
    revision: 1,
    previousRevision: 0,
    lastOperationId: 'create-a',
    updatedAt: 1,
    pet: {
      petId: 'pet-a',
      ownerId: 'a',
      name: 'Mây',
      dna: next,
      dnaHash: await petDNAHash(next),
      appearanceHash: await petAppearanceHash(next),
      createdAt: 1,
      updatedAt: 1,
    },
  };
  expect(decodePetSlot(encodePetSlot(slot), 'a')).toEqual(slot);
});
it('covers all 298 sets of one to three animals, including signature collisions and both bird species', async () => {
  expect(PET_SPECIES).toHaveLength(12);
  const ids = PET_SPECIES.map((s) => s.id);
  let sets = 0;
  for (let mask = 1; mask < 1 << ids.length; mask++) {
    const species = ids.filter((_, i) => mask & (1 << i));
    if (species.length > 3) continue;
    sets++;
    for (let i = 0; i < 3; i++) {
      const dna = await generatePetDNA(
        species,
        (mask * 10 + i).toString(16).padStart(32, '0'),
      );
      const sources = Object.values(dna.parts).map((p) => p.species);
      expect(species.every((s) => sources.includes(s))).toBe(true);
      expect(sources.every((s) => species.includes(s))).toBe(true);
      expect(parsePetDNA(JSON.parse(JSON.stringify(dna)))).toEqual(dna);
      const birds = species.filter((s) => s === 'owl' || s === 'penguin');
      if (birds.length) expect(birds).toContain(dna.parts.wings?.species);
      else expect(dna.parts.wings).toBeUndefined();
    }
  }
  expect(sets).toBe(298);
});
it('rejects version spoofing, new animals under V1, and wings from an unselected bird', async () => {
  const next = await generatePetDNA(['panda', 'penguin'] as PetSpecies[], seed);
  const bad = JSON.parse(JSON.stringify(next));
  bad.generatorVersion = 'hybrid-3d-v1';
  bad.catalogVersion = 'chibi-v1';
  expect(() => parsePetDNA(bad)).toThrow();
  const mismatched = JSON.parse(JSON.stringify(next));
  mismatched.catalogVersion = 'chibi-v1';
  expect(() => parsePetDNA(mismatched)).toThrow();
  const wings = JSON.parse(JSON.stringify(next));
  wings.parts.wings.species = 'owl';
  expect(() => parsePetDNA(wings)).toThrow();
  await expect(
    generatePetDNA(['panda'] as PetSpecies[], seed, 'hybrid-3d-v1'),
  ).rejects.toThrow();
});

it('measures V2 appearance collisions across 406000 seeded drafts', async () => {
  const ids = PET_SPECIES.map((s) => s.id);
  let total = 0;
  for (let mask = 1; mask < 1 << ids.length; mask++) {
    const species = ids.filter((_, i) => mask & (1 << i));
    if (species.length > 3) continue;
    const count = species.length === 1 ? 10000 : 1000,
      seen = new Set<string>();
    for (let i = 0; i < count; i++)
      seen.add(
        await petAppearanceHash(
          await generatePetDNA(species, i.toString(16).padStart(32, '0')),
        ),
      );
    expect((count - seen.size) / count).toBeLessThan(0.01);
    total += count;
  }
  expect(total).toBe(406000);
}, 240000);
