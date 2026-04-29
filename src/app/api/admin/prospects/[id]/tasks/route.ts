import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { loadAccessibleProspect } from '@/lib/prospects';

const ALLOWED_TYPES = ['todo', 'call', 'email', 'meeting', 'followup'] as const;
type TaskType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(s: unknown): s is TaskType {
  return typeof s === 'string' && (ALLOWED_TYPES as readonly string[]).includes(s);
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const access = await loadAccessibleProspect(supabase, admin, params.id);
  if (!access.ok) {
    if (access.reason === 'forbidden') return forbidden();
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('prospect_tasks')
    .select('*')
    .eq('prospect_id', params.id)
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Taken ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ tasks: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: {
    type?: unknown;
    title?: unknown;
    description?: unknown;
    due_at?: unknown;
    assigned_to_admin_id?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 });
  }
  const type = isAllowedType(body.type) ? body.type : 'todo';

  const supabase = createServerClient();
  const access = await loadAccessibleProspect(supabase, admin, params.id);
  if (!access.ok || !access.prospect) {
    if (access.reason === 'forbidden') return forbidden();
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }

  const assignedTo =
    typeof body.assigned_to_admin_id === 'string' && body.assigned_to_admin_id
      ? body.assigned_to_admin_id
      : access.prospect.account_manager_id || admin.id;

  const insert = {
    prospect_id: params.id,
    type,
    title,
    description: typeof body.description === 'string' ? body.description : null,
    due_at: typeof body.due_at === 'string' && body.due_at ? body.due_at : null,
    assigned_to_admin_id: assignedTo,
    created_by_admin_id: admin.id,
  };

  const { data, error } = await supabase
    .from('prospect_tasks')
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Taak aanmaken mislukt' }, { status: 500 });
  }

  await supabase.from('prospect_activities').insert({
    prospect_id: params.id,
    admin_user_id: admin.id,
    type: 'task_created',
    title: `Taak: ${title}`,
    metadata: { task_id: data.id, type, due_at: insert.due_at },
  });

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'prospect_task.created',
    entityType: 'prospect_task',
    entityId: data.id,
    details: { prospect_id: params.id, title, type },
  });

  return NextResponse.json({ success: true, task: data });
}
