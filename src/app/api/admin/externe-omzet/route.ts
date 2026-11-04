import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { beoordeelRegels, leesSoort, type ExterneInvoer } from '@/lib/externeOmzet';
import { tabelOntbreekt } from '@/lib/omzetPerMaandLaden';

/**
 * Externe omzet beheren (alleen superadmin): facturen buiten WarmeLeads om,
 * zoals bulkfacturen uit Rompslomp. Ze tellen mee in de maandomzet van het
 * live-dashboard en in Winst en verlies. Zie migratie 191 en
 * src/lib/externeOmzet.ts.
 *
 * GET              alle regels en de klantenlijst
 * POST             { rijen, proef?, bron? }: proef = alleen controleren
 * PUT              { id, ...regel }, of { id, telt_mee } om een factuur aan/uit te zetten
 *
 * Facturen uit Rompslomp (bron 'rompslomp') volgen Rompslomp: alleen
 * meetellen aan/uit kan hier, wijzigen en verwijderen niet.
 * DELETE ?id=
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REGELS = 2000;
const geenTabel = () => NextResponse.json({ error: 'De tabel voor externe omzet bestaat nog niet (migratie 191)', ontbreekt: true }, { status: 503 });

type Supabase = ReturnType<typeof createServerClient>;

async function laadKlanten(supabase: Supabase) {
  const uit: { id: string; name: string | null }[] = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await supabase.from('customers').select('id, name').order('id').range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    uit.push(...((data ?? []) as { id: string; name: string | null }[]));
    if (!data || data.length < 1000) break;
  }
  return uit;
}

async function laadNummers(supabase: Supabase, behalveId?: string) {
  const uit: string[] = [];
  for (let p = 0; p < 50; p++) {
    const { data, error } = await supabase.from('externe_omzet').select('id, factuurnummer').not('factuurnummer', 'is', null).order('id').range(p * 1000, p * 1000 + 999);
    if (error) return { nummers: uit, error };
    uit.push(...(data ?? []).filter(r => r.id !== behalveId).map(r => r.factuurnummer as string));
    if (!data || data.length < 1000) break;
  }
  return { nummers: uit, error: null };
}

export async function GET(request: NextRequest) {
  const { error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;
  const supabase = createServerClient();
  const rijen: Record<string, unknown>[] = [];
  for (let p = 0; p < 50; p++) {
    const { data, error } = await supabase
      .from('externe_omzet')
      .select('id, datum, customer_id, klant_naam, soort, factuurnummer, bedrag_excl, omschrijving, bron, aangemaakt_door, created_at, telt_mee, reden, betaald, administratie, handmatig_beoordeeld')
      .order('datum', { ascending: false })
      .order('id')
      .range(p * 1000, p * 1000 + 999);
    if (tabelOntbreekt(error)) return NextResponse.json({ rijen: [], klanten: [], ontbreekt: true });
    if (error) return NextResponse.json({ error: 'Externe omzet kon niet worden geladen' }, { status: 500 });
    rijen.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  try {
    const klanten = await laadKlanten(supabase);
    return NextResponse.json({ rijen, klanten: klanten.filter(k => k.name).sort((a, b) => String(a.name).localeCompare(String(b.name), 'nl')), ontbreekt: false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Klanten konden niet worden geladen' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { admin, error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;
  const body = (await request.json().catch(() => ({}))) as { rijen?: unknown; proef?: unknown; bron?: unknown; standaardSoort?: unknown };
  if (!Array.isArray(body.rijen) || body.rijen.length === 0) return NextResponse.json({ error: 'Geen regels om op te slaan' }, { status: 400 });
  if (body.rijen.length > MAX_REGELS) return NextResponse.json({ error: `Hooguit ${MAX_REGELS} regels per keer` }, { status: 400 });
  const bron = body.bron === 'import' ? 'import' : 'handmatig';
  const proef = body.proef === true;

  const supabase = createServerClient();
  const { nummers, error: nrFout } = await laadNummers(supabase);
  if (tabelOntbreekt(nrFout)) return geenTabel();
  if (nrFout) return NextResponse.json({ error: 'Bestaande facturen konden niet worden geladen' }, { status: 500 });
  let klanten: { id: string; name: string | null }[];
  try { klanten = await laadKlanten(supabase); } catch { return NextResponse.json({ error: 'Klanten konden niet worden geladen' }, { status: 500 }); }

  const beoordeling = beoordeelRegels(body.rijen as ExterneInvoer[], nummers, klanten, leesSoort(body.standaardSoort));
  const goed = beoordeling.filter(b => b.status === 'goed' && b.rij);
  if (proef) return NextResponse.json({ proef: true, beoordeling });
  if (goed.length === 0) return NextResponse.json({ error: beoordeling.length === 1 ? `Niet opgeslagen: ${beoordeling[0].reden}` : 'Geen enkele regel kon worden opgeslagen', beoordeling }, { status: 400 });

  const door = admin?.name ?? admin?.email ?? null;
  for (let i = 0; i < goed.length; i += 500) {
    const { error } = await supabase.from('externe_omzet').insert(goed.slice(i, i + 500).map(b => ({ ...b.rij, bron, aangemaakt_door: door })));
    if (error) {
      const opgeslagen = i;
      return NextResponse.json({
        error: error.code === '23505'
          ? 'Een factuurnummer bestaat al (net door iemand anders ingevoerd?); vernieuw en probeer opnieuw'
          : 'Opslaan mislukt',
        opgeslagen,
      }, { status: error.code === '23505' ? 409 : 500 });
    }
  }
  const bedrag = Math.round(goed.reduce((s, b) => s + (b.rij?.bedrag_excl ?? 0), 0) * 100) / 100;
  await logAudit({
    adminId: admin?.id ?? null, adminName: admin?.name ?? null, action: 'externe_omzet_toegevoegd', entityType: 'externe_omzet', entityId: null,
    details: { bron, regels: goed.length, bedrag, overgeslagen: beoordeling.length - goed.length },
  }).catch(() => {});
  return NextResponse.json({ success: true, opgeslagen: goed.length, bedrag, beoordeling });
}

export async function PUT(request: NextRequest) {
  const { admin, error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;
  const body = (await request.json().catch(() => ({}))) as ExterneInvoer & { id?: unknown; telt_mee?: unknown };
  if (typeof body.id !== 'string' || !UUID.test(body.id)) return NextResponse.json({ error: 'Geen regel opgegeven' }, { status: 400 });
  const id = body.id;

  const supabase = createServerClient();
  const { data: oud, error: leesFout } = await supabase.from('externe_omzet').select('*').eq('id', id).maybeSingle();
  if (tabelOntbreekt(leesFout)) return geenTabel();
  if (leesFout) return NextResponse.json({ error: 'Regel kon niet worden geladen' }, { status: 500 });
  if (!oud) return NextResponse.json({ error: 'Regel niet gevonden' }, { status: 404 });

  /* Alleen meetellen aan of uit; de nachtelijke Rompslomp-ronde laat deze keuze staan. */
  if (typeof body.telt_mee === 'boolean' && Object.keys(body).every(k => k === 'id' || k === 'telt_mee')) {
    const { error } = await supabase
      .from('externe_omzet')
      .update({ telt_mee: body.telt_mee, handmatig_beoordeeld: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });
    await logAudit({
      adminId: admin?.id ?? null, adminName: admin?.name ?? null, action: body.telt_mee ? 'externe_omzet_mee' : 'externe_omzet_niet_mee', entityType: 'externe_omzet', entityId: id,
      details: { factuurnummer: oud.factuurnummer, klant: oud.klant_naam, bedrag_excl: oud.bedrag_excl, reden: oud.reden },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  }
  if (oud.bron === 'rompslomp') return NextResponse.json({ error: 'Deze factuur komt uit Rompslomp; wijzig hem daar' }, { status: 400 });
  const { nummers, error: nrFout } = await laadNummers(supabase, id);
  if (nrFout) return NextResponse.json({ error: 'Bestaande facturen konden niet worden geladen' }, { status: 500 });
  let klanten: { id: string; name: string | null }[];
  try { klanten = await laadKlanten(supabase); } catch { return NextResponse.json({ error: 'Klanten konden niet worden geladen' }, { status: 500 }); }

  const [b] = beoordeelRegels([body], nummers, klanten);
  if (b.status !== 'goed' || !b.rij) return NextResponse.json({ error: `Niet opgeslagen: ${b.reden}` }, { status: 400 });
  const { error } = await supabase.from('externe_omzet').update({ ...b.rij, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Dit factuurnummer bestaat al' : 'Opslaan mislukt' }, { status: error.code === '23505' ? 409 : 500 });
  await logAudit({
    adminId: admin?.id ?? null, adminName: admin?.name ?? null, action: 'externe_omzet_gewijzigd', entityType: 'externe_omzet', entityId: id,
    details: { van: { datum: oud.datum, bedrag_excl: oud.bedrag_excl, factuurnummer: oud.factuurnummer }, naar: { datum: b.rij.datum, bedrag_excl: b.rij.bedrag_excl, factuurnummer: b.rij.factuurnummer } },
  }).catch(() => {});
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { admin, error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;
  const id = request.nextUrl.searchParams.get('id');
  if (!id || !UUID.test(id)) return NextResponse.json({ error: 'Geen regel opgegeven' }, { status: 400 });
  const supabase = createServerClient();
  const { data: bron, error: bronFout } = await supabase.from('externe_omzet').select('bron').eq('id', id).maybeSingle();
  if (tabelOntbreekt(bronFout)) return geenTabel();
  if (bron?.bron === 'rompslomp') return NextResponse.json({ error: 'Deze factuur komt uit Rompslomp en komt dan vannacht terug; zet hem op "telt niet mee"' }, { status: 400 });
  const { data, error } = await supabase.from('externe_omzet').delete().eq('id', id).select('datum, bedrag_excl, factuurnummer, klant_naam');
  if (tabelOntbreekt(error)) return geenTabel();
  if (error) return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'Regel niet gevonden' }, { status: 404 });
  await logAudit({
    adminId: admin?.id ?? null, adminName: admin?.name ?? null, action: 'externe_omzet_verwijderd', entityType: 'externe_omzet', entityId: id,
    details: data[0],
  }).catch(() => {});
  return NextResponse.json({ success: true });
}
