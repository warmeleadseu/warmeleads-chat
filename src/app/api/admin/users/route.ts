import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users
 * 
 * Fetch all registered users using SERVICE_ROLE key (bypasses RLS)
 * This is secure because it's server-side only
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Fetch all users (registered accounts)
    const { data: users, error } = await supabase
      .from('users')
      .select('email, name, company, phone, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching users:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          hint: 'Check Supabase credentials and RLS policies'
        },
        { status: 500 }
      );
    }

    console.log(`✅ Fetched ${users?.length || 0} registered users via SERVICE_ROLE`);

    return NextResponse.json({
      success: true,
      users: users || [],
      count: users?.length || 0
    });

  } catch (error: any) {
    console.error('💥 Server error fetching users:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown server error'
      },
      { status: 500 }
    );
  }
}

