import { createHash } from 'node:crypto';
import { digestStringAsync } from 'expo-crypto';
import { generatePetDNA } from '../petGenetics';
import { encodePetSlot, decodePetSlot, PACKED_SHAPE_LIMIT } from '../petWire';
beforeEach(() => {
  jest
    .mocked(digestStringAsync)
    .mockImplementation(async (_a, v) =>
      createHash('sha256').update(v).digest('hex'),
    );
});
it('losslessly transports all shape/material extrema and parts without changing canonical DNA', async () => {
  const dna = await generatePetDNA(['cat', 'rabbit', 'owl'], '1'.repeat(32));
  for (const high of [false, true]) {
    dna.shape = high
      ? { head: 1100, ears: 1150, body: 1080, tail: 1150, eyes: 1100 }
      : { head: 920, ears: 850, body: 920, tail: 850, eyes: 900 };
    dna.material = {
      paletteSpecies: 'cat',
      palette: high ? 2 : 0,
      pattern: high ? 2 : 0,
      patternVariant: high ? 7 : 0,
      iris: high ? 2 : 0,
    };
    const slot = {
      schemaVersion: 1 as const,
      ownerId: 'a',
      revision: 1,
      previousRevision: 0,
      lastOperationId: 'create-a',
      updatedAt: 1,
      pet: {
        petId: 'a',
        ownerId: 'a',
        name: 'Mây',
        dna,
        dnaHash: 'a'.repeat(64),
        appearanceHash: 'b'.repeat(64),
        createdAt: 1,
        updatedAt: 1,
      },
    };
    const encoded = encodePetSlot(slot);
    expect(encoded.pet!.dna.shape).toBe(high ? PACKED_SHAPE_LIMIT - 1 : 0);
    expect(decodePetSlot(JSON.parse(JSON.stringify(encoded)), 'a')).toEqual(
      slot,
    );
    for (const value of [-1, 1.5, PACKED_SHAPE_LIMIT, Infinity])
      expect(() =>
        decodePetSlot(
          {
            ...encoded,
            pet: { ...encoded.pet, dna: { ...encoded.pet!.dna, shape: value } },
          },
          'a',
        ),
      ).toThrow();
    expect(() =>
      decodePetSlot(
        {
          ...encoded,
          pet: {
            ...encoded.pet,
            dna: {
              ...encoded.pet!.dna,
              parts: { ...encoded.pet!.dna.parts, head: 'cat:00' },
            },
          },
        },
        'a',
      ),
    ).toThrow();
  }
});
