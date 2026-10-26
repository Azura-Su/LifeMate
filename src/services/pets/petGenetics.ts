import {
  CryptoDigestAlgorithm,
  digestStringAsync,
  getRandomBytesAsync,
} from 'expo-crypto';
import type {
  PetDNA,
  PetPartSlot,
  PetSpecies,
  PetGeneratorVersion,
} from '../../types/pet';
import {
  PART_VARIANTS,
  PET_EFFECTS,
  PET_IDLE_CLIPS,
  PET_REACTION_CLIPS,
  PET_SLOTS,
  PET_SPECIES,
  PET_SPECIES_V1,
  PET_BIRDS,
} from './petCatalog';

const invalid = () =>
  new Error('Cấu hình thú cưng không hợp lệ hoặc cần cập nhật ứng dụng.');
export const hashPetValue = (value: unknown) =>
  digestStringAsync(CryptoDigestAlgorithm.SHA256, canonicalPetJSON(value));
export function canonicalPetJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalPetJSON).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonicalPetJSON((value as Record<string, unknown>)[k])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}
export async function newPetSeed() {
  return Array.from(await getRandomBytesAsync(16), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
}
function validateSpecies(
  input: unknown,
  legacy = false,
): input is PetSpecies[] {
  return (
    Array.isArray(input) &&
    input.length >= 1 &&
    input.length <= 3 &&
    new Set(input).size === input.length &&
    input.every((id) =>
      legacy
        ? PET_SPECIES_V1.includes(id)
        : PET_SPECIES.some((s) => s.id === id),
    )
  );
}
export async function generatePetDNA(
  input: PetSpecies[],
  seed: string,
  version: PetGeneratorVersion = 'hybrid-3d-v2',
): Promise<PetDNA> {
  const legacy = version === 'hybrid-3d-v1';
  if (
    !['hybrid-3d-v1', 'hybrid-3d-v2'].includes(version) ||
    !validateSpecies(input, legacy) ||
    !/^[0-9a-f]{32}$/.test(seed)
  )
    throw invalid();
  const species = [...input].sort();
  const streams = await Promise.all(
    ['parts', 'shape', 'motion', 'skill'].map(async (domain) => {
      const blocks = await Promise.all(
        [0, 1, 2, 3].map((counter) =>
          hashPetValue([version, seed, domain, counter]),
        ),
      );
      const values = blocks
        .join('')
        .match(/.{8}/g)!
        .map((hex) => parseInt(hex, 16));
      return (n: number) => {
        const bound = Math.floor(0x100000000 / n) * n;
        let value: number | undefined;
        do {
          value = values.shift();
          if (value === undefined) throw invalid();
        } while (value >= bound);
        return value % n;
      };
    }),
  );
  const [part, shape, motion, skill] = streams;
  const chooseSpecies = () => species[part(species.length)];
  const parts: PetDNA['parts'] = Object.fromEntries(
    PET_SLOTS.filter((slot) => slot !== 'wings').map((slot) => [
      slot,
      { species: chooseSpecies(), variant: part(PART_VARIANTS) },
    ]),
  ) as PetDNA['parts'];
  // Assign a recognizable, non-overlapping signature before filling the rest.
  const signatures: Record<string, Exclude<PetPartSlot, 'wings'> | 'wings'> = {
    cat: 'head',
    dog: 'muzzle',
    rabbit: 'ears',
    fox: 'tail',
    bear: 'body',
    owl: 'wings',
  };
  if (legacy) {
    for (const source of species)
      parts[signatures[source]] = {
        species: source,
        variant: part(PART_VARIANTS),
      };
    const mammals = species.filter((id) => id !== 'owl');
    if (mammals.length && parts.body.species === 'owl')
      parts.body.species = mammals[part(mammals.length)];
  } else {
    const preferences: Record<PetSpecies, PetPartSlot[]> = {
      cat: ['head', 'ears', 'muzzle'],
      dog: ['muzzle', 'ears', 'head'],
      rabbit: ['ears', 'tail', 'feet'],
      fox: ['tail', 'ears', 'head'],
      bear: ['body', 'ears', 'feet'],
      owl: ['wings', 'head', 'muzzle'],
      panda: ['head', 'body', 'ears'],
      hamster: ['head', 'body', 'muzzle'],
      penguin: ['wings', 'muzzle', 'body'],
      deer: ['ears', 'body', 'tail'],
      tiger: ['head', 'body', 'tail'],
      pig: ['muzzle', 'ears', 'tail'],
    };
    const birds = species.filter((id) => PET_BIRDS.includes(id));
    if (birds.length)
      parts.wings = {
        species: birds[part(birds.length)],
        variant: part(PART_VARIANTS),
      };
    const used = new Set<PetPartSlot>();
    for (const source of species) {
      const slot = preferences[source].find((slot) => !used.has(slot));
      if (!slot) throw invalid(); // Each preference list has three distinct slots for at most three animals.
      used.add(slot);
      parts[slot] = { species: source, variant: part(PART_VARIANTS) };
    }
  }
  const dna: PetDNA = {
    schemaVersion: 1,
    generatorVersion: version,
    catalogVersion: legacy ? 'chibi-v1' : 'chibi-v2',
    seed,
    species,
    parts,
    shape: {
      head: 920 + shape(181),
      ears: 850 + shape(301),
      body: 920 + shape(161),
      tail: 850 + shape(301),
      eyes: 900 + shape(201),
    },
    material: {
      paletteSpecies: chooseSpecies(),
      palette: part(3),
      pattern: part(3),
      patternVariant: part(8),
      iris: part(3),
    },
    animation: {
      idle: { clipId: PET_IDLE_CLIPS[motion(3)], variant: motion(8) },
      interaction: {
        clipId: PET_REACTION_CLIPS[motion(3)],
        variant: motion(8),
      },
    },
    skill: { effectId: PET_EFFECTS[skill(8)].id, variant: skill(8) },
  };
  return parsePetDNA(dna);
}
const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).length === allowed.length &&
  Object.keys(v).every((k) => allowed.includes(k));
