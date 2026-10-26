import type {
  PetCache,
  PetMutation,
  PetRecord,
  PetSlot,
} from '../../types/pet';
import { useAuthStore } from '../../store/authStore';
import {
  accountTask,
  assertAccountWritable,
} from '../security/accountLifecycle';
import {
  getEncryptedItem,
  setEncryptedItem,
} from '../security/encryptedLocalStorage';
import { canonicalPetJSON } from './petGenetics';
import {
  applyPetMutation,
  normalizePetName,
  parsePetRecord,
  parsePetSlot,
  PET_REVISION_LIMIT,
  petConflict,
} from './petSlot';

const queues = new Map<string, Promise<unknown>>();
const empty = (): PetCache => ({
  schemaVersion: 1,
  slot: null,
  pending: null,
  draft: null,
});
export const petStorageKey = (uid: string) =>
  `lifemate:pets:v1:${encodeURIComponent(uid)}`;
export function assertPetSession(uid: string, epoch: number) {
  assertAccountWritable(uid);
  const auth = useAuthStore.getState();
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(uid) ||
    auth.user?.uid !== uid ||
    auth.sessionEpoch !== epoch
  )
    throw new Error('Phiên thú cưng đã thay đổi.');
}
export function parsePetMutation(v: unknown, uid: string): PetMutation {
  if (!v || typeof v !== 'object')
    throw new Error('Thao tác thú cưng không hợp lệ.');
  const p = v as PetMutation;
  if (
    Object.keys(p).sort().join() !==
      [
        'baseRevision',
        'nextRevision',
        'operationId',
        'pet',
        'targetPetId',
        'type',
      ]
        .sort()
        .join() ||
    !['create', 'rename', 'delete'].includes(p.type) ||
    !Number.isSafeInteger(p.baseRevision) ||
    p.baseRevision < 0 ||
    p.baseRevision >= PET_REVISION_LIMIT ||
    p.nextRevision !== p.baseRevision + 1 ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(p.operationId) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(p.targetPetId)
  )
    throw new Error('Thao tác thú cưng không hợp lệ.');
  if (p.type === 'delete') {
    if (p.pet !== null) throw new Error('Thao tác xóa không hợp lệ.');
  } else if (parsePetRecord(p.pet, uid).petId !== p.targetPetId)
    throw new Error('Thú cưng không khớp thao tác.');
  return p;
}
function queued<T>(
  uid: string,
  epoch: number,
  run: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(uid) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() =>
      accountTask(uid, async () => {
        assertPetSession(uid, epoch);
        const value = await run();
        assertPetSession(uid, epoch);
        return value;
      }),
    );
  queues.set(uid, next);
  void next
    .finally(() => {
      if (queues.get(uid) === next) queues.delete(uid);
    })
    .catch(() => undefined);
  return next;
}
async function read(uid: string, epoch: number): Promise<PetCache> {
  const stored = await getEncryptedItem(uid, petStorageKey(uid));
  assertPetSession(uid, epoch);
  if (!stored) return empty();
  const v = JSON.parse(stored);
  if (
    !v ||
    Object.keys(v).sort().join() !==
      ['schemaVersion', 'slot', 'pending', 'draft'].sort().join() ||
    v.schemaVersion !== 1
  )
    throw new Error('Chưa đọc được thú cưng đã lưu trên thiết bị.');
  const slot = parsePetSlot(v.slot, uid),
    pending = v.pending === null ? null : parsePetMutation(v.pending, uid),
    draft = v.draft === null ? null : parsePetRecord(v.draft, uid);
  return { schemaVersion: 1, slot, pending, draft };
}
async function write(uid: string, epoch: number, cache: PetCache) {
  assertPetSession(uid, epoch);
  await setEncryptedItem(uid, petStorageKey(uid), JSON.stringify(cache));
  assertPetSession(uid, epoch);
  return cache;
}
export const readPetCache = (uid: string, epoch: number) =>
  queued(uid, epoch, () => read(uid, epoch));
type EnqueueInput = (
  | { type: 'create'; pet: PetRecord; operationId: string }
  | { type: 'rename'; targetPetId: string; name: string; operationId: string }
  | { type: 'delete'; targetPetId: string; operationId: string }
) & { expectedRevision?: number };
export function enqueuePetMutation(
  uid: string,
  epoch: number,
  input: EnqueueInput,
) {
  return queued(uid, epoch, async () => {
    const cache = await read(uid, epoch);
    if (
      input.expectedRevision !== undefined &&
      input.expectedRevision !== (cache.slot?.revision ?? 0)
    )
      throw petConflict();
    if (cache.pending)
      throw new Error('Hãy đồng bộ thao tác trước khi thay đổi thú cưng tiếp.');
    const current = cache.slot?.pet;
    let pet: PetRecord | null;
    if (input.type === 'create') {
      if (current)
        throw new Error(
          'Bạn đã có thú cưng. Hãy xóa thú cưng hiện tại trước khi lưu pet mới.',
        );
      pet = parsePetRecord(input.pet, uid);
    } else {
      if (!current || current.petId !== input.targetPetId) throw petConflict();
      pet =
        input.type === 'delete'
          ? null
          : {
              ...current,
              name: normalizePetName(input.name),
              updatedAt: Math.max(Date.now(), current.updatedAt),
            };
    }
    const revision = cache.slot?.revision ?? 0;
    const pending = parsePetMutation(
      {
        operationId: input.operationId,
        type: input.type,
        targetPetId:
          input.type === 'create' ? input.pet.petId : input.targetPetId,
        baseRevision: revision,
        nextRevision: revision + 1,
        pet,
      },
      uid,
    );
    applyPetMutation(uid, cache.slot, pending, Date.now());
    return write(uid, epoch, {
      ...cache,
      pending,
      draft:
        input.type === 'create'
          ? pet
          : input.type === 'delete'
            ? null
            : cache.draft,
    });
  });
}
export function reconcilePetSlot(
  uid: string,
  epoch: number,
  remote: PetSlot | null,
) {
  return queued(uid, epoch, async () => {
    const slot = parsePetSlot(remote, uid),
      cache = await read(uid, epoch);
    if ((slot?.revision ?? 0) < (cache.slot?.revision ?? 0)) return cache;
    if (
      slot &&
      cache.slot &&
      slot.revision === cache.slot.revision &&
      canonicalPetJSON(slot) !== canonicalPetJSON(cache.slot)
    )
      throw petConflict();
    let { pending, draft } = cache;
    if (
      pending &&
      slot?.revision === pending.nextRevision &&
      slot.lastOperationId === pending.operationId &&
      canonicalPetJSON(slot.pet) === canonicalPetJSON(pending.pet)
    ) {
      pending = null;
      draft = null;
    } else if (pending && (slot?.revision ?? 0) > pending.baseRevision) {
      // The create may have committed and then been deleted on another device.
      // A later fence cannot prove this is still a never-owned preview.
      if (
        pending.type === 'create' &&
        (slot?.revision ?? 0) > pending.nextRevision &&
        draft?.petId === pending.targetPetId
      )
        draft = null;
      pending = null;
    }
    const oldId = cache.slot?.pet?.petId;
    if (oldId && slot?.pet?.petId !== oldId && draft?.petId === oldId)
      draft = null;
    return write(uid, epoch, { schemaVersion: 1, slot, pending, draft });
  });
}
