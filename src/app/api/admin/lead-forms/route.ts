/**
 * Admin API: Meta Lead Forms Management
 * GET /api/admin/lead-forms - List all forms
 * POST /api/admin/lead-forms - Create new form
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch');

    let query = supabase
      .from('meta_lead_forms')
      .select('*')
      .order('created_at', { ascending: false });

    if (branch && branch !== 'all') {
      query = query.eq('branch_id', branch);
    }

    const { data: forms, error } = await query;

    if (error) {
      console.error('Error fetching lead forms:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert snake_case to camelCase
    const formsFormatted = forms?.map(form => ({
      id: form.id,
      formId: form.form_id,
      formName: form.form_name,
      branchId: form.branch_id,
      isActive: form.is_active,
      totalLeadsReceived: form.total_leads_received,
      lastLeadReceivedAt: form.last_lead_received_at,
      createdAt: form.created_at,
      notes: form.notes
    })) || [];

    return NextResponse.json({ forms: formsFormatted });
  } catch (error) {
    console.error('Admin lead forms API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();

    const { formId, formName, branchId, notes } = body;

    if (!formId || !formName || !branchId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data: form, error } = await supabase
      .from('meta_lead_forms')
      .insert({
        form_id: formId,
        form_name: formName,
        branch_id: branchId,
        notes: notes || null,
        is_active: true,
        total_leads_received: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead form:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      form: {
        id: form.id,
        formId: form.form_id,
        formName: form.form_name,
        branchId: form.branch_id,
        isActive: form.is_active,
        totalLeadsReceived: form.total_leads_received,
        createdAt: form.created_at,
        notes: form.notes
      }
    });
  } catch (error) {
    console.error('Admin lead forms create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

