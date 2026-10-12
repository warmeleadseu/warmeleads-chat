import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { adminCanAccessCustomer } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { bepaalTerugwinlijst, type TwBatch } from '@/lib/terugwinnen';

/**
 * Klanten terugwinnen: klanten die ooit betaalden en nu geen lopende batch
 * hebben, met alles wat een accountmanager nodig heeft om te bellen.
 * Accountmanagers zien alleen hun eigen klanten.
 */

const STATUSSEN = ['gebeld', 'terugbellen', 'offerte', 'niet_bereikbaar', 'geen_interesse'] as const;
const MAILTYPES = ['batch_80pct', 'batch_completed', 'batch_reminder'];

type Klant = {
  id: string; name: string; contact_person: string | null; email: string | null; phone: string | null;
  account_manager_id: string | null; last_login_at: string | null; is_active: boolean | null; city: string | null;
};

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const supabase = createServerClient();

  let klantQuery = supabase
    .from('customers')
    .select('id, name, contact_person, email, phone, account_manager_id, last_login_at, is_active, city');
  if (admin.role === 'accountmanager') klantQuery = klantQuery.eq('account_manager_id', admin.id);
  const { data: klantenRuw, error: kErr } = await klantQuery;
  if (kErr) return NextResponse.json({ error: 'Klanten konden niet worden geladen' }, { status: 500 });
  const klanten = new Map(((klantenRuw ?? []) as Klant[]).map(k => [k.id, k]));
  const klantIds = [...klanten.keys()];
  if (klantIds.length === 0) return NextResponse.json({ rijen: [] });

  const batches: TwBatch[] = [];
  for (let i = 0; i < klantIds.length; i += 150) {
    const deel = klantIds.slice(i, i + 150);
    const [{ data: lb }, { data: ab }] = await Promise.all([
      supabase.from('customer_batches')
        .select('id, customer_id, branch, batch_kind, status, is_paid, batch_size, leads_delivered, total_price, price_per_lead, created_at, completed_at')
        .in('customer_id', deel),
      supabase.from('appointment_batches')
        .select('id, customer_id, branch, status, is_paid, batch_size, appointments_delivered, total_price, price_per_appointment, created_at')
        .in('customer_id', deel),
    ]);
    for (const b of lb ?? []) batches.push({
      id: b.id, customer_id: b.customer_id, branch: b.branch, soort: 'leads', batch_kind: b.batch_kind, status: b.status,
      is_paid: b.is_paid, batch_size: Number(b.batch_size) || 0, geleverd: Number(b.leads_delivered) || 0,
      total_price: b.total_price == null ? null : Number(b.total_price), price_per_unit: b.price_per_lead == null ? null : Number(b.price_per_lead),
      created_at: b.created_at, completed_at: b.completed_at,
    });
    for (const b of ab ?? []) batches.push({
      id: b.id, customer_id: b.customer_id, branch: b.branch, soort: 'afspraken', status: b.status,
      is_paid: b.is_paid, batch_size: Number(b.batch_size) || 0, geleverd: Number(b.appointments_delivered) || 0,
      total_price: b.total_price == null ? null : Number(b.total_price), price_per_unit: b.price_per_appointment == null ? null : Number(b.price_per_appointment),
      created_at: b.created_at, completed_at: null,
    });
  }

  const lijst = bepaalTerugwinlijst(batches, new Map());
  const ids = lijst.map(l => l.customer_id);
  if (ids.length === 0) return NextResponse.json({ rijen: [] });

  const [{ data: ams }, { data: branches }] = await Promise.all([
    supabase.from('admin_users').select('id, name'),
    supabase.from('branches').select('slug, name'),
  ]);
  const amNaam = new Map((ams ?? []).map(a => [a.id as string, a.name as string]));
  const brancheNaam = new Map((branches ?? []).map(b => [b.slug as string, b.name as string]));

  const reclamaties = new Map<string, number>();
  const portaalLogin = new Map<string, string>();
  const opvolging = new Map<string, Record<string, unknown>>();
  const aantalContact = new Map<string, number>();
  const mails = new Map<string, { type: string; op: string }[]>();
  const mailVanaf = new Date(Date.now() - 180 * 86_400_000).toISOString();

  for (let i = 0; i < ids.length; i += 150) {
    const deel = ids.slice(i, i + 150);
    const [{ data: rec }, { data: pu }, { data: op }] = await Promise.all([
      supabase.from('lead_reclamations').select('customer_id').eq('status', 'approved').in('customer_id', deel),
      supabase.from('portal_users').select('customer_id, last_login_at').in('customer_id', deel),
      supabase.from('klant_opvolging').select('*').in('customer_id', deel).order('created_at', { ascending: false }),
    ]);
    for (const r of rec ?? []) reclamaties.set(r.customer_id as string, (reclamaties.get(r.customer_id as string) ?? 0) + 1);
    for (const p of pu ?? []) {
      const k = p.customer_id as string;
      if (p.last_login_at && (!portaalLogin.has(k) || p.last_login_at > portaalLogin.get(k)!)) portaalLogin.set(k, p.last_login_at as string);
    }
    for (const o of op ?? []) {
      const k = o.customer_id as string;
      if (!opvolging.has(k)) opvolging.set(k, o);
      aantalContact.set(k, (aantalContact.get(k) ?? 0) + 1);
    }
  }
  const { data: mailRijen } = await supabase
    .from('email_log')
    .select('type, created_at, metadata, status')
    .in('type', MAILTYPES)
    .neq('status', 'failed')
    .gte('created_at', mailVanaf);
  for (const m of mailRijen ?? []) {
    const k = (m.metadata as { customer_id?: string } | null)?.customer_id;
    if (k && ids.includes(k)) mails.set(k, [...(mails.get(k) ?? []), { type: m.type as string, op: m.created_at as string }]);
  }

  const rijen = lijst.map(l => {
    const k = klanten.get(l.customer_id)!;
    const geleverdTotaal = batches.filter(b => b.customer_id === l.customer_id && b.is_paid).reduce((s, b) => s + b.geleverd, 0);
    const rec = reclamaties.get(l.customer_id) ?? 0;
    const login = [k.last_login_at, portaalLogin.get(l.customer_id)].filter(Boolean).sort().pop() ?? null;
    const klantMails = (mails.get(l.customer_id) ?? []).sort((a, b) => b.op.localeCompare(a.op));
    return {
      customer_id: l.customer_id,
      klant: k.name,
      actief_account: k.is_active !== false,
      plaats: k.city,
      contactpersoon: k.contact_person,
      email: k.email,
      telefoon: k.phone,
      accountmanager: k.account_manager_id ? amNaam.get(k.account_manager_id) ?? null : null,
      segment: l.segment,
      dagen_stil: l.dagenStil,
      laatste_activiteit: l.laatsteActiviteit,
      laatste_batch: {
        id: l.laatsteBatch.id,
        soort: l.laatsteBatch.soort,
        branche: brancheNaam.get(l.laatsteBatch.branch) ?? l.laatsteBatch.branch,
        grootte: l.laatsteBatch.batch_size,
        geleverd: l.laatsteBatch.geleverd,
        prijs_per_stuk: l.laatsteBatch.price_per_unit,
        totaal: l.laatsteBatch.total_price,
        status: l.laatsteBatch.status,
      },
      branches: l.branches.map(b => brancheNaam.get(b) ?? b),
      betaalde_batches: l.betaaldeBatches,
      omzet: l.omzet,
      geleverd_totaal: geleverdTotaal,
      reclamaties: rec,
      reclamatie_pct: geleverdTotaal > 0 ? Math.round((rec / geleverdTotaal) * 1000) / 10 : null,
      laatste_login: login,
      openstaande_bestelling: l.openstaandeBestelling,
      mails: klantMails.slice(0, 3),
      aantal_mails: klantMails.length,
      opvolging: opvolging.get(l.customer_id) ?? null,
      aantal_contactmomenten: aantalContact.get(l.customer_id) ?? 0,
    };
  });

  return NextResponse.json({ rijen }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { customer_id?: unknown; status?: unknown; notitie?: unknown; terugbellen_op?: unknown };

  const klantId = typeof body.customer_id === 'string' ? body.customer_id : '';
  const status = STATUSSEN.find(s => s === body.status);
  if (!klantId || !status) return NextResponse.json({ error: 'Kies een klant en een status' }, { status: 400 });
  if (!(await adminCanAccessCustomer(admin, klantId))) return NextResponse.json({ error: 'Geen toegang tot deze klant' }, { status: 403 });

  const notitie = typeof body.notitie === 'string' ? body.notitie.trim().slice(0, 2000) || null : null;
  let terugbellen: string | null = null;
  if (typeof body.terugbellen_op === 'string' && body.terugbellen_op) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.terugbellen_op)) return NextResponse.json({ error: 'Ongeldige datum' }, { status: 400 });
    terugbellen = body.terugbellen_op;
  }
  if (status === 'terugbellen' && !terugbellen) return NextResponse.json({ error: 'Vul in wanneer je terugbelt' }, { status: 400 });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('klant_opvolging')
    .insert({ customer_id: klantId, status, notitie, terugbellen_op: terugbellen, admin_id: admin.id, admin_naam: admin.name ?? admin.email ?? null })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });

  void logAudit({ adminId: admin.id, adminName: admin.name ?? null, action: 'klant_opvolging', entityType: 'customer', entityId: klantId, details: { status, terugbellen_op: terugbellen } });
  return NextResponse.json({ opvolging: data });
}
