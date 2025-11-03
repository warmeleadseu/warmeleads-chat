import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Determine the correct redirect URL based on environment
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.warmeleads.eu';
    const redirectUrl = `${baseUrl}/reset-password`;

    console.log('🔐 Sending password reset email:', { email, redirectUrl });

    // Send password reset email via Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error('Password reset error:', error);
      // Don't reveal if email exists for security
      return NextResponse.json({ success: true });
    }

    console.log('✅ Password reset email sent successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}

