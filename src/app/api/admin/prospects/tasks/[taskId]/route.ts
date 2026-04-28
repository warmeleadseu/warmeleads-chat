import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { isAccountManagerScope } from '@/lib/prospects';

async function loadTask(supabase: ReturnType<typeof createServerClient>, taskId: string) {
  const { data } = await supabase
    .from('prospect_tasks')
    .select('*, prospect:prospects!inner(id, account_manager_id)')
    .eq('id', taskId)
    .single();
  return data as
    | (Record<string, unknown> & {
        prospect: { id: string; account_manager_id: string | null };
        prospect_id: string;
      })
    | null;
}

export async function PATCH(request: NextRequest, { params }: { params: { taskId: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: {
    title?: unknown;
    description?: unknown;
    due_at?: unknown;
    completed?: unknown;
    assigned_to_admin_id?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  const supabase = createServerClient();
  const task = await loadTask(supabase, params.taskId);
  if (!task) return NextResponse.json({ error: 'Taak niet gevonden' }, { status: 404 });

  if (isAccountManagerScope(admin) && task.prospect.account_manager_id !== admin.id) {
    return forbidden();
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.title === 'string') updates.title = body.title.trim();
  if ('description' in body) updates.description = typeof body.description === 'string' ? body.description : null;
  if ('due_at' in body) updates.due_at = typeof body.due_at === 'string' && body.due_at ? body.due_at : null;
  if ('assigned_to_admin_id' in body) {
    updates.assigned_to_admin_id =
      typeof body.assigned_to_admin_id === 'string' && body.assigned_to_admin_id ? body.assigned_to_admin_id : null;
  }

  if ('completed' in body) {
    if (body.completed === true) {
      updates.completed_at = new Date().toISOString();
    } else if (body.completed === false) {
      updates.completed_at = null;
    }
  }

  const { data, error } = await supabase
    .from('prospect_tasks')
    .update(updates)
    .eq('id', params.taskId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Taak bijwerken mislukt' }, { status: 500 });
  }

  if (body.completed === true) {
    await supabase.from('prospect_activities').insert({
      prospect_id: task.prospect_id,
      admin_user_id: admin.id,
      type: 'task_completed',
      title: `Taak afgerond: ${task.title as string}`,
      metadata: { task_id: data.id },
    });

    logAudit({
      adminId: admin.id,
      adminName: admin.name,
      action: 'prospect_task.completed',
      entityType: 'prospect_task',
      entityId: data.id,
      details: { prospect_id: task.prospect_id, title: task.title },
    });
  }

  return NextResponse.json({ success: true, task: data });
}

export async function DELETE(request: NextRequest, { params }: { params: { taskId: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const task = await loadTask(supabase, params.taskId);
  if (!task) return NextResponse.json({ error: 'Taak niet gevonden' }, { status: 404 });

  if (isAccountManagerScope(admin) && task.prospect.account_manager_id !== admin.id) {
    return forbidden();
  }

  const { error } = await supabase.from('prospect_tasks').delete().eq('id', params.taskId);
  if (error) {
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'prospect_task.deleted',
    entityType: 'prospect_task',
    entityId: params.taskId,
    details: { prospect_id: task.prospect_id, title: task.title },
  });

  return NextResponse.json({ success: true });
}
