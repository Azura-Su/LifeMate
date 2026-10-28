import { PIXEL_PET_SPECIES } from '../../pixelPet/pixelPetCatalog';
import {
  listManagedPets,
  parsePetInventory,
  revokeManagedPet,
} from '../petManagement';
import { requestAdmin } from '../userManagement';
jest.mock('../userManagement', () => ({ requestAdmin: jest.fn() }));
const available = {
  pets: PIXEL_PET_SPECIES.map((p) => ({
    speciesId: p.id,
    status: 'available',
    holder: null,
    reservedUntil: null,
    adoption: null,
  })),
  serverTime: 1,
};
const owned = {
  speciesId: 'phoenix',
  status: 'owned',
  holder: { uid: 'owner', name: 'Alice', email: 'a@example.com' },
  reservedUntil: null,
  adoption: {
    id: '11111111-1111-4111-8111-111111111111',
    adoptedAt: 1,
    totalExp: 150,
    level: 4,
    stage: 'juvenile',
  },
};
const inventory = {
  ...available,
  pets: available.pets.map((p) => (p.speciesId === 'phoenix' ? owned : p)),
};
it('accepts the complete catalog and rejects contradictory or incomplete inventories', () => {
  expect(parsePetInventory(inventory).pets).toHaveLength(15);
  for (const invalid of [
    null,
    { ...available, pets: available.pets.slice(1) },
    { ...available, pets: available.pets.map(() => available.pets[0]) },
    ...[
      { ...owned, holder: null },
      { ...owned, adoption: { ...owned.adoption, level: 99 } },
      { ...owned, status: 'available' },
      { ...owned, adoption: { ...owned.adoption, totalExp: -1 } },
    ].map((pet) => ({
      ...available,
      pets: available.pets.map((p) => (p.speciesId === 'phoenix' ? pet : p)),
    })),
  ])
    expect(() => parsePetInventory(invalid)).toThrow();
});
it('uses the existing admin transport and preserves the selected adoption/action for retry', async () => {
  jest.mocked(requestAdmin).mockResolvedValue(inventory);
  const controller = new AbortController();
  await listManagedPets(controller.signal);
  const input = {
    targetUid: 'owner',
    speciesId: 'phoenix' as const,
    adoptionId: owned.adoption.id,
    actionId: '22222222-2222-4222-8222-222222222222',
  };
  await revokeManagedPet(input, controller.signal);
  expect(requestAdmin).toHaveBeenNthCalledWith(
    1,
    { action: 'pet-list' },
    controller.signal,
  );
  expect(requestAdmin).toHaveBeenNthCalledWith(
    2,
    { action: 'pet-revoke', ...input },
    controller.signal,
  );
});
