/**
 * API Route: Single Branch Management
 * GET: Get branch details with mappings
 * PUT: Update branch
 * DELETE: Delete branch
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: { branchId: string } }
) {
  try {
    const branchId = params.branchId;

    // Get branch with all related data
    const { data: branch, error: branchError } = await supabase
      .from('branch_definitions')
      .select('*')
      .eq('id', branchId)
      .single();

    if (branchError) throw branchError;

    // Get field mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from('branch_field_mappings')
      .select('*')
      .eq('branch_id', branchId)
      .order('column_index', { ascending: true });

    if (mappingsError) throw mappingsError;

    // Get email templates
    const { data: templates, error: templatesError } = await supabase
      .from('branch_email_templates')
      .select('*')
      .eq('branch_id', branchId);

    if (templatesError) throw templatesError;

    return NextResponse.json({
      branch: {
        ...branch,
        fieldMappings: mappings || [],
        emailTemplates: templates || []
      }
    });
  } catch (error: any) {
    console.error('Error fetching branch:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { branchId: string } }
) {
  try {
    const branchId = params.branchId;
    const body = await req.json();
    const { displayName, description, icon, isActive } = body;

    const updates: any = { updated_at: new Date().toISOString() };
    if (displayName) updates.display_name = displayName;
    if (description !== undefined) updates.description = description;
    if (icon) updates.icon = icon;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data: branch, error } = await supabase
      .from('branch_definitions')
      .update(updates)
      .eq('id', branchId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ branch });
  } catch (error: any) {
    console.error('Error updating branch:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { branchId: string } }
) {
  try {
    const branchId = params.branchId;

    // Check if any customers are using this branch
    const { data: customers, error: checkError } = await supabase
      .from('customers')
      .select('id')
      .eq('branch_id', branchId)
      .limit(1);

    if (checkError) throw checkError;

    if (customers && customers.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete branch with active customers' },
        { status: 400 }
      );
    }

    // Delete branch (cascades to mappings and templates)
    const { error } = await supabase
      .from('branch_definitions')
      .delete()
      .eq('id', branchId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting branch:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}


