import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { leesBedrag } from '@/lib/bedrag';

/**
 * Personeelskosten per maand beheren (alleen superadmin). Een nieuw bedrag is
 * een nieuwe regel met een ingangsdatum; de vorige regel loopt dan tot de dag
 * ervoor. Zo houden oude maanden hun oude bedrag.
 */

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const geldigeDatum = (d: unknown): d is string => typeof d === 'string' && DATUM.test(d) && !Number.isNaN(new Date(`${d}T12:00:00Z`).getTime());
const dagErvoor = (d: string) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

export async function POST(request: NextRequest) {
  const { admin, error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;
  const body = (await request.json().catch(() => ({}))) as { bedrag_per_maand?: unknown; ingang?: unknown; omschrijving?: unknown };

  const bedrag = leesBedrag(body.bedrag_per_maand);
  if (!Number.isFinite(bedrag) || bedrag < 0 || bedrag > 1_000_000) return NextResponse.json({ error: 'Vul een geldig bedrag per maand in' }, { status: 400 });
  if (!geldigeDatum(body.ingang)) return NextResponse.json({ error: 'Vul een geldige ingangsdatum in' }, { status: 400 });
  const ingang = body.ingang;
  const omschrijving = typeof body.omschrijving === 'string' && body.omschrijving.trim() ? body.omschrijving.trim().slice(0, 120) : 'Personeel (alle loonkosten en extra\'s)';

  const supabase = createServerClient();
  const { data: bestaand, error: leesFout } = await supabase.from('personeelskosten').select('id, ingang, einde, bedrag_per_maand');
  if (leesFout) return NextResponse.json({ error: 'Personeelskosten konden niet worden geladen' }, { status: 500 });
  if ((bestaand ?? []).some(r => r.ingang === ingang)) {
    return NextResponse.json({ error: 'Er is al een bedrag met deze ingangsdatum; pas die regel aan of kies een andere datum' }, { status: 400 });
  }

  /* De regel die op de nieuwe ingangsdatum nog liep, eindigt de dag ervoor. */
  const lopend = (bestaand ?? []).filter(r => r.ingang < ingang && (!r.einde || r.einde >= ingang));
  for (const r of lopend) {
    const { error } = await supabase.from('personeelskosten').update({ einde: dagErvoor(ingang) }).eq('id', r.id);
    if (error) return NextResponse.json({ error: 'De vorige regel kon niet worden afgesloten' }, { status: 500 });
  }
  /* Ligt er al een latere regel, dan loopt de nieuwe tot de dag ervoor. */
  const later = (bestaand ?? []).filter(r => r.ingang > ingang).sort((a, b) => String(a.ingang).localeCompare(String(b.ingang)))[0];
  const { data, error } = await supabase
    .from('personeelskosten')
    .insert({ omschrijving, bedrag_per_maand: Math.round(bedrag * 100) / 100, ingang, einde: later ? dagErvoor(later.ingang as string) : null, aangemaakt_door: admin?.name ?? admin?.email ?? null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });

  await logAudit({
    adminId: admin?.id ?? null, adminName: admin?.name ?? null, action: 'personeelskosten', entityType: 'personeelskosten', entityId: data.id,
    details: { bedrag_per_maand: data.bedrag_per_maand, ingang, vorige_afgesloten: lopend.length },
  }).catch(() => {});
  return NextResponse.json({ success: true, regel: data });
}

export async function DELETE(request: NextRequest) {
  const { admin, error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Geen regel opgegeven' }, { status: 400 });

  const supabase = createServerClient();
  const { data: alle, error: leesFout } = await supabase.from('personeelskosten').select('id, ingang, einde, bedrag_per_maand').order('ingang');
  if (leesFout) return NextResponse.json({ error: 'Personeelskosten konden niet worden geladen' }, { status: 500 });
  const i = (alle ?? []).findIndex(r => r.id === id);
  if (i < 0) return NextResponse.json({ error: 'Regel niet gevonden' }, { status: 404 });
  const weg = alle![i];

  const { error } = await supabase.from('personeelskosten').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  /* De vorige regel loopt weer door tot waar de verwijderde regel liep. */
  const vorige = i > 0 ? alle![i - 1] : null;
  if (vorige && vorige.einde && weg.ingang && vorige.einde === dagErvoor(weg.ingang as string)) {
    await supabase.from('personeelskosten').update({ einde: weg.einde }).eq('id', vorige.id);
  }
  await logAudit({
    adminId: admin?.id ?? null, adminName: admin?.name ?? null, action: 'personeelskosten_verwijderd', entityType: 'personeelskosten', entityId: id,
    details: { bedrag_per_maand: weg.bedrag_per_maand, ingang: weg.ingang },
  }).catch(() => {});
  return NextResponse.json({ success: true });
}
