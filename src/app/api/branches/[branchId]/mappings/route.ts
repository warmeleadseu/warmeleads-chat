/**
 * API Route: Get Branch Field Mappings
 * GET: Fetch field mappings for a branch (PUBLIC - needed for lead parsing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(
  req: NextRequest,
  { params }: { params: { branchId: string } }
) {
  try {
    const branchId = params.branchId;

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: mappings, error } = await supabase
      .from('branch_field_mappings')
      .select('*')
      .eq('branch_id', branchId)
      .order('column_index', { ascending: true });

    if (error) {
      console.error('Error fetching branch mappings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch mappings', details: error.message },
        { status: 500 }
      );
    }

    // Transform to frontend format
    const transformedMappings = (mappings || []).map((row: any) => ({
      id: row.id,
      branchId: row.branch_id,
      columnLetter: row.column_letter,
      columnIndex: row.column_index,
      headerName: row.header_name,
      fieldKey: row.field_key,
      fieldLabel: row.field_label,
      fieldType: row.field_type,
      isRequired: row.is_required,
      isUnique: row.is_unique,
      validationRegex: row.validation_regex,
      showInList: row.show_in_list,
      showInDetail: row.show_in_detail,
      includeInEmail: row.include_in_email,
      emailPriority: row.email_priority,
      helpText: row.help_text,
      placeholder: row.placeholder,
      sortOrder: row.sort_order,
      createdAt: row.created_at
    }));

    return NextResponse.json({ mappings: transformedMappings });
  } catch (error: any) {
    console.error('Error in GET /api/branches/[branchId]/mappings:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}


