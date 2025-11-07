import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '@/config/admin';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';
import { createServerClient } from '@/lib/supabase';

// Manage account: activate, deactivate, or delete (ADMIN ONLY)
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { action, email, adminEmail } = await request.json();

    // Verify admin via withAuth (user is already authenticated)
    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!email || !action) {
      return NextResponse.json({ error: 'Email and action are required' }, { status: 400 });
    }

    console.log(`🔧 Account management: ${action} for ${email}`);

    const supabase = createServerClient();
    const normalizedEmail = email.toLowerCase();
    
    if (action === 'delete') {
      await supabase.from('users').delete().eq('email', normalizedEmail);
      await supabase.from('company_employees').delete().eq('employee_email', normalizedEmail);

      console.log(`✅ Deleted account: ${normalizedEmail}`);
      return NextResponse.json({
        success: true,
        message: `Account ${normalizedEmail} verwijderd`
      });
    }

    if (action === 'activate' || action === 'deactivate') {
      const isActive = action === 'activate';
      const now = new Date().toISOString();

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          is_active: isActive,
          updated_at: now,
        })
        .eq('email', normalizedEmail)
        .select('email, name, company, phone, is_active, role')
        .single();

      if (updateError) {
        console.error('❌ Failed to update account:', updateError);
        return NextResponse.json({ error: 'Account niet gevonden' }, { status: 404 });
      }

      await supabase
        .from('company_employees')
        .update({ is_active: isActive, updated_at: now })
        .eq('employee_email', normalizedEmail);

      console.log(`✅ Account ${action}d: ${normalizedEmail}`);

      return NextResponse.json({
        success: true,
        message: `Account ${isActive ? 'geactiveerd' : 'gedeactiveerd'}`,
        user: updatedUser,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('❌ Error managing account:', error);
    return NextResponse.json(
      { error: 'Failed to manage account', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}, { adminOnly: true });

