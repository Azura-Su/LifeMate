import test from 'node:test';
import assert from 'node:assert/strict';
import { createPetAdmin } from '../user-admin/pets.mjs';

test('inventory batches only holder profiles and derives levels without exposing auth fields', async () => {
  const calls = [];
  const service = createPetAdmin({
    rpc: async (name, args) => {
      calls.push([name, args]);
      return {
        serverTime: 1,
        pets: [
          {
            speciesId: 'phoenix',
            status: 'owned',
            holderUid: 'a',
            reservedUntil: null,
            adoption: { id: 'old', adoptedAt: 1, totalExp: 150 },
          },
          {
            speciesId: 'qilin',
            status: 'reserved',
            holderUid: 'missing',
            reservedUntil: 100,
            adoption: null,
          },
          {
            speciesId: 'white_tiger',
            status: 'available',
            holderUid: null,
            reservedUntil: null,
            adoption: null,
          },
        ],
      };
    },
    lookupMany: async (uids) => {
      assert.deepEqual(uids, ['a', 'missing']);
      return [
        {
          localId: 'a',
          displayName: 'Alice',
          email: 'a@example.com',
          passwordHash: 'SECRET',
        },
      ];
    },
  });
  const result = await service.list({ uid: 'admin', authTime: 2 });
  assert.equal(result.pets[0].adoption.level, 4);
  assert.equal(result.pets[0].adoption.stage, 'juvenile');
  assert.deepEqual(result.pets[1].holder, {
    uid: 'missing',
    name: '',
    email: '',
  });
  assert.equal(result.pets[2].holder, null);
  assert.ok(!JSON.stringify(result).includes('SECRET'));
  await service.revoke(
    { uid: 'admin', authTime: 2 },
    {
      targetUid: 'a',
      speciesId: 'phoenix',
      adoptionId: 'old',
      actionId: 'action',
    },
  );
  assert.deepEqual(calls[1], [
    'lifemate_pet_admin_revoke',
    {
      p_admin_uid: 'admin',
      p_auth_time: 2,
      p_action_id: 'action',
      p_target_uid: 'a',
      p_species_id: 'phoenix',
      p_adoption_id: 'old',
    },
  ]);
});
