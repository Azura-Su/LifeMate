export const ADMIN_UID = 'CQmmT9iJvKPP79UZqYbvmZ3gXZQ2';
export const ADMIN_EMAIL = 'su.azura99@gmail.com';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const json = (status, value) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

async function input(request) {
  if (!request.body) throw new Error('body');
  const reader = request.body.getReader();
  let text = '';
  let length = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 4096) {
        await reader.cancel();
        throw new Error('body');
      }
      text += decoder.decode(value, { stream: true });
    }
    const body = JSON.parse(text + decoder.decode());
    const allowed = {
      list: ['action', 'pageToken'],
      search: ['action', 'query'],
      detail: ['action', 'uid'],
      disable: ['action', 'uid'],
      enable: ['action', 'uid'],
      delete: ['action', 'uid', 'email'],
      jobs: ['action'],
      sweep: ['action'],
      status: ['action', 'uid'],
      'pet-list': ['action'],
      'pet-revoke': [
        'action',
        'targetUid',
        'speciesId',
        'adoptionId',
        'actionId',
      ],
    };
    if (
      !body ||
      !allowed[body.action] ||
      Object.keys(body).some((k) => !allowed[body.action].includes(k))
    )
      throw new Error('input');
    if (
      ['detail', 'disable', 'enable', 'delete', 'status'].includes(
        body.action,
      ) &&
      !ID.test(body.uid ?? '')
    )
      throw new Error('uid');
    if (
      body.action === 'search' &&
      (typeof body.query !== 'string' ||
        !body.query.trim() ||
        body.query.length > 254)
    )
      throw new Error('query');
    if (
      body.pageToken !== undefined &&
      (typeof body.pageToken !== 'string' || body.pageToken.length > 2048)
    )
      throw new Error('page');
    if (
      body.action === 'delete' &&
      (typeof body.email !== 'string' || body.email.length > 254)
    )
      throw new Error('email');
    if (
      body.action === 'pet-revoke' &&
      (['targetUid', 'speciesId', 'adoptionId', 'actionId'].some(key => typeof body[key] !== 'string') ||
        !ID.test(body.targetUid ?? '') ||
        !/^[a-z0-9_]{1,40}$/.test(body.speciesId ?? '') ||
        !UUID.test(body.adoptionId ?? '') ||
        !UUID.test(body.actionId ?? ''))
    )
      throw new Error('pet');
    return body;
  } finally {
    reader.releaseLock();
  }
}

export function publicUser(user, access) {
  return {
    uid: user.localId,
    email: user.email ?? '',
    name: user.displayName ?? '',
    verified: user.emailVerified === true,
    disabled: user.disabled === true,
    createdAt: Number(user.createdAt) || null,
    lastSignInAt: Number(user.lastLoginAt) || null,
    providers: [
      ...new Set((user.providerUserInfo ?? []).map((p) => p.providerId)),
    ],
    status: access?.status ?? (user.disabled ? 'disabled' : 'active'),
    phase: access?.phase ?? 'ready',
    finalAfter: access?.final_after ?? null,
    authDeleted: !!access?.auth_deleted_at,
    protected:
      user.localId === ADMIN_UID || user.email?.toLowerCase() === ADMIN_EMAIL,
  };
}

