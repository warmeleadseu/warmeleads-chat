/**
 * API Route: Link Google Sheet to Customer
 * 
 * Gebruikt SERVICE_ROLE_KEY om RLS te omzeilen
 * Maakt eerst een CRM customer record aan als die niet bestaat
 * 
 * ADMIN ONLY - Called from admin interface (already authenticated via localStorage)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerEmail, sheetUrl, branchId } = body;

    console.log('🔗 Link Sheet API called');
    console.log('   Email:', customerEmail);
    console.log('   Sheet URL:', sheetUrl);

    if (!customerEmail || !sheetUrl) {
      return NextResponse.json(
        { success: false, error: 'Email and Sheet URL are required' },
        { status: 400 }
      );
    }

    // Validate Sheet URL
    if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
      return NextResponse.json(
        { success: false, error: 'Invalid Google Sheets URL' },
        { status: 400 }
      );
    }

    // Extract Sheet ID from URL
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Could not extract Sheet ID from URL' },
        { status: 400 }
      );
    }

    const sheetId = match[1];
    console.log('   Extracted Sheet ID:', sheetId);

    // Use server-side Supabase client (SERVICE_ROLE_KEY)
    const supabase = createServerClient();

    // Check if customer exists in CRM
    console.log('   🔍 Checking if customer exists...');
    const { data: existingCustomer, error: fetchError } = await supabase
      .from('customers')
      .select('id, email, name, google_sheet_id, google_sheet_url')
      .eq('email', customerEmail)
      .maybeSingle();

    if (fetchError) {
      console.error('   ❌ Error fetching customer:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Database error', details: fetchError.message },
        { status: 500 }
      );
    }

    let customerId: string;

    if (existingCustomer) {
      // Customer exists - update with sheet info
      console.log('   ✅ Customer exists, updating...');
      customerId = existingCustomer.id;

      const updateData: any = {
        google_sheet_id: sheetId,
        google_sheet_url: sheetUrl,
        last_activity: new Date().toISOString()
      };
      
      // Set branch_id if provided
      if (branchId) {
        updateData.branch_id = branchId;
        console.log('   🔗 Setting branch_id:', branchId);
      }
      
      const { error: updateError } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId);

      if (updateError) {
        console.error('   ❌ Error updating customer:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update customer', details: updateError.message },
          { status: 500 }
        );
      }

      // Log data change
      await supabase.from('data_changes').insert({
        customer_id: customerId,
        field: 'googleSheetId',
        old_value: existingCustomer.google_sheet_id || null,
        new_value: sheetId,
        source: 'admin'
      });

      console.log('   ✅ Customer updated successfully');
    } else {
      // Customer doesn't exist - create new CRM record
      console.log('   ➕ Customer not in CRM, creating new record...');

      // Get user name from users table if exists
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, company_name')
        .eq('email', customerEmail)
        .maybeSingle();

      const name = userData?.company_name || customerEmail.split('@')[0];
      const company = userData?.company_name || null;

      const insertData: any = {
        email: customerEmail,
        name: name,
        company: company,
        status: 'customer',
        source: 'direct',
        google_sheet_id: sheetId,
        google_sheet_url: sheetUrl,
        has_account: true,
        last_activity: new Date().toISOString()
      };
      
      // Set branch_id if provided
      if (branchId) {
        insertData.branch_id = branchId;
        console.log('   🔗 Setting branch_id for new customer:', branchId);
      }
      
      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert(insertData)
        .select('id')
        .single();

      if (insertError) {
        console.error('   ❌ Error creating customer:', insertError);
        return NextResponse.json(
          { success: false, error: 'Failed to create customer', details: insertError.message },
          { status: 500 }
        );
      }

      customerId = newCustomer.id;

      // Log data change
      await supabase.from('data_changes').insert({
        customer_id: customerId,
        field: 'googleSheetId',
        old_value: null,
        new_value: sheetId,
        source: 'admin'
      });

      console.log('   ✅ New customer created with Sheet linked');
    }

    return NextResponse.json({
      success: true,
      customerId,
      sheetId,
      sheetUrl,
      message: 'Google Sheet succesvol gekoppeld'
    });

  } catch (error) {
    console.error('💥 Unexpected error in link-sheet API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

