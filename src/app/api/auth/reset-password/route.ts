import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      console.error('❌ No email provided');
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Determine the correct redirect URL based on environment
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.warmeleads.eu';
    const redirectUrl = `${baseUrl}/reset-password`;

    console.log('🔐 Password Reset Request:', {
      email,
      redirectUrl,
      timestamp: new Date().toISOString()
    });

    // Send password reset email via Supabase
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error('❌ Supabase Password Reset Error:', {
        error: error.message,
        status: error.status,
        name: error.name,
        email,
        timestamp: new Date().toISOString()
      });
      
      // Still return success for security (don't reveal if email exists)
      return NextResponse.json({ 
        success: true,
        debug: process.env.NODE_ENV === 'development' ? { error: error.message } : undefined
      });
    }

    console.log('✅ Password reset email sent successfully:', {
      email,
      data,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({ 
      success: true,
      debug: process.env.NODE_ENV === 'development' ? { sent: true } : undefined
    });
  } catch (error) {
    console.error('❌ Password reset request error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: 'Internal error', 
        details: error instanceof Error ? error.message : 'Unknown',
        debug: process.env.NODE_ENV === 'development' ? { error } : undefined
      },
      { status: 500 }
    );
  }
}
