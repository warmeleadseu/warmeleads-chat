import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServerClient } from '@/lib/supabase';

// Public endpoint - employee activation with email/password only
// Security: No auth required, but validates employee account exists
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email en wachtwoord zijn verplicht' }, { status: 400 });
    }

    console.log('🔑 POST /api/auth/activate-employee - Activating:', email);

    const supabase = createServerClient();
    const normalizedEmail = email.toLowerCase();

    const { data: accountData, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (fetchError || !accountData) {
      console.error('❌ Employee account not found:', fetchError);
      return NextResponse.json({ error: 'Account niet gevonden' }, { status: 404 });
    }

    if (accountData.role !== 'employee' || !accountData.needs_password_reset) {
      return NextResponse.json({ error: 'Account kan niet worden geactiveerd' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        needs_password_reset: false,
        is_active: true,
        updated_at: now,
      })
      .eq('email', normalizedEmail);

    if (updateError) {
      console.error('❌ Failed to update employee account:', updateError);
      return NextResponse.json({ error: 'Fout bij het activeren van account' }, { status: 500 });
    }

    if (accountData.owner_email) {
      await supabase
        .from('company_employees')
        .update({
          is_active: true,
          needs_password_reset: false,
          accepted_at: now,
          updated_at: now,
        })
        .eq('owner_email', accountData.owner_email)
        .eq('employee_email', normalizedEmail);
    }

    console.log('✅ Employee account activated:', email);

    return NextResponse.json({
      success: true,
      message: 'Account succesvol geactiveerd',
      employee: {
        email: normalizedEmail,
        name: accountData.name,
        isActive: true,
        activatedAt: now,
      }
    });
  } catch (error) {
    console.error('❌ Error in POST /api/auth/activate-employee:', error);
    return NextResponse.json({ error: 'Er is een onverwachte fout opgetreden' }, { status: 500 });
  }
}
