export function createObjectCleanup({ url, serviceKey, r2 }, request = fetch) {
  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url ?? '') ||
    !serviceKey ||
    typeof r2?.list !== 'function' ||
    typeof r2?.remove !== 'function'
  )
    throw new Error('Missing object cleanup configuration');
  async function storage(endpoint, body) {
    const response = await request(`${url}/storage/v1/${endpoint}`, {
      method: endpoint.startsWith('object/list/') ? 'POST' : 'DELETE',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Object cleanup unavailable');
    return response.json();
  }
  async function clearFolder(bucket, prefix, budget, depth = 0) {
    if (!budget()) return false;
    if (depth > 2) throw new Error('Unexpected object nesting');
    const rows = await storage(`object/list/${bucket}`, {
      prefix,
      limit: 50,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });
    const files = [];
    for (const row of rows) {
      if (
        !row.name ||
        row.name.includes('/') ||
        row.name === '.' ||
        row.name === '..'
      )
        throw new Error('Unsafe object name');
      const name = `${prefix}${row.name}`;
      if (row.id) files.push(name);
      else if (!(await clearFolder(bucket, `${name}/`, budget, depth + 1)))
        return false;
    }
    if (files.length) {
      if (!budget()) return false;
      await storage(`object/${bucket}`, { prefixes: files });
    }
    return rows.length < 50;
  }
  return async (uid, budget) => {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('Invalid UID');
    for (const [bucket, prefix] of [
      ['lifemate-audio', `audio/${uid}/`],
      ['lifemate-memories', `shared/${uid}/`],
      ['lifemate-avatars', `profiles/${uid}/`],
    ])
      if (!(await clearFolder(bucket, prefix, budget))) return false;
    for (const prefix of [`shared/${uid}/`, `private/${uid}/`]) {
      if (!budget()) return false;
      const result = await r2.list(prefix);
      const objects = (result.Contents ?? []).map((object) => {
        if (!object.Key?.startsWith(prefix))
          throw new Error('Unsafe R2 prefix');
        return { Key: object.Key };
      });
      if (objects.length) {
        if (!budget()) return false;
        await r2.remove(objects);
      }
      if (result.IsTruncated) return false;
    }
    return true;
  };
}
