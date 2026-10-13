const BUCKET = 'lifemate-memories';

export function createMemoryBackend(projectUrl, serviceKey, request = fetch) {
  const origin = new URL(projectUrl).origin;
  if (!serviceKey || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin))
    throw new Error('Missing memory backend configuration');

  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
  };

  async function database(table, method = 'GET', query = {}, body) {
    const url = new URL(`${origin}/rest/v1/${table}`);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value));
    const response = await request(url, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`Database ${table} unavailable`);
    return response.status === 204 ? [] : response.json();
  }

  async function storage(action, path) {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    const objectPath = `${BUCKET}/${encoded}`;
    if (action === 'delete') {
      const response = await request(
        `${origin}/storage/v1/object/${objectPath}`,
        {
          method: 'DELETE',
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
          headers,
        },
      );
      if (!response.ok && response.status !== 404) {
        const details = await response.text().catch(() => '');
        if (
          response.status !== 400 ||
          !/object not found|not_found/i.test(details)
        )
          throw new Error('Image deletion failed');
      }
      return null;
    }
    const endpoint = action === 'upload' ? 'object/upload/sign' : 'object/sign';
    const response = await request(
      `${origin}/storage/v1/${endpoint}/${objectPath}`,
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          ...(action === 'upload' ? { 'x-upsert': 'true' } : {}),
        },
        body: JSON.stringify(action === 'upload' ? {} : { expiresIn: 60 }),
      },
    );
    if (!response.ok) throw new Error('Image signing failed');
    const payload = await response.json();
    const relative = action === 'upload' ? payload.url : payload.signedURL;
    if (
      typeof relative !== 'string' ||
      !relative.startsWith(`/${endpoint}/${objectPath}?`)
    )
      throw new Error('Invalid signed image path');
    const url = new URL(`${origin}/storage/v1${relative}`);
    if (!url.searchParams.get('token')) throw new Error('Missing image token');
    return url.toString();
  }

  return { database, storage };
}
