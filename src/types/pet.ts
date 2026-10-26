export type PetSpecies =
  | 'cat'
  | 'dog'
  | 'rabbit'
  | 'fox'
  | 'bear'
  | 'owl'
  | 'panda'
  | 'hamster'
  | 'penguin'
  | 'deer'
  | 'tiger'
  | 'pig';
export type PetGeneratorVersion = 'hybrid-3d-v1' | 'hybrid-3d-v2';
export type PetPartSlot =
  'head' | 'ears' | 'muzzle' | 'body' | 'feet' | 'tail' | 'wings';
export type PetEffect =
  | 'fire'
  | 'water'
  | 'wind'
  | 'lightning'
  | 'ice'
  | 'light'
  | 'bubbles'
  | 'leaves';
export type PetPart = { species: PetSpecies; variant: number };
export type PetMotion = { clipId: string; variant: number };
export type PetDNA = {
  schemaVersion: 1;
  generatorVersion: PetGeneratorVersion;
  catalogVersion: 'chibi-v1' | 'chibi-v2';
  seed: string;
  species: PetSpecies[];
  parts: Record<Exclude<PetPartSlot, 'wings'>, PetPart> & { wings?: PetPart };
  shape: {
    head: number;
    ears: number;
    body: number;
    tail: number;
    eyes: number;
  };
  material: {
    paletteSpecies: PetSpecies;
    palette: number;
    pattern: number;
    patternVariant: number;
    iris: number;
  };
  animation: { idle: PetMotion; interaction: PetMotion };
  skill: { effectId: PetEffect; variant: number };
};
export type PetRecord = {
  petId: string;
  ownerId: string;
  name: string;
  dna: PetDNA;
  dnaHash: string;
  appearanceHash: string;
  createdAt: number;
  updatedAt: number;
};
export type PetSlot = {
  schemaVersion: 1;
  ownerId: string;
  revision: number;
  previousRevision: number;
  lastOperationId: string;
  updatedAt: number;
  pet: PetRecord | null;
};
export type PetMutation = {
  operationId: string;
  baseRevision: number;
  nextRevision: number;
  type: 'create' | 'rename' | 'delete';
  targetPetId: string;
  pet: PetRecord | null;
};
export type PetCache = {
  schemaVersion: 1;
  slot: PetSlot | null;
  pending: PetMutation | null;
  draft: PetRecord | null;
};
