import { ACCESS_TABLE } from '../_shared/accountAccess.mjs';
import { ADMIN_UID, ADMIN_EMAIL } from './handler.mjs';

// Deny tombstones remain indefinitely. Daily sweeps remove objects from late
// finishing uploads without keeping the login or metadata alive.

export function createAccounts({
  database,
  google,
  clearObjects,
  clearGames = async () => undefined,
  clearPets = async () => undefined,
  now = Date.now,
  uuid = () => crypto.randomUUID(),
}) {
  const get = async (uid) =>
    (await database(ACCESS_TABLE, 'GET', { uid: `eq.${uid}`, limit: 1 }))[0] ??
    null;
  async function leased(uid, run) {
    if (uid === ADMIN_UID) throw new Error('Protected account');
    const lease = uuid();
    const rows = await database(
      'rpc/claim_lifemate_account',
      'POST',
      {},
      { p_uid: uid, p_lease: lease },
    );
    if (!rows.length) throw new Error('Account busy');
    const update = async (values) => {
      const changed = await database(
        ACCESS_TABLE,
        'PATCH',
        { uid: `eq.${uid}`, lease_id: `eq.${lease}` },
        {
          ...values,
          updated_at: new Date(now()).toISOString(),
        },
      );
      if (!changed.length) throw new Error('Account lease lost');
      return changed[0];
    };
    try {
      return await run(rows[0], update);
    } catch (cause) {
      // Failed accounts must not monopolize the oldest two cron slots.
      await update({
        next_run: new Date(now() + 5 * 60000).toISOString(),
      }).catch(() => undefined);
      throw cause;
    } finally {
      await database(
        ACCESS_TABLE,
        'PATCH',
        { uid: `eq.${uid}`, lease_id: `eq.${lease}` },
        { lease_id: null, lease_until: null },
      );
    }
  }
  async function reconcile(row, update) {
    const blocked = row.status !== 'active';
    // Persisted status gates Edge Functions even if a later provider call fails.
    // Enable Auth last; an interrupted enable keeps Auth disabled.
    await google.mirror(row.uid, row.status, row.valid_since);
    if (
      row.status !== 'deleted' &&
      (row.status !== 'deleting' ||
        (await google.lookup({ localId: [row.uid] })))
    )
      await google.setDisabled(row.uid, blocked, row.valid_since);
    return update({ phase: row.status === 'deleting' ? 'sweeping' : 'ready' });
  }
  async function removeLogin(row, update) {
    const live = await google.lookup({ localId: [row.uid] });
    if (row.uid === ADMIN_UID || live?.email?.toLowerCase() === ADMIN_EMAIL)
      throw new Error('Protected account');
    // Cutoff is immutable: retries must not erase invites for a new account
    // that registers with the same email after the old Auth user is gone.
    if (!row.deletion_requested_at) throw new Error('Missing deletion cutoff');
    if (row.email)
      await database('lifemate_memory_email_invites', 'DELETE', {
        target_email: `eq.${row.email}`,
        created_at: `lte.${row.deletion_requested_at}`,
      });
    // Free the unique profile email before making it reusable in Firebase Auth.
    await database('lifemate_memory_profiles', 'DELETE', {
      uid: `eq.${row.uid}`,
    });
    await google.deleteAuth(row.uid); // Idempotent when a prior attempt already deleted it.
    return update({
      auth_deleted_at: row.auth_deleted_at ?? new Date(now()).toISOString(),
      phase: 'sweeping',
      final_after: null,
      next_run: new Date(now()).toISOString(),
    });
  }
  async function purgeData(row, update, budget) {
    // Metadata first; a slow object inventory must not keep user data/profile alive.
    await clearGames(row.uid);
    // Revokes the pet so it returns to AVAILABLE with no prior progress.
    await clearPets(row.uid);
    if (!(await google.clearFirestore(row.uid, budget))) return row;
    for (const table of [
      'lifemate_memory_deletions',
      'lifemate_audio_upload_reservations',
    ]) {
      if (!budget()) return row;
      await database(table, 'DELETE', { owner_uid: `eq.${row.uid}` });
    }
    if (!(await clearObjects(row.uid, budget))) return row;
    if (!(await google.clearStorage(row.uid, budget))) return row;
    if (!budget()) return row;
    await google.mirror(row.uid, 'deleted', row.valid_since);
    return update({
      status: 'deleted',
      phase: 'complete',
      email: null,
      final_after: null,
      next_run: new Date(now() + 86400000).toISOString(),
    });
  }
  async function transition(uid, action, email) {
    const end = now() + 35000;
    return leased(uid, async (row, update) => {
      if (['deleting', 'deleted'].includes(row.status))
        throw new Error('Deletion cannot be cancelled');
      if (email === ADMIN_EMAIL) throw new Error('Protected account');
      const status = {
        enable: 'active',
        disable: 'disabled',
        delete: 'deleting',
      }[action];
      row = await update({
        status,
        ...(status !== 'active'
          ? { valid_since: Math.floor(now() / 1000) + 1 }
          : {}),
        phase: 'blocking',
        email: status === 'deleting' ? email : null,
        ...(status === 'deleting'
          ? {
              deletion_requested_at: new Date(now()).toISOString(),
              auth_deleted_at: null,
              final_after: null,
              next_run: new Date(now()).toISOString(),
            }
          : {}),
      });
      row = await reconcile(row, update);
      if (action !== 'delete') return row;
      row = await removeLogin(row, update);
      try {
        return await purgeData(row, update, () => now() < end);
      } catch {
        // Login removal is confirmed; failed data cleanup remains durable.
        return update({ next_run: new Date(now() + 60000).toISOString() });
      }
    });
  }
  async function sweep() {
    const end = now() + 35000;
    const budget = () => now() < end;
    const rows = await database(ACCESS_TABLE, 'GET', {
      and: `(or(status.eq.deleting,status.eq.deleted,phase.eq.blocking),or(lease_until.is.null,lease_until.lt.${new Date(now()).toISOString()}))`,
      next_run: `lte.${new Date(now()).toISOString()}`,
      order: 'next_run.asc',
      limit: 2,
    });
    for (const item of rows) {
      if (!budget()) break;
      try {
        await leased(item.uid, async (row, update) => {
          // An incomplete batch yields its place to other due accounts. This
          // update is fenced by the lease; a busy account is never patched.
          await update({ next_run: new Date(now() + 60000).toISOString() });
          // Re-check live identity before any destructive work, including cron.
          const live = await google.lookup({ localId: [row.uid] });
          if (live?.email?.toLowerCase() === ADMIN_EMAIL)
            throw new Error('Protected account');
          if (row.phase === 'blocking') row = await reconcile(row, update);
          if (!['deleting', 'deleted'].includes(row.status)) return;
          row = await removeLogin(row, update);
          // An incomplete batch yields to other accounts, even after login removal.
          row = await update({
            next_run: new Date(now() + 60000).toISOString(),
          });
          await purgeData(row, update, budget);
        });
      } catch {
        // Intent and next_run remain durable. Cron retries; no success is claimed.
      }
    }
  }
  return {
    get,
    transition,
    sweep,
    jobs: () =>
      database(ACCESS_TABLE, 'GET', {
        select: 'uid,status,phase,final_after,updated_at',
        or: '(status.eq.deleting,phase.eq.blocking)',
        order: 'updated_at.desc',
        limit: 50,
      }),
  };
}
