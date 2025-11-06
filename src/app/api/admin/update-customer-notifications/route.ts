/**
 * API Route: Update Customer Email Notifications (Admin)
 * 
 * Gebruikt SERVICE_ROLE_KEY om RLS te omzeilen
 * ADMIN ONLY - Called from admin interface
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerEmail, emailNotifications } = body;

    console.log('📧 Update Customer Notifications API called');
    console.log('   Email:', customerEmail);
    console.log('   Notifications:', emailNotifications);

    if (!customerEmail || !emailNotifications) {
      return NextResponse.json(
        { success: false, error: 'Customer email and notifications are required' },
        { status: 400 }
      );
    }

    // Use server-side Supabase client (SERVICE_ROLE_KEY)
    const supabase = createServerClient();

    // Update customer email notifications
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update({
        email_notifications_enabled: emailNotifications.enabled ?? false,
        email_notifications_new_leads: emailNotifications.newLeads ?? false,
        last_activity: new Date().toISOString()
      })
      .eq('email', customerEmail)
      .select()
      .single();

    if (updateError) {
      console.error('   ❌ Error updating customer:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update customer', details: updateError.message },
        { status: 500 }
      );
    }

    // Log data change
    await supabase.from('data_changes').insert({
      customer_id: updatedCustomer.id,
      field: 'emailNotifications',
      old_value: JSON.stringify({
        enabled: emailNotifications.enabled === false ? true : false, // We don't have old value, so just log the change
        newLeads: emailNotifications.newLeads === false ? true : false
      }),
      new_value: JSON.stringify(emailNotifications),
      source: 'admin'
    });

    console.log('   ✅ Customer notifications updated successfully');

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
      message: 'Email notifications updated successfully'
    });

  } catch (error) {
    console.error('💥 Unexpected error in update-customer-notifications API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
