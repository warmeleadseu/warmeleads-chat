import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

// GET - Check if lead has been reclaimed (AUTHENTICATED)
export const GET = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const sheetRowNumber = searchParams.get('sheetRowNumber');

    if (!customerId || !sheetRowNumber) {
      return NextResponse.json(
        { error: 'Customer ID and sheet row number are required' },
        { status: 400 }
      );
    }

    // Security: User can only check their own reclamations (unless admin)
    if (customerId !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only check your own reclamations' },
        { status: 403 }
      );
    }

    console.log('🔍 Checking reclamation for:', { customerId, sheetRowNumber });

    const supabase = createServerClient();

    // Get customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customerId)
      .single();

    if (!customer) {
      return NextResponse.json({ reclaimed: false });
    }

    // Check for reclamation
    const { data: reclamation, error } = await supabase
      .from('lead_reclamations')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('sheet_row_number', parseInt(sheetRowNumber))
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is OK
      console.error('❌ Error checking reclamation:', error);
      return NextResponse.json(
        { error: 'Failed to check reclamation', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Reclamation check complete');

    return NextResponse.json({
      reclaimed: !!reclamation,
      reclamation: reclamation || null
    });
  } catch (error) {
    console.error('❌ Error in GET /api/reclaim-lead:', error);
    return NextResponse.json(
      { error: 'Failed to check reclamation' },
      { status: 500 }
    );
  }
});

// POST - Create a lead reclamation (AUTHENTICATED)
export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await req.json();
    const { customerId, lead, reason, description } = body;

    if (!customerId || !lead || !reason) {
      return NextResponse.json(
        { error: 'Customer ID, lead, and reason are required' },
        { status: 400 }
      );
    }

    if (!lead.sheetRowNumber) {
      return NextResponse.json(
        { error: 'Lead must have a sheet row number' },
        { status: 400 }
      );
    }

    // Security: User can only create reclamations for themselves (unless admin)
    if (customerId !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only create reclamations for yourself' },
        { status: 403 }
      );
    }

    console.log('📝 Creating reclamation for:', { customerId, sheetRowNumber: lead.sheetRowNumber });

    const supabase = createServerClient();

    // Get customer
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

    // Get lead ID if exists
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('email', lead.email)
      .single();

    // Check if already reclaimed
    const { data: existing } = await supabase
      .from('lead_reclamations')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('sheet_row_number', lead.sheetRowNumber)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Lead has already been reclaimed' },
        { status: 409 }
      );
    }

    // Create reclamation
    const { data: reclamation, error } = await supabase
      .from('lead_reclamations')
      .insert({
        customer_id: customer.id,
        lead_id: existingLead?.id || null,
        sheet_row_number: lead.sheetRowNumber,
        reason: reason,
        description: description || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating reclamation:', error);
      return NextResponse.json(
        { error: 'Failed to create reclamation', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Reclamation created successfully');

    return NextResponse.json({
      success: true,
      reclamation: reclamation,
      message: 'Reclamation submitted successfully'
    });
  } catch (error) {
    console.error('❌ Error in POST /api/reclaim-lead:', error);
    return NextResponse.json(
      { error: 'Failed to create reclamation' },
      { status: 500 }
    );
  }
});
