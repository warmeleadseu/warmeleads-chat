import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/admin/customers
 * 
 * Fetch all customers using SERVICE_ROLE key (bypasses RLS)
 * This is secure because it's server-side only
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Environment check:');
    console.log('   NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('   SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('   SUPABASE_SERVICE_ROLE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
    
    const supabase = createServerClient();

    console.log('🔍 Fetching customers from Supabase...');

    // Fetch all customers with their related data
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .order('last_activity', { ascending: false });

    if (error) {
      console.error('❌ Error fetching customers:', error);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          code: error.code,
          hint: error.hint || 'Check Supabase credentials and RLS policies'
        },
        { status: 500 }
      );
    }

    console.log(`✅ Fetched ${customers?.length || 0} customers via SERVICE_ROLE`);
    
    if (customers && customers.length > 0) {
      console.log(`   First customer: ${customers[0].email}`);
      console.log(`   Has google_sheet_id: ${!!customers[0].google_sheet_id}`);
    }
    
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
      branch_id: customer.branch_id, // ✅ Include branch_id for dynamic parsing
      emailNotifications: {
        enabled: customer.email_notifications_enabled || false,
        newLeads: customer.email_notifications_new_leads || false,
        lastNotificationSent: customer.last_notification_sent
      },
      createdAt: customer.created_at,
      lastActivity: customer.last_activity,
      chatHistory: [], // Empty for now - will load separately if needed
      orders: [], // Empty for now - will load separately if needed
      openInvoices: [], // Empty for now - will load separately if needed
      dataHistory: [], // Empty for now - will load separately if needed
      leadData: [], // Empty for now - will load separately if needed
      notes: [],
      tags: [],
      whatsappConfig: {
        enabled: false,
        phoneNumber: '',
        notificationTypes: []
      }
    }));

    const response = NextResponse.json({
      success: true,
      customers: transformedCustomers,
      count: transformedCustomers.length
    });

    // Prevent any caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

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

/**
 * POST /api/admin/customers
 * 
 * Create a new customer manually
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();

    const { email, name, phone, company, contactPerson } = body;

    // Validation
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Geldig email adres is verplicht' },
        { status: 400 }
      );
    }

    // Check if customer already exists
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('email')
      .eq('email', email)
      .single();

    if (existingCustomer) {
      return NextResponse.json(
        { success: false, error: 'Een klant met dit email adres bestaat al' },
        { status: 409 }
      );
    }

    // Create new customer
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        email,
        name: name || null,
        phone: phone || null,
        company: company || null,
        contact_person: contactPerson || null,
        status: 'customer',
        source: 'manual',
        has_account: false,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating customer:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Created new customer: ${newCustomer.email}`);

    return NextResponse.json({
      success: true,
      customer: {
        id: newCustomer.id,
        email: newCustomer.email,
        name: newCustomer.name,
        phone: newCustomer.phone,
        company: newCustomer.company,
        contactPerson: newCustomer.contact_person,
      }
    });
  } catch (error: any) {
    console.error('💥 Unexpected error in POST /api/admin/customers:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
