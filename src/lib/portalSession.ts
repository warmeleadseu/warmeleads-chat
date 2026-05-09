import { SignJWT, jwtVerify } from 'jose';
import { getSessionSecretKey } from '@/lib/sessionSecrets';

export const PORTAL_SESSION_COOKIE = 'wl_portal_session';
const ISSUER = 'warmeleads-portal-session';
const AUDIENCE = 'warmeleads-portal-api';

const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

export type PortalJwtClaims =
  | { typ: 'owner'; sub: string }
  | { typ: 'portal_user'; sub: string; cid: string };

export async function signPortalOwnerSession(customerId: string): Promise<string> {
  const secret = getSessionSecretKey();
  return new SignJWT({ typ: 'owner' as const })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(customerId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret);
}

export async function signPortalUserSession(portalUserId: string, customerId: string): Promise<string> {
  const secret = getSessionSecretKey();
  return new SignJWT({ typ: 'portal_user' as const, cid: customerId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(portalUserId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret);
}

export async function verifyPortalSessionJwt(token: string): Promise<PortalJwtClaims | null> {
  try {
    const secret = getSessionSecretKey();
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const typ = payload.typ;
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    if (!sub) return null;
    if (typ === 'owner') return { typ: 'owner', sub };
    if (typ === 'portal_user') {
      const cid = typeof payload.cid === 'string' ? payload.cid : null;
      if (!cid) return null;
      return { typ: 'portal_user', sub, cid };
    }
    return null;
  } catch {
    return null;
  }
}

export function portalSessionCookieOptions(): {
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

export function clearedPortalSessionCookieOptions(): {
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
