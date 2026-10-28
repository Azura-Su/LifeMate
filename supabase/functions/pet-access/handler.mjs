import {
  EXP_RULES,
  PET_TIME_ZONE_OFFSET_MINUTES,
  WEEKLY_RECORD_DAYS,
  progressFor,
} from './expConfig.mjs';
import { dayKey, summarizeTransactions } from './financeAdapter.mjs';

const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
// Days later than this are frozen: backdated records cannot farm EXP.
const CLAIM_GRACE_DAYS = 2;
const COMMANDS = ['roll', 'restore', 'confirm', 'care'];
const errors = {
  'invalid-session': 401,
  'invalid-input': 400,
  'rate-limited': 429,
  'idempotency-conflict': 409,
  'all-adopted': 409,
  'all-reserved': 409,
  'no-rolls': 409,
  'no-restores': 409,
  'rolls-remaining': 409,
  'reservation-missing': 409,
  'reservation-expired': 409,
  'stale-snapshot': 409,
  'pet-busy': 409,
  'no-pet': 409,
};
const json = (status, value) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw Error('invalid-input');
  const allowed = {
    state: ['type'],
    sync: ['type'],
    roll: ['type', 'actionId'],
    restore: ['type', 'actionId'],
    care: ['type', 'actionId'],
    confirm: ['type', 'actionId', 'reservationId'],
  }[input.type];
  if (
    !allowed ||
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    allowed.some((key) => !(key in input))
  )
    throw Error('invalid-input');
  if (COMMANDS.includes(input.type) && !UUID.test(input.actionId))
    throw Error('invalid-input');
  if (input.type === 'confirm' && !UUID.test(input.reservationId))
    throw Error('invalid-input');
  return input;
}

/** Adds server-derived level/stage; the client never computes progression. */
export function presentState(state, todayEffects = null) {
  if (!state?.pet) return state;
  return {
    ...state,
    pet: { ...state.pet, ...progressFor(state.pet.totalExp) },
    ...(todayEffects ? { todayEffects } : {}),
  };
}

export function createPetHandler({
  verifyIdentity,
  rpc,
  listTransactions,
  now = Date.now,
}) {
  async function sync(identity) {
    const args = { p_uid: identity.uid, p_auth_time: identity.authTime };
    const current = await rpc('lifemate_pet_read', args);
    if (!current.pet) return current;
    const readMs = now();
    // One day of slack so the adoption-day boundary is covered in any zone.
    const rows = await listTransactions(
      identity.uid,
      current.pet.adoptedAt - 86400000,
    );
    const toDay = dayKey(readMs, PET_TIME_ZONE_OFFSET_MINUTES);
    const fromDay = dayKey(
      current.pet.adoptedAt,
      PET_TIME_ZONE_OFFSET_MINUTES,
    );
    const { days, todayEffects } = summarizeTransactions(rows, {
      fromDay,
      toDay,
      offsetMinutes: PET_TIME_ZONE_OFFSET_MINUTES,
    });
    const state = await rpc('lifemate_pet_reconcile_current', {
      ...args,
      p_adoption_id: current.pet.adoptionId,
      p_read_ms: readMs,
      p_days: days,
      p_rules: EXP_RULES,
      p_grace_days: CLAIM_GRACE_DAYS,
      p_weekly_days: WEEKLY_RECORD_DAYS,
    });
    return { state, todayEffects };
  }

  return async (request) => {
    if (request.method !== 'POST' || request.headers.has('origin'))
      return json(405, { error: 'native-only' });
    const token = request.headers
      .get('authorization')
      ?.match(/^Bearer (.+)$/)?.[1];
    let identity;
    try {
      if (!token) throw Error('token');
      identity = await verifyIdentity(token);
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(identity.uid)) throw Error('uid');
    } catch {
      return json(401, { error: 'invalid-session' });
    }
    let input;
    try {
      const text = await request.text();
      if (text.length > 1024) throw Error('size');
      input = validate(JSON.parse(text));
    } catch {
      return json(400, { error: 'invalid-input' });
    }
    try {
      if (input.type === 'state')
        return json(
          200,
          presentState(
            await rpc('lifemate_pet_read', {
              p_uid: identity.uid,
              p_auth_time: identity.authTime,
            }),
          ),
        );
      if (input.type === 'sync') {
        const result = await sync(identity);
        return json(
          200,
          result.state
            ? presentState(result.state, result.todayEffects)
            : presentState(result),
        );
      }
      const args = input.type === 'confirm'
        ? { reservationId: input.reservationId }
        : {};
      return json(
        200,
        presentState(
          await rpc('lifemate_pet_command', {
            p_uid: identity.uid,
            p_auth_time: identity.authTime,
            p_action_id: input.actionId,
            p_fingerprint: `${input.type}:${JSON.stringify(args)}`,
            p_command: input.type,
            p_args: args,
            p_rules: EXP_RULES,
          }),
        ),
      );
    } catch (error) {
      const code = error?.message in errors ? error.message : 'pet-unavailable';
      return json(errors[code] ?? 503, { error: code });
    }
  };
}
