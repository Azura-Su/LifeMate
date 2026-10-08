export function createStorageSigner(projectUrl, serviceKey, request = fetch) {
  const origin = new URL(projectUrl).origin;
  if (!serviceKey || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin))
    throw new Error('Missing storage configuration');
  return async (action, path) => {
    if (action === 'delete') {
      const objectPath = `lifemate-audio/${path.split('/').map(encodeURIComponent).join('/')}`;
      const response = await request(
        `${origin}/storage/v1/object/${objectPath}`,
        {
          method: 'DELETE',
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        },
      );
      if (!response.ok && response.status !== 404) {
        const details = await response.text().catch(() => '');
        const alreadyMissing =
          response.status === 400 &&
          /object not found|not_found/i.test(details);
        if (!alreadyMissing) throw new Error('Storage deletion failed');
      }
      return undefined;
    }
    const upload = action === 'upload';
    const endpoint = upload ? 'object/upload/sign' : 'object/sign';
    const objectPath = `lifemate-audio/${path.split('/').map(encodeURIComponent).join('/')}`;
    const response = await request(
      `${origin}/storage/v1/${endpoint}/${objectPath}`,
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
          ...(upload ? { 'x-upsert': 'true' } : {}),
        },
        body: JSON.stringify(upload ? {} : { expiresIn: 300 }),
      },
    );
    if (!response.ok) throw new Error('Storage signing failed');
    const result = await response.json();
    const relative = upload ? result.url : result.signedURL;
    if (
      typeof relative !== 'string' ||
      !relative.startsWith(`/${endpoint}/${objectPath}?`)
    )
      throw new Error('Invalid signed path');
    const url = new URL(`${origin}/storage/v1${relative}`);
    if (!url.searchParams.get('token')) throw new Error('Missing signed token');
    return url.toString();
  };
}
