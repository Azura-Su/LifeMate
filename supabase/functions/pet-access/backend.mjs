export function createPetBackend(projectUrl, serviceKey, request = fetch) {
  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(projectUrl ?? '') ||
    !serviceKey
  )
    throw Error('Missing pet backend configuration');
  return async (name, args = {}) => {
    if (!/^lifemate_pet_[a-z_]+$/.test(name)) throw Error('invalid-rpc');
    const response = await request(`${projectUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    const result = await response.json().catch(() => {
      throw Error('pet-unavailable');
    });
    if (!response.ok) throw Error(result?.message ?? 'pet-unavailable');
    return result;
  };
}
