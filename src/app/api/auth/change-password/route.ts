import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, currentPassword, newPassword } = await request.json();

    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'E-mailadres, huidig wachtwoord en nieuw wachtwoord zijn vereist' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Nieuw wachtwoord moet minimaal 8 karakters bevatten' },
        { status: 400 }
      );
    }

    console.log('🔐 Changing password for:', email);

    const supabase = createServerClient();

    // Get current account data from Supabase
    const { data: accountData, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('email', email.toLowerCase())
      .single();

    if (fetchError || !accountData) {
      return NextResponse.json(
        { error: 'Account niet gevonden' },
        { status: 404 }
      );
    }

    console.log('✅ Found existing account data');

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, accountData.password_hash);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Huidig wachtwoord is onjuist' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password in Supabase
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        password_hash: hashedNewPassword,
        needs_password_reset: false, // Reset this flag when password is changed
      })
      .eq('email', email.toLowerCase());

    if (updateError) {
      console.error('❌ Supabase update error:', updateError);
      return NextResponse.json(
        { error: 'Fout bij het wijzigen van wachtwoord', details: updateError.message },
        { status: 500 }
      );
    }

    console.log('✅ Password changed successfully:', {
      email
    });

    return NextResponse.json({
      success: true,
      message: 'Wachtwoord succesvol gewijzigd'
    });

  } catch (error) {
    console.error('❌ Password change error:', error);
    return NextResponse.json(
      { error: 'Er is een onverwachte fout opgetreden' },
      { status: 500 }
    );
  }
}
