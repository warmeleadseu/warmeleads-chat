import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

// GET: Fetch user preferences (AUTHENTICATED)
export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Security: User can only fetch their own preferences (unless admin)
    if (customerId !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only access your own preferences' },
        { status: 403 }
      );
    }

    console.log('⚙️ GET /api/user-preferences for:', customerId);

    const supabase = createServerClient();

    // Get customer first to get their ID
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customerId)
      .single();

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get preferences
    const { data: prefs, error } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('customer_id', customer.id)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is OK
      console.error('❌ Error fetching preferences:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preferences', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Preferences loaded');

    return NextResponse.json({
      success: true,
      preferences: prefs?.preferences || {}
    });
  } catch (error) {
    console.error('❌ Error in GET /api/user-preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
});

// POST: Save user preferences (AUTHENTICATED)
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { customerId, preferences } = await request.json();

    if (!customerId || !preferences) {
      return NextResponse.json(
        { error: 'Customer ID and preferences are required' },
        { status: 400 }
      );
    }

    // Security: User can only update their own preferences (unless admin)
    if (customerId !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only update your own preferences' },
        { status: 403 }
      );
    }

    console.log('💾 POST /api/user-preferences for:', customerId);

    const supabase = createServerClient();

    // Get customer first
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customerId)
      .single();

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Upsert preferences
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        customer_id: customer.id,
        preferences: preferences
      }, {
        onConflict: 'customer_id'
      });

    if (error) {
      console.error('❌ Error saving preferences:', error);
      return NextResponse.json(
        { error: 'Failed to save preferences', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Preferences saved');

    return NextResponse.json({
      success: true,
      message: 'Preferences saved successfully'
    });
  } catch (error) {
    console.error('❌ Error in POST /api/user-preferences:', error);
    return NextResponse.json(
      { error: 'Failed to save preferences' },
      { status: 500 }
    );
  }
});

// DELETE: Delete user preferences (AUTHENTICATED)
export const DELETE = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Security: User can only delete their own preferences (unless admin)
    if (customerId !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only delete your own preferences' },
        { status: 403 }
      );
    }

    console.log('🗑️ DELETE /api/user-preferences for:', customerId);

    const supabase = createServerClient();

    // Get customer first
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customerId)
      .single();

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Delete preferences
    const { error } = await supabase
      .from('user_preferences')
      .delete()
      .eq('customer_id', customer.id);

    if (error) {
      console.error('❌ Error deleting preferences:', error);
      return NextResponse.json(
        { error: 'Failed to delete preferences', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Preferences deleted');

    return NextResponse.json({
      success: true,
      message: 'Preferences deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error in DELETE /api/user-preferences:', error);
    return NextResponse.json(
      { error: 'Failed to delete preferences' },
      { status: 500 }
    );
  }
});
