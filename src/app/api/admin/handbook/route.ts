import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

/**
 * Handboek: eigen aantekeningen en persoonlijke voortgang.
 *
 * De inhoud van het handboek staat in code (src/app/admin/handboek/content.ts).
 * Dit endpoint beheert alleen wat het team er zelf aan toevoegt.
 *
 * Afgeschermd op superadmin, gelijk aan het menu-item. De rolcontrole staat
 * bewust ook hier: een menu verbergen is geen beveiliging.
 */

export const runtime = 'nodejs';

type NoteRow = {
  section_id: string;
  body: string;
  updated_by_name: string | null;
  updated_at: string;
};

export async function GET(request: NextRequest) {
  const { admin, error } = await requireSuperAdmin(request);
  if (error) return error;

  const supabase = createServerClient();

  const [notesRes, progressRes] = await Promise.all([
    supabase.from('handbook_notes').select('section_id, body, updated_by_name, updated_at'),
    supabase.from('handbook_progress').select('section_id').eq('admin_user_id', admin.id),
  ]);

  if (notesRes.error) {
    console.error('[admin/handbook GET] notities ophalen mislukt', notesRes.error);
    return NextResponse.json(
      { error: `Aantekeningen ophalen mislukt: ${notesRes.error.message}` },
      { status: 500 },
    );
  }

  const notes: Record<string, NoteRow> = {};
  for (const row of (notesRes.data || []) as NoteRow[]) {
    if (row.body && row.body.trim()) notes[row.section_id] = row;
  }

  return NextResponse.json({
    notes,
    completed: (progressRes.data || []).map(r => r.section_id as string),
  });
}

/** Aantekening bij een onderdeel opslaan. Een lege tekst wist de aantekening. */
export async function PUT(request: NextRequest) {
  const { admin, error } = await requireSuperAdmin(request);
  if (error) return error;

  let body: { section_id?: unknown; body?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }

  const sectionId = typeof body.section_id === 'string' ? body.section_id.trim() : '';
  if (!sectionId) {
    return NextResponse.json({ error: 'section_id is verplicht' }, { status: 400 });
  }

  const tekst = typeof body.body === 'string' ? body.body : '';
  if (tekst.length > 20_000) {
    return NextResponse.json(
      { error: 'Aantekening is te lang (maximaal 20.000 tekens)' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const { data, error: dbError } = await supabase
    .from('handbook_notes')
    .upsert(
      {
        section_id: sectionId,
        body: tekst,
        updated_by: admin.id,
        updated_by_name: admin.name || admin.email || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'section_id' },
    )
    .select('section_id, body, updated_by_name, updated_at')
    .single();

  if (dbError) {
    console.error('[admin/handbook PUT] opslaan mislukt', {
      sectionId,
      adminId: admin.id,
      code: dbError.code,
      message: dbError.message,
    });
    return NextResponse.json({ error: `Opslaan mislukt: ${dbError.message}` }, { status: 500 });
  }

  return NextResponse.json({ note: data });
}

/** Onderdeel afvinken of het vinkje weghalen, per persoon. */
export async function POST(request: NextRequest) {
  const { admin, error } = await requireSuperAdmin(request);
  if (error) return error;

  let body: { section_id?: unknown; completed?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }

  const sectionId = typeof body.section_id === 'string' ? body.section_id.trim() : '';
  if (!sectionId) {
    return NextResponse.json({ error: 'section_id is verplicht' }, { status: 400 });
  }
  const voltooid = body.completed === true;

  const supabase = createServerClient();

  if (voltooid) {
    const { error: dbError } = await supabase
      .from('handbook_progress')
      .upsert(
        { admin_user_id: admin.id, section_id: sectionId, completed_at: new Date().toISOString() },
        { onConflict: 'admin_user_id,section_id' },
      );
    if (dbError) {
      console.error('[admin/handbook POST] afvinken mislukt', dbError);
      return NextResponse.json({ error: `Afvinken mislukt: ${dbError.message}` }, { status: 500 });
    }
  } else {
    const { error: dbError } = await supabase
      .from('handbook_progress')
      .delete()
      .eq('admin_user_id', admin.id)
      .eq('section_id', sectionId);
    if (dbError) {
      console.error('[admin/handbook POST] vinkje weghalen mislukt', dbError);
      return NextResponse.json({ error: `Bijwerken mislukt: ${dbError.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ section_id: sectionId, completed: voltooid });
}
