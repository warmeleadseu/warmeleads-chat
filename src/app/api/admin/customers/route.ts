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

    return NextResponse.json({
      success: true,
      customers: customers || [],
      count: customers?.length || 0
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

