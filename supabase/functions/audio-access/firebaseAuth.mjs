import { createRemoteJWKSet, jwtVerify } from 'jose';

const googleKeys = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
  { timeoutDuration: 5000, cacheMaxAge: 300000 },
);

export function createFirebaseVerifier(projectId, keys = googleKeys) {
  if (!projectId) throw new Error('Missing Firebase project ID');
  return async (token) => {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
      requiredClaims: ['exp', 'iat', 'sub', 'auth_time'],
    });
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof payload.sub !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(payload.sub) ||
      typeof payload.iat !== 'number' ||
      payload.iat > now ||
      typeof payload.auth_time !== 'number' ||
      payload.auth_time < 0 ||
      payload.auth_time > now
    )
      throw new Error('Invalid Firebase identity');
    return payload.sub;
  };
}
