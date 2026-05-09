import { SignJWT, jwtVerify } from 'jose';
import { getSessionSecretKey } from '@/lib/sessionSecrets';

export const ADMIN_SESSION_COOKIE = 'wl_admin_session';
const ISSUER = 'warmeleads-admin-session';
const AUDIENCE = 'warmeleads-admin-api';

/** Browser cookie lifetime (JWT exp matches). */
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export async function signAdminSession(adminId: string): Promise<string> {
  const secret = getSessionSecretKey();
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(adminId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret);
}

export async function verifyAdminSessionJwt(token: string): Promise<string | null> {
  try {
    const secret = getSessionSecretKey();
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    return sub || null;
  } catch {
    return null;
  }
}

export function adminSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SEC,
  };
}

export function clearedAdminSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  };
}
