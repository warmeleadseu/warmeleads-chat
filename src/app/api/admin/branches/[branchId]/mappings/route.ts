/**
 * API Route: Field Mappings Management
 * POST: Save field mappings for a branch
 * PUT: Update single field mapping
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  { params }: { params: { branchId: string } }
) {
  try {
    const branchId = params.branchId;
    const body = await req.json();
    const { mappings } = body;

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { error: 'Mappings must be an array' },
        { status: 400 }
      );
    }

    // Delete existing mappings
    await supabase
      .from('branch_field_mappings')
      .delete()
      .eq('branch_id', branchId);

    // Insert new mappings
    const mappingsToInsert = mappings.map(m => ({
      branch_id: branchId,
      column_letter: m.columnLetter,
      column_index: m.columnIndex,
      header_name: m.headerName,
      field_key: m.fieldKey,
      field_label: m.fieldLabel,
      field_type: m.fieldType,
      is_required: m.isRequired || false,
      is_unique: m.isUnique || false,
      validation_regex: m.validationRegex || null,
      show_in_list: m.showInList !== undefined ? m.showInList : true,
      show_in_detail: m.showInDetail !== undefined ? m.showInDetail : true,
      include_in_email: m.includeInEmail || false,
      email_priority: m.emailPriority || 0,
      help_text: m.helpText || null,
      placeholder: m.placeholder || null,
      sort_order: m.sortOrder || m.columnIndex
    }));

    const { data: savedMappings, error } = await supabase
      .from('branch_field_mappings')
      .insert(mappingsToInsert)
      .select();

    if (error) throw error;

    return NextResponse.json({ mappings: savedMappings });
  } catch (error: any) {
    console.error('Error saving mappings:', error);
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
    const body = await req.json();
    const { mappingId, updates } = body;

    if (!mappingId) {
      return NextResponse.json(
        { error: 'Mapping ID is required' },
        { status: 400 }
      );
    }

    const allowedUpdates: any = {};
    
    if (updates.fieldLabel !== undefined) allowedUpdates.field_label = updates.fieldLabel;
    if (updates.fieldType !== undefined) allowedUpdates.field_type = updates.fieldType;
    if (updates.isRequired !== undefined) allowedUpdates.is_required = updates.isRequired;
    if (updates.showInList !== undefined) allowedUpdates.show_in_list = updates.showInList;
    if (updates.showInDetail !== undefined) allowedUpdates.show_in_detail = updates.showInDetail;
    if (updates.includeInEmail !== undefined) allowedUpdates.include_in_email = updates.includeInEmail;
    if (updates.emailPriority !== undefined) allowedUpdates.email_priority = updates.emailPriority;
    if (updates.helpText !== undefined) allowedUpdates.help_text = updates.helpText;

    const { data: mapping, error } = await supabase
      .from('branch_field_mappings')
      .update(allowedUpdates)
      .eq('id', mappingId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ mapping });
  } catch (error: any) {
    console.error('Error updating mapping:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
