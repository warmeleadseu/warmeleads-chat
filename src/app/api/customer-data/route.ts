import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withAuth, withOwnership } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// Helper function to serialize dates for JSON
function serializeDates(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(item => serializeDates(item));
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = serializeDates(obj[key]);
      }
    }
    return serialized;
  }
  return obj;
}

// GET: Fetch customer data from Supabase (AUTHENTICATED)
export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    
    console.log('📊 GET /api/customer-data');
    console.log('  Customer ID:', customerId || 'ALL');
    
    const supabase = createServerClient();

    // Check ownership - user can only access their own data (unless admin)
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    const isAdmin = adminEmails.includes(user.email);
    
    // Fetch specific customer or all customers
    if (customerId) {
      // Security check: Can user access this customer?
      if (!isAdmin && customerId !== user.email) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      
      // Get customer with all related data
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select(`
          *,
          chat_messages(*),
          orders(*),
          open_invoices(*),
          leads(*, lead_branch_data(*))
        `)
        .eq('email', customerId)
        .single();

      if (customerError || !customer) {
        console.log(`ℹ️ No customer found: ${customerId}`);
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      console.log(`✅ Loaded customer data for ${customerId}`);
      
      // Transform to match expected format
      const customerData = {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        company: customer.company,
        status: customer.status,
        source: customer.source,
        hasAccount: customer.has_account,
        accountCreatedAt: customer.account_created_at,
        googleSheetId: customer.google_sheet_id,
        googleSheetUrl: customer.google_sheet_url,
        emailNotifications: {
          enabled: customer.email_notifications_enabled,
          newLeads: customer.email_notifications_new_leads,
          lastNotificationSent: customer.last_notification_sent,
        },
        createdAt: customer.created_at,
        lastActivity: customer.last_activity,
        chatHistory: customer.chat_messages || [],
        orders: customer.orders || [],
        openInvoices: customer.open_invoices || [],
        leadData: (customer.leads || []).map((lead: any) => ({
          ...lead,
          branchData: lead.lead_branch_data?.[0] || {}
        })),
      };

      return NextResponse.json({
        success: true,
        customerData
      });
    } else {
      // Get all customers
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching customers:', error);
        return NextResponse.json(
          { error: 'Failed to fetch customers', details: error.message },
          { status: 500 }
        );
      }

      console.log(`✅ Loaded ${customers?.length || 0} customers`);
      
      return NextResponse.json({
        success: true,
        customers: customers || []
      });
    }
  } catch (error) {
    console.error('❌ Error in GET /api/customer-data:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

// POST: Save customer data to Supabase (AUTHENTICATED)
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { customerId, customerData } = body;

    if (!customerId || !customerData) {
      return NextResponse.json(
        { error: 'Customer ID and data are required' },
        { status: 400 }
      );
    }
    
    // Security check: Can user modify this customer?
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    const isAdmin = adminEmails.includes(user.email);
    
    if (!isAdmin && customerId !== user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('💾 POST /api/customer-data');
    console.log('  Customer ID:', customerId);

    const supabase = createServerClient();

    // Upsert customer data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .upsert({
        email: customerId,
        name: customerData.name,
        phone: customerData.phone,
        company: customerData.company,
        status: customerData.status || 'lead',
        source: customerData.source || 'direct',
        has_account: customerData.hasAccount || false,
        account_created_at: customerData.accountCreatedAt,
        google_sheet_id: customerData.googleSheetId,
        google_sheet_url: customerData.googleSheetUrl,
        email_notifications_enabled: customerData.emailNotifications?.enabled ?? true,
        email_notifications_new_leads: customerData.emailNotifications?.newLeads ?? true,
        last_notification_sent: customerData.emailNotifications?.lastNotificationSent,
        last_activity: new Date().toISOString(),
      }, {
        onConflict: 'email'
      })
      .select()
      .single();

    if (customerError) {
      console.error('❌ Error upserting customer:', customerError);
      return NextResponse.json(
        { error: 'Failed to save customer', details: customerError.message },
        { status: 500 }
      );
    }

    // Save chat messages if present
    if (customerData.chatHistory && customerData.chatHistory.length > 0) {
      // Delete existing messages first
      await supabase
        .from('chat_messages')
        .delete()
        .eq('customer_id', customer.id);

      // Insert new messages
      const messages = customerData.chatHistory.map((msg: any) => ({
        customer_id: customer.id,
        type: msg.type,
        content: msg.content,
        step: msg.step,
        timestamp: msg.timestamp,
      }));

      const { error: messagesError } = await supabase
        .from('chat_messages')
        .insert(messages);

      if (messagesError) {
        console.warn('⚠️ Error saving chat messages:', messagesError);
      }
    }

    // Save leads if present
    if (customerData.leadData && customerData.leadData.length > 0) {
      for (const lead of customerData.leadData) {
        // Upsert lead
        const { data: savedLead, error: leadError } = await supabase
          .from('leads')
          .upsert({
            customer_id: customer.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            company: lead.company,
            address: lead.address,
            city: lead.city,
            interest: lead.interest,
            budget: lead.budget,
            timeline: lead.timeline,
            notes: lead.notes,
            status: lead.status || 'new',
            deal_value: lead.dealValue,
            profit: lead.profit,
            assigned_to: lead.assignedTo,
            source: lead.source || 'campaign',
            sheet_row_number: lead.sheetRowNumber,
            created_at: lead.createdAt,
            updated_at: lead.updatedAt || new Date().toISOString(),
          }, {
            onConflict: 'id'
          })
          .select()
          .single();

        if (leadError) {
          console.warn('⚠️ Error saving lead:', leadError);
          continue;
        }

        // Save branch data if present
        if (lead.branchData && savedLead) {
          const { error: branchError } = await supabase
            .from('lead_branch_data')
            .upsert({
              lead_id: savedLead.id,
              ...lead.branchData,
            }, {
              onConflict: 'lead_id'
            });

          if (branchError) {
            console.warn('⚠️ Error saving branch data:', branchError);
          }
        }
      }
    }

    console.log('✅ Successfully saved customer data to Supabase');

    return NextResponse.json({
      success: true,
      customerId,
    });
  } catch (error) {
    console.error('❌ Error in POST /api/customer-data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save customer data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

// DELETE: Remove customer data from Supabase (AUTHENTICATED + ADMIN ONLY)
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
    
    // Only admins can delete customers
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    if (!adminEmails.includes(user.email)) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    console.log('🗑️ DELETE /api/customer-data');
    console.log('  Customer ID:', customerId);

    const supabase = createServerClient();

    // Delete customer (CASCADE will delete related data)
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('email', customerId);

    if (error) {
      console.error('❌ Error deleting customer:', error);
      return NextResponse.json(
        { error: 'Failed to delete customer', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Successfully deleted customer');

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error in DELETE /api/customer-data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete customer',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}, { adminOnly: true });
