/**
 * DEBUG API Route: Raw Customers Data
 * Shows exactly what's in the database right now
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = createServerClient();

    console.log('🔍 DEBUG: Fetching raw customers...');

    // Get ALL customers from database
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, email, name, google_sheet_id, google_sheet_url, created_at, has_account')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // Get ALL users from database
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, company_name, created_at')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      customers: {
        count: customers?.length || 0,
        data: customers || []
      },
      users: {
        count: users?.length || 0,
        data: users || []
      },
      customersWithSheets: customers?.filter((c: any) => c.google_sheet_id) || [],
      customersWithSheetsCount: customers?.filter((c: any) => c.google_sheet_id).length || 0
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

