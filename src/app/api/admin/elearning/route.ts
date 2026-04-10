import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

function forbidden() {
  return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'accountmanager' && admin.role !== 'superadmin') return forbidden();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('am_elearning_progress')
    .select('module_id, lesson_id, completed, quiz_score, quiz_answers, completed_at')
    .eq('admin_user_id', admin.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ progress: data || [] });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'accountmanager' && admin.role !== 'superadmin') return forbidden();

  const body = await request.json();
  const { module_id, lesson_id, completed, quiz_score, quiz_answers } = body;

  if (!module_id || !lesson_id) {
    return NextResponse.json({ error: 'module_id en lesson_id zijn verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  const record: Record<string, unknown> = {
    admin_user_id: admin.id,
    module_id,
    lesson_id,
    completed: completed ?? true,
    updated_at: new Date().toISOString(),
  };

  if (completed) record.completed_at = new Date().toISOString();
  if (quiz_score !== undefined) record.quiz_score = quiz_score;
  if (quiz_answers !== undefined) record.quiz_answers = quiz_answers;

  const { error } = await supabase
    .from('am_elearning_progress')
    .upsert(record, { onConflict: 'admin_user_id,module_id,lesson_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
