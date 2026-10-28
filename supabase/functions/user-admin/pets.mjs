import { progressFor } from '../pet-access/expConfig.mjs';

/** Invoked only after user-admin verifies the live Firebase admin account. */
export function createPetAdmin({ rpc, lookupMany }) {
  async function list(identity) {
    const result = await rpc('lifemate_pet_admin_list', {
      p_admin_uid: identity.uid,
      p_auth_time: identity.authTime,
    });
    const uids = [
      ...new Set(result.pets.map((p) => p.holderUid).filter(Boolean)),
    ];
    const users = await lookupMany(uids);
    const profiles = new Map(users.map((user) => [user.localId, user]));
    return {
      serverTime: result.serverTime,
      pets: result.pets.map((pet) => {
        const user = profiles.get(pet.holderUid);
        return {
          speciesId: pet.speciesId,
          status: pet.status,
          holder: pet.holderUid
            ? {
                uid: pet.holderUid,
                name: user?.displayName ?? '',
                email: user?.email ?? '',
              }
            : null,
          reservedUntil: pet.reservedUntil,
          adoption: pet.adoption
            ? { ...pet.adoption, ...progressFor(pet.adoption.totalExp) }
            : null,
        };
      }),
    };
  }
  return {
    list,
    async revoke(identity, input) {
      await rpc('lifemate_pet_admin_revoke', {
        p_admin_uid: identity.uid,
        p_auth_time: identity.authTime,
        p_action_id: input.actionId,
        p_target_uid: input.targetUid,
        p_species_id: input.speciesId,
        p_adoption_id: input.adoptionId,
      });
      return list(identity);
    },
  };
}
