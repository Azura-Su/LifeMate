export function createAvatarStorage({ url, serviceKey }, request = fetch) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url ?? '') || !serviceKey)
    throw Error('Missing avatar configuration');
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  async function send(path, method, body, extra = {}) {
    return request(`${url}/storage/v1/${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: { ...headers, ...extra },
      ...(body === undefined ? {} : { body }),
    });
  }
  async function missing(response) {
    if (response.status === 404) return true;
    if (response.status !== 400) return false;
    const error = await response.json().catch(() => ({}));
    return /^(object not found|not_found)$/i.test(
      error.message ?? error.error ?? '',
    );
  }
  return async (action, path, bytes) => {
    if (!/^profiles\/[A-Za-z0-9_-]{1,128}\/avatar\.jpg$/.test(path))
      throw Error('Invalid avatar path');
    const object = `lifemate-avatars/${path}`;
    if (action === 'upload') {
      const response = await send(`object/${object}`, 'POST', bytes, {
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
        'Cache-Control': 'max-age=0',
      });
      if (!response.ok) throw Error('Avatar upload failed');
    } else if (action === 'remove') {
      const response = await send(`object/${object}`, 'DELETE');
      if (!response.ok && !(await missing(response)))
        throw Error('Avatar removal failed');
      return null;
    } else if (action !== 'read') throw Error('Invalid avatar operation');
    const response = await send(
      `object/sign/${object}`,
      'POST',
      JSON.stringify({ expiresIn: 600 }),
      { 'Content-Type': 'application/json' },
    );
    if (!response.ok) {
      if (await missing(response)) return null;
      throw Error('Avatar unavailable');
    }
    const payload = await response.json();
    const target = new URL(`${url}/storage/v1${payload.signedURL}`);
    if (
      target.origin !== url ||
      target.pathname !== `/storage/v1/object/sign/${object}` ||
      !target.searchParams.get('token') ||
      target.username ||
      target.password ||
      target.hash
    )
      throw Error('Invalid avatar URL');
    return target.toString();
  };
}
