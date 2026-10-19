import { createRemoteJWKSet, jwtVerify } from 'jose';

const keys = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
  { timeoutDuration: 5000, cacheMaxAge: 300000 },
);

export function createFirebaseIdentityVerifier(projectId, jwks = keys) {
  return async (token) => {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
      requiredClaims: ['exp', 'iat', 'sub', 'auth_time'],
    });
    const now = Math.floor(Date.now() / 1000);
    const email =
      typeof payload.email === 'string'
        ? payload.email.trim().toLowerCase()
        : '';
    if (
      typeof payload.sub !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(payload.sub) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      typeof payload.iat !== 'number' ||
      payload.iat > now ||
      typeof payload.auth_time !== 'number' ||
      payload.auth_time < 0 ||
      payload.auth_time > now
    )
      throw new Error('Invalid Firebase identity');
    return {
      uid: payload.sub,
      email,
      emailVerified: payload.email_verified === true,
      authTime: payload.auth_time,
    };
  };
}
