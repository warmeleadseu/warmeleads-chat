import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { accessToken, newPassword } = await req.json();

    if (!accessToken || !newPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Use SERVICE_ROLE key to update the password
    const supabase = createServerClient();

    // First verify the token is valid and get the user
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(accessToken);

    if (getUserError || !user) {
      console.error('❌ Invalid recovery token:', getUserError);
      return NextResponse.json(
        { error: 'Invalid or expired recovery token' },
        { status: 401 }
      );
    }

    console.log('✅ Updating password for user:', user.email);

    // Update the user's password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    console.log('✅ Password updated successfully for:', user.email);

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('❌ Error updating password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

