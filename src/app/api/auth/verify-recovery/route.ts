import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { accessToken, refreshToken } = await req.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing access token' },
        { status: 400 }
      );
    }

    // Use SERVICE_ROLE key to validate the recovery token
    const supabase = createServerClient();

    // Verify the token by getting the user with it
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      console.error('❌ Recovery token validation failed:', error);
      return NextResponse.json(
        { error: 'Invalid or expired recovery token' },
        { status: 401 }
      );
    }

    console.log('✅ Recovery token validated for user:', user.email);

    // Return the validated tokens
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('❌ Error verifying recovery token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

