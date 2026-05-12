import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  signAdminSession,
} from '@/lib/adminSession';
import { adminAuthDebugServer, adminAuthDebugServerEnabled, redactEmail } from '@/lib/adminAuthDebug';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { limited, response } = rateLimit(ip, 'admin-login', MAX_ATTEMPTS, WINDOW_MS);
    if (limited) {
      if (adminAuthDebugServerEnabled()) {
        adminAuthDebugServer('POST /api/admin/auth/login: rate limited', { ip: ip.slice(0, 12) });
      }
      return response!;
    }

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email en wachtwoord zijn verplicht' }, { status: 400 });
    }

    if (adminAuthDebugServerEnabled()) {
      adminAuthDebugServer('POST /api/admin/auth/login: poging', { email: redactEmail(String(email)) });
    }

    const supabase = createServerClient();

    const { data: user, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      if (adminAuthDebugServerEnabled()) {
        adminAuthDebugServer('POST /api/admin/auth/login: user niet gevonden of DB-fout', {
          supabaseMessage: error?.message ?? null,
        });
      }
      return NextResponse.json({ error: 'Ongeldige inloggegevens' }, { status: 401 });
    }

    if (!user.is_active) {
      if (adminAuthDebugServerEnabled()) {
        adminAuthDebugServer('POST /api/admin/auth/login: account inactief', { id: user.id });
      }
      return NextResponse.json({ error: 'Account is gedeactiveerd' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      if (adminAuthDebugServerEnabled()) {
        adminAuthDebugServer('POST /api/admin/auth/login: wachtwoord mismatch', { id: user.id });
      }
      return NextResponse.json({ error: 'Ongeldige inloggegevens' }, { status: 401 });
    }

    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    await logAudit({
      adminId: user.id,
      adminName: user.name,
      action: 'login',
      entityType: 'admin_user',
      entityId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
    });

    const sessionJwt = await signAdminSession(user.id);

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_account_manager: !!user.is_account_manager,
        avatar_url: user.avatar_url ?? null,
      },
    });

    res.cookies.set(ADMIN_SESSION_COOKIE, sessionJwt, adminSessionCookieOptions());

    if (adminAuthDebugServerEnabled()) {
      adminAuthDebugServer('POST /api/admin/auth/login: succes, cookie gezet', {
        userId: user.id,
        role: user.role,
        cookieName: ADMIN_SESSION_COOKIE,
        jwtLength: sessionJwt.length,
      });
    }

    return res;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Inloggen mislukt' }, { status: 500 });
  }
}
