export function createAudioQuota(projectUrl, serviceKey, request = fetch) {
  const origin = new URL(projectUrl).origin;
  if (!serviceKey || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin))
    throw new Error('Missing audio quota configuration');

  async function callRpc(name, body) {
    const response = await request(`${origin}/rest/v1/rpc/${name}`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Audio quota check failed');
    return response.json();
  }

  return {
    reserveUpload: async (uid, path, sizeBytes) =>
      (await callRpc('reserve_lifemate_audio_upload', {
        p_owner_uid: uid,
        p_object_path: path,
        // Signed upload URLs cannot cap the eventual Content-Length. Reserve
        // the bucket's per-file maximum until storage confirms the true size.
        p_size_bytes: Math.max(sizeBytes, 50 * 1024 * 1024),
      })) === true,
    confirmUpload: async (uid, path) =>
      (await callRpc('confirm_lifemate_audio_upload', {
        p_owner_uid: uid,
        p_object_path: path,
      })) === true,
    releaseUpload: async (uid, path) => {
      await callRpc('release_lifemate_audio_upload', {
        p_owner_uid: uid,
        p_object_path: path,
      });
    },
  };
}
