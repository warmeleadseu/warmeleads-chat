/**
 * API Route: Email Template Management
 * POST: Create/update email template
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
    const { templateType, subjectTemplate, bodyTemplate, isActive } = body;

    if (!templateType || !subjectTemplate || !bodyTemplate) {
      return NextResponse.json(
        { error: 'Template type, subject, and body are required' },
        { status: 400 }
      );
    }

    // Upsert template
    const { data: template, error } = await supabase
      .from('branch_email_templates')
      .upsert({
        branch_id: branchId,
        template_type: templateType,
        subject_template: subjectTemplate,
        body_template: bodyTemplate,
        is_active: isActive !== undefined ? isActive : true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'branch_id,template_type'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('Error saving email template:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { branchId: string } }
) {
  try {
    const branchId = params.branchId;

    const { data: templates, error } = await supabase
      .from('branch_email_templates')
      .select('*')
      .eq('branch_id', branchId);

    if (error) throw error;

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Error fetching email templates:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
