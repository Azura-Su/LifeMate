import type { PixelPetSpeciesId, PixelPetStage } from '../../types/pixelPet';
import { pixelPetSpecies } from '../pixelPet/pixelPetCatalog';
import { requestAdmin } from './userManagement';

export type ManagedPet = {
  speciesId: PixelPetSpeciesId;
  status: 'available' | 'reserved' | 'owned';
  holder: { uid: string; name: string; email: string } | null;
  reservedUntil: number | null;
  adoption: {
    id: string;
    adoptedAt: number;
    totalExp: number;
    level: number;
    stage: PixelPetStage;
  } | null;
};
export type PetInventory = { pets: ManagedPet[]; serverTime: number };
export type PetRevocation = {
  targetUid: string;
  speciesId: PixelPetSpeciesId;
  adoptionId: string;
  actionId: string;
};
const count = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0;
const uuid = (id: unknown) =>
  typeof id === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
    id,
  );

export function parsePetInventory(value: unknown): PetInventory {
  const result = value as PetInventory;
  if (
    !result ||
    !count(result.serverTime) ||
    !Array.isArray(result.pets) ||
    result.pets.length !== 15 ||
    new Set(result.pets.map((p) => p?.speciesId)).size !== 15 ||
    result.pets.some(
      (p) =>
        !p ||
        !pixelPetSpecies(p.speciesId) ||
        !['available', 'reserved', 'owned'].includes(p.status) ||
        (p.status === 'available'
          ? p.holder !== null
          : !p.holder ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(p.holder.uid) ||
            typeof p.holder.name !== 'string' ||
            typeof p.holder.email !== 'string') ||
        (p.status === 'reserved'
          ? !count(p.reservedUntil)
          : p.reservedUntil !== null) ||
        (p.status !== 'owned'
          ? p.adoption !== null
          : !p.adoption ||
            !uuid(p.adoption.id) ||
            !count(p.adoption.adoptedAt) ||
            !count(p.adoption.totalExp) ||
            !Number.isInteger(p.adoption.level) ||
            p.adoption.level < 1 ||
            p.adoption.level > 10 ||
            !['hatchling', 'juvenile', 'ascended'].includes(p.adoption.stage)),
    )
  )
    throw new Error('Danh sách linh thú chưa hợp lệ. Hãy tải lại.');
  return result;
}
export async function listManagedPets(signal?: AbortSignal) {
  return parsePetInventory(await requestAdmin({ action: 'pet-list' }, signal));
}
export async function revokeManagedPet(
  input: PetRevocation,
  signal?: AbortSignal,
) {
  return parsePetInventory(
    await requestAdmin({ action: 'pet-revoke', ...input }, signal),
  );
}
