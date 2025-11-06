/**
 * API Route: Branch Management
 * GET: List all branches
 * POST: Create new branch
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: branches, error } = await supabase
      .from('branch_definitions')
      .select(`
        *,
        branch_field_mappings(count),
        branch_email_templates(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ branches });
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, displayName, description, icon } = body;

    // Validate required fields
    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Name and display name are required' },
        { status: 400 }
      );
    }

    // Create branch
    const { data: branch, error } = await supabase
      .from('branch_definitions')
      .insert({
        name: name.toLowerCase().replace(/\s+/g, '_'),
        display_name: displayName,
        description: description || null,
        icon: icon || '📋',
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ branch }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating branch:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

