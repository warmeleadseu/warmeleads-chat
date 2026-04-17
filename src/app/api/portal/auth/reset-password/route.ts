import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { limited, response } = rateLimit(ip, 'reset-password', MAX_ATTEMPTS, WINDOW_MS);
    if (limited) return response!;

    const { token, password } = await request.json();
    if (!token || !password) {
      return NextResponse.json({ error: 'Token en wachtwoord zijn verplicht' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Wachtwoord moet minimaal 8 tekens bevatten' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: resetToken } = await supabase
      .from('password_reset_tokens')
      .select('id, customer_id, portal_user_id, expires_at, used_at')
      .eq('token', token)
      .single();

    if (!resetToken) {
      return NextResponse.json({ error: 'Ongeldige of verlopen link' }, { status: 400 });
    }

    if (resetToken.used_at) {
      return NextResponse.json({ error: 'Deze link is al gebruikt' }, { status: 400 });
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Deze link is verlopen. Vraag een nieuwe aan.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    if (resetToken.portal_user_id) {
      const { error: updateError } = await supabase
        .from('portal_users')
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq('id', resetToken.portal_user_id);

      if (updateError) {
        return NextResponse.json({ error: 'Wachtwoord kon niet worden bijgewerkt' }, { status: 500 });
      }
    } else {
      const { error: updateError } = await supabase
        .from('customers')
        .update({ password_hash: passwordHash, portal_password: passwordHash })
        .eq('id', resetToken.customer_id);

      if (updateError) {
        return NextResponse.json({ error: 'Wachtwoord kon niet worden bijgewerkt' }, { status: 500 });
      }
    }

    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetToken.id);

    return NextResponse.json({ success: true, message: 'Wachtwoord is succesvol gewijzigd' });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
