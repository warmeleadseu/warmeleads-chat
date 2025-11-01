import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/customers
 * 
 * Fetch all customers using SERVICE_ROLE key (bypasses RLS)
 * This is secure because it's server-side only
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Fetch all customers with their related data
    const { data: customers, error } = await supabase
      .from('customers')
      .select(`
        *,
        chat_messages(*),
        orders(*),
        open_invoices(*),
        data_changes(*),
        leads(*, lead_branch_data(*))
      `)
      .order('last_activity', { ascending: false });

    if (error) {
      console.error('❌ Error fetching customers:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          hint: 'Check Supabase credentials and RLS policies'
        },
        { status: 500 }
      );
    }

    console.log(`✅ Fetched ${customers?.length || 0} customers via SERVICE_ROLE`);
    
    // Transform snake_case to camelCase for frontend
    const transformedCustomers = (customers || []).map((customer: any) => ({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      company: customer.company,
      status: customer.status,
      source: customer.source,
      hasAccount: customer.has_account,
      accountCreatedAt: customer.account_created_at,
      googleSheetId: customer.google_sheet_id,  // ✅ Transform to camelCase
      googleSheetUrl: customer.google_sheet_url, // ✅ Transform to camelCase
      emailNotifications: {
        enabled: customer.email_notifications_enabled,
        newLeads: customer.email_notifications_new_leads,
        lastNotificationSent: customer.last_notification_sent
      },
      createdAt: customer.created_at,
      lastActivity: customer.last_activity,
      chatHistory: customer.chat_messages || [],
      orders: customer.orders || [],
      openInvoices: customer.open_invoices || [],
      dataHistory: customer.data_changes || [],
      leadData: customer.leads || [],
      notes: [],
      tags: [],
      whatsappConfig: {
        enabled: false,
        phoneNumber: '',
        notificationTypes: []
      }
    }));

    return NextResponse.json({
      success: true,
      customers: transformedCustomers,
      count: transformedCustomers.length
    });

  } catch (error: any) {
    console.error('💥 Server error fetching customers:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown server error'
      },
      { status: 500 }
    );
  }
}

