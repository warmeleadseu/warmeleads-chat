import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { loadAccessibleProspect, PROSPECT_STATUS_LABELS } from '@/lib/prospects';
import { laadVoicemails, VOICEMAIL_ZET_STATUS_VANUIT } from '@/lib/prospectVoicemail';

/**
 * "Voicemail +1" in de prospectkaart: legt een belpoging met uitkomst
 * voicemail vast (met tijd en wie belde). Staat de prospect nog op Nieuw,
 * Contact of Mail verstuurd, dan gaat de status naar Voicemail; een hogere
 * status blijft staan. DELETE haalt de laatste knop-voicemail weer weg (een
 * verkeerde klik), inclusief de statuswijziging die hij deed.
 */

async function antwoord(supabase: ReturnType<typeof createServerClient>, id: string, prospect: unknown) {
  const vm = await laadVoicemails(supabase, [id]);
  return NextResponse.json({ success: true, prospect, voicemail: vm.get(id) ?? { aantal: 0, momenten: [] } });
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const supabase = createServerClient();
  const access = await loadAccessibleProspect(supabase, admin, id);
  if (!access.ok) {
    if (access.reason === 'forbidden') return forbidden();
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }
  /* Kan de laatste weg? Alleen als die van de knop komt (niet een oude statuswijziging). */
  const { data: knop } = await supabase.from('prospect_activities').select('id, metadata').eq('prospect_id', id).eq('type', 'call').order('created_at', { ascending: false }).limit(20);
  const vm = await laadVoicemails(supabase, [id]);
  return NextResponse.json({
    voicemail: vm.get(id) ?? { aantal: 0, momenten: [] },
    kan_weghalen: (knop ?? []).some(r => (r.metadata as { uitkomst?: string } | null)?.uitkomst === 'voicemail'),
  });
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const supabase = createServerClient();
  const access = await loadAccessibleProspect(supabase, admin, id);
  if (!access.ok || !access.prospect) {
    if (access.reason === 'forbidden') return forbidden();
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }
  const vorige = access.prospect.status as string;
  const zetStatus = VOICEMAIL_ZET_STATUS_VANUIT.includes(vorige);

  let statusActiviteitId: string | null = null;
  let prospect: unknown = access.prospect;
  if (zetStatus) {
    const { data, error } = await supabase.from('prospects').update({ status: 'voicemail', last_contacted_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });
    prospect = data;
    const { data: sc } = await supabase.from('prospect_activities').insert({
      prospect_id: id, admin_user_id: admin.id, type: 'status_change',
      title: `Status: ${(PROSPECT_STATUS_LABELS as Record<string, string>)[vorige] ?? vorige} →${PROSPECT_STATUS_LABELS.voicemail}`,
      metadata: { from: vorige, to: 'voicemail', via_voicemail_knop: true },
    }).select('id').single();
    statusActiviteitId = (sc?.id as string | undefined) ?? null;
  } else {
    const { data } = await supabase.from('prospects').update({ last_contacted_at: new Date().toISOString() }).eq('id', id).select().single();
    if (data) prospect = data;
  }

  const { error } = await supabase.from('prospect_activities').insert({
    prospect_id: id, admin_user_id: admin.id, type: 'call', title: 'Gebeld: voicemail',
    metadata: { uitkomst: 'voicemail', status_van: zetStatus ? vorige : null, status_activiteit_id: statusActiviteitId },
  });
  if (error) return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });

  logAudit({ adminId: admin.id, adminName: admin.name, action: 'prospect.voicemail', entityType: 'prospect', entityId: id, details: { status_van: vorige, status_gezet: zetStatus } });
  return antwoord(supabase, id, prospect);
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const supabase = createServerClient();
  const access = await loadAccessibleProspect(supabase, admin, id);
  if (!access.ok || !access.prospect) {
    if (access.reason === 'forbidden') return forbidden();
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }

  /* Alleen de laatste voicemail van de knop; oudere statuswijzigingen blijven. */
  const { data: rijen } = await supabase
    .from('prospect_activities')
    .select('id, metadata, created_at')
    .eq('prospect_id', id)
    .eq('type', 'call')
    .order('created_at', { ascending: false })
    .limit(20);
  const laatste = (rijen ?? []).find(r => (r.metadata as { uitkomst?: string } | null)?.uitkomst === 'voicemail');
  if (!laatste) return NextResponse.json({ error: 'Geen voicemail om weg te halen' }, { status: 404 });
  const meta = (laatste.metadata ?? {}) as { status_van?: string | null; status_activiteit_id?: string | null };

  await supabase.from('prospect_activities').delete().eq('id', laatste.id);
  let prospect: unknown = access.prospect;
  /* Zette die klik de status om en staat hij nog op Voicemail: terug. */
  if (meta.status_van && access.prospect.status === 'voicemail') {
    const { data } = await supabase.from('prospects').update({ status: meta.status_van }).eq('id', id).select().single();
    if (data) prospect = data;
    if (meta.status_activiteit_id) await supabase.from('prospect_activities').delete().eq('id', meta.status_activiteit_id);
  }

  logAudit({ adminId: admin.id, adminName: admin.name, action: 'prospect.voicemail_weg', entityType: 'prospect', entityId: id, details: { status_terug: meta.status_van ?? null } });
  return antwoord(supabase, id, prospect);
}