export function createAdminHandler({
  verifyIdentity,
  google,
  accounts,
  sweep,
  workerSecret,
  readAvatar = async () => null,
  pets,
}) {
  async function withAvatar(user, access) {
    const value = publicUser(user, access);
    try {
      value.avatarUrl = await readAvatar(`profiles/${value.uid}/avatar.jpg`);
    } catch {
      value.avatarUrl = null;
    }
    return value;
  }
  return async (request) => {
    if (request.method !== 'POST' || request.headers.has('origin'))
      return json(405, { error: 'native-only' });
    let body;
    try {
      body = await input(request);
    } catch {
      return json(400, { error: 'invalid-input' });
    }
    try {
      // Recovery reveals only a UID's block state, never identity or user data.
      if (body.action === 'status') {
        const row = await accounts.get(body.uid);
        return json(200, { status: row?.status ?? 'active' });
      }
      const authorization = request.headers.get('authorization') ?? '';
      if (body.action === 'sweep') {
        if (!workerSecret || authorization !== `Bearer ${workerSecret}`)
          return json(403, { error: 'forbidden' });
        await sweep();
        return json(200, { ok: true });
      }
      let identity;
      try {
        identity = await verifyIdentity(authorization.replace(/^Bearer /, ''));
      } catch {
        return json(401, { error: 'invalid-session' });
      }
      if (
        identity.uid !== ADMIN_UID ||
        identity.email !== ADMIN_EMAIL ||
        !identity.emailVerified
      )
        return json(403, { error: 'admin-required' });
      const admin = await google.lookup({ localId: [ADMIN_UID] });
      if (
        !admin ||
        admin.disabled ||
        !admin.emailVerified ||
        admin.email?.toLowerCase() !== ADMIN_EMAIL ||
        identity.authTime < Number(admin.validSince ?? 0)
      )
        return json(403, { error: 'admin-required' });
      if (body.action === 'pet-list')
        return json(200, await pets.list(identity));
      if (body.action === 'pet-revoke')
        return json(200, await pets.revoke(identity, body));
      if (body.action === 'jobs')
        return json(200, { jobs: await accounts.jobs() });
      if (body.action === 'list' || body.action === 'search') {
        const page =
          body.action === 'list'
            ? await google.list(body.pageToken)
            : {
                users: [
                  await google.lookup(
                    body.query.includes('@')
                      ? { email: [body.query.trim().toLowerCase()] }
                      : { localId: [body.query.trim()] },
                  ),
                ].filter(Boolean),
              };
        const users = await Promise.all(
          (page.users ?? [])
            .filter(
              (u) =>
                u.localId !== ADMIN_UID &&
                u.email?.toLowerCase() !== ADMIN_EMAIL,
            )
            .map(async (u) => withAvatar(u, await accounts.get(u.localId))),
        );
        return json(200, { users, nextPageToken: page.nextPageToken ?? null });
      }
      const target = await google.lookup({ localId: [body.uid] });
      if (!target) return json(404, { error: 'user-not-found' });
      if (body.action === 'detail')
        return json(200, {
          user: await withAvatar(target, await accounts.get(body.uid)),
        });
      if (
        target.localId === ADMIN_UID ||
        target.email?.toLowerCase() === ADMIN_EMAIL
      )
        return json(403, { error: 'protected-account' });
      if (
        body.action === 'delete' &&
        body.email.trim().toLowerCase() !== target.email?.toLowerCase()
      )
        return json(400, { error: 'email-mismatch' });
      const result = await accounts.transition(
        body.uid,
        body.action,
        target.email?.toLowerCase(),
      );
      return json(200, {
        user:
          body.action === 'delete'
            ? publicUser({ ...target, disabled: true }, result)
            : await withAvatar(
                { ...target, disabled: result.status !== 'active' },
                result,
              ),
      });
    } catch (cause) {
      const petErrors = {
        'pet-changed': 409,
        'invalid-input': 400,
        'idempotency-conflict': 409,
        'account-busy': 409,
        'rate-limited': 429,
        'invalid-session': 401,
        'admin-required': 403,
      };
      if (
        ['pet-list', 'pet-revoke'].includes(body.action) &&
        cause?.message in petErrors
      )
        return json(petErrors[cause.message], { error: cause.message });
      if (cause?.message === 'Account busy')
        return json(409, { error: 'account-busy' });
      if (cause?.message === 'Deletion cannot be cancelled')
        return json(409, { error: 'deletion-in-progress' });
      return json(503, { error: 'admin-unavailable' });
    }
  };
}
