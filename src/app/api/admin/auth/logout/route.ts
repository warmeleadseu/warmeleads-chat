import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  clearedAdminSessionCookieOptions,
} from '@/lib/adminSession';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, '', clearedAdminSessionCookieOptions());
  return res;
}
