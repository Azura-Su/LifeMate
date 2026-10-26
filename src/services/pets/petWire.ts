import type { PetDNA, PetSlot } from '../../types/pet';
import { parsePetSlot } from './petSlot';
import { PET_SPECIES } from './petCatalog';
const partPattern = new RegExp(
  `^(${PET_SPECIES.map((species) => species.id).join('|')}):[012]$`,
);
const SHAPE_FIELDS = ['head', 'ears', 'body', 'tail', 'eyes'] as const;
const LOW = [920, 850, 920, 850, 900],
  RADIX = [181, 301, 161, 301, 201];
export const PACKED_SHAPE_LIMIT = 530680951941;
type WireDNA = Omit<PetDNA, 'parts' | 'shape' | 'material'> & {
  parts: Record<string, string>;
  shape: number;
  material: {
    paletteSpecies: PetDNA['material']['paletteSpecies'];
    code: number;
  };
};
type WireSlot = Omit<PetSlot, 'pet'> & {
  wireVersion: 1;
  pet: (Omit<NonNullable<PetSlot['pet']>, 'dna'> & { dna: WireDNA }) | null;
};
const invalid = () => new Error('Định dạng đồng bộ thú cưng không hợp lệ.');
function pack(values: number[], radices: number[]) {
  let code = 0;
  for (let i = values.length - 1; i >= 0; i--)
    code = code * radices[i] + values[i];
  return code;
}
function unpack(code: unknown, radices: number[]) {
  const limit = radices.reduce((a, b) => a * b, 1);
  if (
    !Number.isSafeInteger(code) ||
    (code as number) < 0 ||
    (code as number) >= limit
  )
    throw invalid();
  let remaining = code as number;
  return radices.map((radix) => {
    const value = remaining % radix;
    remaining = Math.floor(remaining / radix);
    return value;
  });
}
export function encodePetSlot(slot: PetSlot): WireSlot {
  parsePetSlot(slot, slot.ownerId);
  if (!slot.pet) return { ...slot, wireVersion: 1, pet: null };
  const d = slot.pet.dna,
    m = d.material;
  const dna: WireDNA = {
    ...d,
    parts: Object.fromEntries(
      Object.entries(d.parts).map(([name, p]) => [
        name,
        `${p.species}:${p.variant}`,
      ]),
    ),
    shape: pack(
      SHAPE_FIELDS.map((name, i) => d.shape[name] - LOW[i]),
      RADIX,
    ),
    material: {
      paletteSpecies: m.paletteSpecies,
      code: pack(
        [m.palette, m.pattern, m.patternVariant, m.iris],
        [3, 3, 8, 3],
      ),
    },
  };
  return { ...slot, wireVersion: 1, pet: { ...slot.pet, dna } };
}
export function decodePetSlot(value: unknown, uid: string): PetSlot | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw invalid();
  const { wireVersion, ...slot } = value as WireSlot;
  if (wireVersion !== 1) throw invalid();
  if (!slot.pet) return parsePetSlot(slot, uid);
  const d = slot.pet.dna;
  if (
    !d ||
    typeof d !== 'object' ||
    !d.parts ||
    typeof d.parts !== 'object' ||
    !d.material ||
    Object.keys(d.material).sort().join() !== 'code,paletteSpecies'
  )
    throw invalid();
  const shapes = unpack(d.shape, RADIX),
    material = unpack(d.material.code, [3, 3, 8, 3]);
  const parts = Object.fromEntries(
    Object.entries(d.parts).map(([name, p]) => {
      if (typeof p !== 'string' || !partPattern.test(p)) throw invalid();
      const [species, variant] = p.split(':');
      return [name, { species, variant: Number(variant) }];
    }),
  );
  return parsePetSlot(
    {
      ...slot,
      pet: {
        ...slot.pet,
        dna: {
          ...d,
          parts,
          shape: Object.fromEntries(
            SHAPE_FIELDS.map((name, i) => [name, shapes[i] + LOW[i]]),
          ),
          material: {
            paletteSpecies: d.material.paletteSpecies,
            palette: material[0],
            pattern: material[1],
            patternVariant: material[2],
            iris: material[3],
          },
        },
      },
    },
    uid,
  );
}
