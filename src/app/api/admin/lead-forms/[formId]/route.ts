/**
 * Admin API: Update/Delete Lead Form
 * PUT /api/admin/lead-forms/[formId] - Update form
 * DELETE /api/admin/lead-forms/[formId] - Delete form
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ formId: string }> }
) {
  try {
    const params = await context.params;
    const { formId } = params;
    const supabase = createServerClient();
    const body = await request.json();

    const { formName, branchId, isActive, notes } = body;

    const updates: any = {};
    if (formName !== undefined) updates.form_name = formName;
    if (branchId !== undefined) updates.branch_id = branchId;
    if (isActive !== undefined) updates.is_active = isActive;
    if (notes !== undefined) updates.notes = notes;
    updates.updated_at = new Date().toISOString();

    const { data: form, error } = await supabase
      .from('meta_lead_forms')
      .update(updates)
      .eq('id', formId)
      .select()
      .single();

    if (error) {
      console.error('Error updating lead form:', error);
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
        lastLeadReceivedAt: form.last_lead_received_at,
        createdAt: form.created_at,
        notes: form.notes
      }
    });
  } catch (error) {
    console.error('Admin lead form update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ formId: string }> }
) {
  try {
    const params = await context.params;
    const { formId } = params;
    const supabase = createServerClient();

    const { error } = await supabase
      .from('meta_lead_forms')
      .delete()
      .eq('id', formId);

    if (error) {
      console.error('Error deleting lead form:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin lead form delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

