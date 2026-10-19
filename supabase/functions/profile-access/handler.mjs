const json = (status, value) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function readBody(request, limit) {
  if (!request.body) throw Error('body');
  const reader = request.body.getReader();
  let timer;
  let size = 0;
  const chunks = [];
  try {
    return await Promise.race([
      (async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > limit) throw Object.assign(Error('size'), { status: 413 });
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        return bytes;
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Object.assign(Error('timeout'), { status: 408 })),
          10000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export function createProfileHandler({ verifyIdentity, storage }) {
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
    let action, bytes;
    try {
      const type = request.headers.get('content-type')?.split(';')[0];
      if (type === 'image/jpeg') {
        bytes = await readBody(request, 524288);
        if (
          bytes.length < 4 ||
          bytes[0] !== 255 ||
          bytes[1] !== 216 ||
          bytes.at(-2) !== 255 ||
          bytes.at(-1) !== 217
        )
          return json(415, { error: 'invalid-image' });
        action = 'upload';
      } else if (type === 'application/json') {
        const input = JSON.parse(
          new TextDecoder().decode(await readBody(request, 1024)),
        );
        if (
          !input ||
          !['avatar-url', 'remove-avatar'].includes(input.action) ||
          Object.keys(input).some((k) => k !== 'action')
        )
          throw Error('input');
        action = input.action === 'avatar-url' ? 'read' : 'remove';
      } else return json(415, { error: 'invalid-image' });
    } catch (cause) {
      return json(cause.status ?? 400, { error: 'invalid-input' });
    }
    // Slow input must not extend a revoked session's write access.
    try {
      if ((await verifyIdentity(token)).uid !== identity.uid)
        throw Error('uid');
    } catch {
      return json(401, { error: 'invalid-session' });
    }
    try {
      const path = `profiles/${identity.uid}/avatar.jpg`;
      const avatarUrl = await storage(
        action,
        path,
        ...(action === 'upload' ? [bytes] : []),
      );
      return json(200, { avatarUrl, expiresIn: 600 });
    } catch {
      return json(503, { error: 'profile-unavailable' });
    }
  };
}