const integer = (v: unknown, min: number, max: number) =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validMotion(v: unknown, clips: readonly string[]) {
  return (
    object(v) &&
    keys(v, ['clipId', 'variant']) &&
    clips.includes(v.clipId) &&
    integer(v.variant, 0, 7)
  );
}

export function parsePetDNA(v: unknown): PetDNA {
  if (
    !object(v) ||
    !keys(v, [
      'schemaVersion',
      'generatorVersion',
      'catalogVersion',
      'seed',
      'species',
      'parts',
      'shape',
      'material',
      'animation',
      'skill',
    ]) ||
    v.schemaVersion !== 1 ||
    !(
      (v.generatorVersion === 'hybrid-3d-v1' &&
        v.catalogVersion === 'chibi-v1') ||
      (v.generatorVersion === 'hybrid-3d-v2' && v.catalogVersion === 'chibi-v2')
    ) ||
    typeof v.seed !== 'string' ||
    !/^[0-9a-f]{32}$/.test(v.seed) ||
    !validateSpecies(v.species, v.generatorVersion === 'hybrid-3d-v1') ||
    v.species.join() !== [...v.species].sort().join()
  )
    throw invalid();
  const legacy = v.generatorVersion === 'hybrid-3d-v1';
  const birds = v.species.filter((id: PetSpecies) =>
    legacy ? id === 'owl' : PET_BIRDS.includes(id),
  );
  if (
    !object(v.parts) ||
    !keys(
      v.parts,
      PET_SLOTS.filter((slot) => slot !== 'wings' || birds.length > 0),
    ) ||
    !Object.entries(v.parts).every(
      ([slot, p]) =>
        object(p) &&
        keys(p, ['species', 'variant']) &&
        v.species.includes(p.species) &&
        integer(p.variant, 0, PART_VARIANTS - 1) &&
        (slot !== 'wings' || birds.includes(p.species)),
    ) ||
    !v.species.every((id: string) =>
      Object.values(v.parts).some((p: any) => p.species === id),
    )
  )
    throw invalid();
  if (legacy && v.species.length > 1 && v.parts.body.species === 'owl')
    throw invalid();
  if (
    !object(v.shape) ||
    !keys(v.shape, ['head', 'ears', 'body', 'tail', 'eyes']) ||
    !integer(v.shape.head, 920, 1100) ||
    !integer(v.shape.ears, 850, 1150) ||
    !integer(v.shape.body, 920, 1080) ||
    !integer(v.shape.tail, 850, 1150) ||
    !integer(v.shape.eyes, 900, 1100)
  )
    throw invalid();
  if (
    !object(v.material) ||
    !keys(v.material, [
      'paletteSpecies',
      'palette',
      'pattern',
      'patternVariant',
      'iris',
    ]) ||
    !v.species.includes(v.material.paletteSpecies) ||
    !integer(v.material.palette, 0, 2) ||
    !integer(v.material.pattern, 0, 2) ||
    !integer(v.material.patternVariant, 0, 7) ||
    !integer(v.material.iris, 0, 2)
  )
    throw invalid();
  if (
    !object(v.animation) ||
    !keys(v.animation, ['idle', 'interaction']) ||
    !validMotion(v.animation.idle, PET_IDLE_CLIPS) ||
    !validMotion(v.animation.interaction, PET_REACTION_CLIPS)
  )
    throw invalid();
  if (
    !object(v.skill) ||
    !keys(v.skill, ['effectId', 'variant']) ||
    !PET_EFFECTS.some((e) => e.id === v.skill.effectId) ||
    !integer(v.skill.variant, 0, 7)
  )
    throw invalid();
  return v as PetDNA;
}
export const petDNAHash = (dna: PetDNA) => hashPetValue(dna);
export const petAppearanceHash = (dna: PetDNA) =>
  hashPetValue({
    catalogVersion: dna.catalogVersion,
    parts: dna.parts,
    shape: dna.shape,
    material: dna.material,
  });
