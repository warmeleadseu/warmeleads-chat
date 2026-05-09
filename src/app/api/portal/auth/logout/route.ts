import { NextResponse } from 'next/server';
import {
  PORTAL_SESSION_COOKIE,
  clearedPortalSessionCookieOptions,
} from '@/lib/portalSession';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(PORTAL_SESSION_COOKIE, '', clearedPortalSessionCookieOptions());
  return res;
}
