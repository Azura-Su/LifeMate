import type { PetMutation, PetRecord } from '../../../types/pet';
import { applyPetMutation, parsePetSlot } from '../petSlot';

const pet = (id = 'pet-a'): PetRecord => ({
  petId: id,
  ownerId: 'a',
  name: 'Mây',
  dna: {} as never,
  dnaHash: 'a'.repeat(64),
  appearanceHash: 'b'.repeat(64),
  createdAt: 1,
  updatedAt: 1,
});
const create = (id = 'pet-a'): PetMutation => ({
  type: 'create',
  operationId: `create-${id}`,
  baseRevision: 0,
  nextRevision: 1,
  targetPetId: id,
  pet: pet(id),
});
it('atomically admits one pet and treats the exact lost-ACK retry as already committed', () => {
  const op = create();
  const slot = applyPetMutation('a', null, op, 100);
  expect(slot.pet?.petId).toBe('pet-a');
  expect(applyPetMutation('a', slot, op, 200)).toEqual(slot);
  expect(() => applyPetMutation('a', slot, create('pet-b'), 200)).toThrow();
  expect(() =>
    applyPetMutation(
      'a',
      slot,
      { ...op, pet: { ...pet(), name: 'Khác' } },
      200,
    ),
  ).toThrow();
});
it('retains the empty revision fence and blocks old create/rename/delete after replacement', () => {
  const first = applyPetMutation('a', null, create(), 100);
  const del: PetMutation = {
    type: 'delete',
    operationId: 'delete-a',
    targetPetId: 'pet-a',
    baseRevision: 1,
    nextRevision: 2,
    pet: null,
  };
  const empty = applyPetMutation('a', first, del, 200);
  expect(empty.pet).toBeNull();
  expect(empty.revision).toBe(2);
  expect(applyPetMutation('a', empty, del, 300)).toEqual(empty);
  expect(() => applyPetMutation('a', empty, create(), 300)).toThrow();
  const replacement = applyPetMutation(
    'a',
    empty,
    { ...create('pet-b'), baseRevision: 2, nextRevision: 3 },
    300,
  );
  expect(() => applyPetMutation('a', replacement, del, 400)).toThrow();
});
it('does not permit DNA changes via rename, cross-owner changes or unsafe revisions', () => {
  const slot = applyPetMutation('a', null, create(), 100);
  const rename: PetMutation = {
    type: 'rename',
    operationId: 'rename-a',
    targetPetId: 'pet-a',
    baseRevision: 1,
    nextRevision: 2,
    pet: { ...pet(), name: 'Nắng', updatedAt: 2 },
  };
  expect(applyPetMutation('a', slot, rename, 200).pet?.name).toBe('Nắng');
  expect(() => applyPetMutation('b', slot, rename, 200)).toThrow();
  expect(() =>
    applyPetMutation(
      'a',
      slot,
      { ...rename, pet: { ...rename.pet!, dnaHash: 'c'.repeat(64) } },
      200,
    ),
  ).toThrow();
  expect(() =>
    parsePetSlot({ revision: Number.MAX_SAFE_INTEGER + 1 }, 'a'),
  ).toThrow();
});
