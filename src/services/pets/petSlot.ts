import type { PetMutation, PetRecord, PetSlot } from '../../types/pet';
import { canonicalPetJSON, parsePetDNA } from './petGenetics';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const HASH = /^[0-9a-f]{64}$/;
export const PET_REVISION_LIMIT = 1_000_000_000;
export const petConflict = () =>
  new Error(
    'Thú cưng đã thay đổi trên thiết bị khác. Đã cập nhật trạng thái mới nhất.',
  );
const invalid = () => new Error('Dữ liệu thú cưng không hợp lệ.');
const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).length === allowed.length &&
  Object.keys(v).every((k) => allowed.includes(k));
const integer = (v: unknown, max = 253402300799999) =>
  Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
export function normalizePetName(value: string) {
  const name = value.normalize('NFC').trim();
  const count =
    typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(name)]
          .length
      : Array.from(name).length;
  if (!name || count > 24 || name.length > 96 || /[\p{Cc}\p{Cf}]/u.test(name))
    throw new Error(
      'Tên thú cưng cần từ1 đến24 ký tự, không có ký tự điều khiển.',
    );
  return name;
}
export function parsePetRecord(value: unknown, uid: string): PetRecord {
  if (
    !object(value) ||
    !keys(value, [
      'petId',
      'ownerId',
      'name',
      'dna',
      'dnaHash',
      'appearanceHash',
      'createdAt',
      'updatedAt',
    ]) ||
    !ID.test(value.petId) ||
    value.ownerId !== uid ||
    typeof value.name !== 'string' ||
    normalizePetName(value.name) !== value.name ||
    !HASH.test(value.dnaHash) ||
    !HASH.test(value.appearanceHash) ||
    !integer(value.createdAt) ||
    !integer(value.updatedAt) ||
    value.updatedAt < value.createdAt
  )
    throw invalid();
  parsePetDNA(value.dna);
  return value as PetRecord;
}
export function parsePetSlot(value: unknown, uid: string): PetSlot | null {
  if (value === null) return null;
  if (
    !object(value) ||
    !keys(value, [
      'schemaVersion',
      'ownerId',
      'revision',
      'previousRevision',
      'lastOperationId',
      'updatedAt',
      'pet',
    ]) ||
    value.schemaVersion !== 1 ||
    value.ownerId !== uid ||
    !integer(value.revision, PET_REVISION_LIMIT) ||
    value.revision < 1 ||
    !integer(value.previousRevision, PET_REVISION_LIMIT) ||
    value.revision !== value.previousRevision + 1 ||
    !ID.test(value.lastOperationId) ||
    !integer(value.updatedAt)
  )
    throw invalid();
  if (value.pet !== null) parsePetRecord(value.pet, uid);
  return value as PetSlot;
}
function samePet(a: PetRecord | null, b: PetRecord | null) {
  return canonicalPetJSON(a) === canonicalPetJSON(b);
}
export function applyPetMutation(
  uid: string,
  current: PetSlot | null,
  mutation: PetMutation,
  now: number,
): PetSlot {
  if (
    !ID.test(uid) ||
    !ID.test(mutation.operationId) ||
    !ID.test(mutation.targetPetId) ||
    !integer(mutation.baseRevision, PET_REVISION_LIMIT - 1) ||
    mutation.nextRevision !== mutation.baseRevision + 1 ||
    !['create', 'rename', 'delete'].includes(mutation.type) ||
    !integer(now) ||
    (current?.ownerId !== undefined && current.ownerId !== uid)
  )
    throw invalid();
  if (
    current?.lastOperationId === mutation.operationId &&
    current.revision === mutation.nextRevision
  ) {
    if (samePet(current.pet, mutation.pet)) return current;
    throw petConflict();
  }
  if ((current?.revision ?? 0) !== mutation.baseRevision) throw petConflict();
  const before = current?.pet ?? null,
    after = mutation.pet;
  if (mutation.type === 'create') {
    if (
      before ||
      !after ||
      after.petId !== mutation.targetPetId ||
      after.ownerId !== uid
    )
      throw petConflict();
  } else {
    if (!before || before.petId !== mutation.targetPetId) throw petConflict();
    if (mutation.type === 'delete') {
      if (after !== null) throw invalid();
    } else if (
      !after ||
      after.ownerId !== uid ||
      after.petId !== before.petId ||
      after.createdAt !== before.createdAt ||
      after.dnaHash !== before.dnaHash ||
      after.appearanceHash !== before.appearanceHash ||
      canonicalPetJSON(after.dna) !== canonicalPetJSON(before.dna)
    )
      throw petConflict();
  }
  return {
    schemaVersion: 1,
    ownerId: uid,
    revision: mutation.nextRevision,
    previousRevision: mutation.baseRevision,
    lastOperationId: mutation.operationId,
    updatedAt: now,
    pet: after,
  };
}
