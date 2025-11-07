import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_CONFIG } from '@/config/admin';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';
import { createServerClient } from '@/lib/supabase';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Admin only - list all registered accounts
export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    // Auth check via withAuth middleware (user is already authenticated)
    const allowedAdmins = ADMIN_CONFIG.adminEmails;
    
    if (!allowedAdmins.includes(user.email)) {
      console.warn('⚠️ Unauthorized access attempt to list-accounts:', user.email);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    console.log('✅ Authorized admin access:', user.email);
    
    const supabase = createServerClient();
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('email, name, company, phone, created_at, role, is_active, needs_password_reset')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Supabase error fetching users:', fetchError);
      return NextResponse.json({ error: 'Failed to list accounts' }, { status: 500 });
    }

    const accounts = (users || []).map((user) => ({
      email: user.email,
      name: user.name,
      company: user.company,
      phone: user.phone,
      createdAt: user.created_at,
      role: user.role,
      isActive: user.is_active,
      needsPasswordReset: user.needs_password_reset,
    }));

    return NextResponse.json({
      success: true,
      count: accounts.length,
      accounts
    });
    
  } catch (error) {
    console.error('❌ Error in GET /api/auth/list-accounts:', error);
    return NextResponse.json(
      { error: 'Failed to list accounts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}, { adminOnly: true });
