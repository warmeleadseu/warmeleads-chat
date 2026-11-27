import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { rateLimitShared, getClientIp } from '@/lib/rateLimit';
import { sendEmail, EMAIL_BASE_URL } from '@/lib/email';
import { verstuurPush, type PushAanmelding } from '@/lib/pushNotification';
import { contactTokenKlopt } from '@/lib/contactverzoekServer';
import { isTerugbelKeuze, maskeerTelefoon, terugbelMoment, TERUGBEL_KEUZES } from '@/lib/contactverzoek';
import { TERUGBEL_TITEL } from '@/lib/prospectTerugbellen';

/**
 * Openbare contactpagina uit de mail na 3× voicemail (/contact/[id]?t=...).
 * Alleen met de juiste handtekening. Laat alleen zien wat de prospect zelf
 * al weet (bedrijfsnaam, half afgeschermd nummer, naam accountmanager).
 */

export const dynamic = 'force-dynamic';

const TAAK_KENMERK = 'Terugbelverzoek via de contactmail';
const AFGESLOTEN = ['gewonnen', 'verloren', 'niet_relevant'];

type Prospect = {
  id: string; company_name: string | null; contact_person: string | null; phone: string | null;
  status: string; account_manager_id: string | null; converted_to_customer_id: string | null;
};

async function laad(id: string, t: unknown) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !contactTokenKlopt(id, t)) return null;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('prospects')
    .select('id, company_name, contact_person, phone, status, account_manager_id, converted_to_customer_id')
    .eq('id', id)
    .maybeSingle();
  return data ? { supabase, p: data as Prospect } : null;
}

const voornaam = (n: string | null | undefined) => (n ?? '').trim().split(/\s+/)[0] || '';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await laad(id, request.nextUrl.searchParams.get('t'));
  if (!r) return NextResponse.json({ error: 'Deze link is niet (meer) geldig.' }, { status: 404 });
  const { supabase, p } = r;
  const { data: am } = p.account_manager_id
    ? await supabase.from('admin_users').select('name').eq('id', p.account_manager_id).maybeSingle()
    : { data: null };
  return NextResponse.json({
    bedrijf: p.company_name,
    voornaam: voornaam(p.contact_person),
    accountmanager: voornaam(am?.name as string | undefined) || null,
    telefoon: maskeerTelefoon(p.phone),
    afgesloten: AFGESLOTEN.includes(p.status) || !!p.converted_to_customer_id,
    keuzes: TERUGBEL_KEUZES,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rl = await rateLimitShared(`contact:${getClientIp(request)}`, 'contactverzoek', 10, 10 * 60_000);
  if (rl.limited && rl.response) return rl.response;
  const body = await request.json().catch(() => ({})) as { t?: string; keuze?: string; moment?: string; telefoon?: string; notitie?: string };
  const r = await laad(id, body.t);
  if (!r) return NextResponse.json({ error: 'Deze link is niet (meer) geldig.' }, { status: 404 });
  const { supabase, p } = r;
  const wie = [p.company_name, p.contact_person].filter(Boolean).join(' · ') || 'Een prospect';

  if (body.keuze === 'geen_interesse') {
    if (p.status !== 'verloren') {
      await supabase.from('prospects').update({ status: 'verloren', lost_reason: 'Geen interesse (via de contactmail)' }).eq('id', id);
      await supabase.from('prospect_activities').insert({
        prospect_id: id, type: 'status_change', title: 'Status → Verloren (prospect gaf via de contactmail aan geen interesse te hebben)',
        body: 'Geen interesse (via de contactmail)', metadata: { from: p.status, to: 'verloren', via: 'contactmail' },
      });
    }
    return NextResponse.json({ success: true });
  }

  if (body.keuze !== 'terugbellen' || !isTerugbelKeuze(body.moment)) {
    return NextResponse.json({ error: 'Kies een moment om terug te bellen.' }, { status: 400 });
  }
  const telefoon = String(body.telefoon ?? '').replace(/[^\d+\s()-]/g, '').trim().slice(0, 30);
  const notitie = String(body.notitie ?? '').trim().slice(0, 500);
  const due = terugbelMoment(body.moment);
  const keuzeLabel = TERUGBEL_KEUZES.find(k => k.key === body.moment)?.label ?? body.moment;
  const beschrijving = [
    `${TAAK_KENMERK}: ${keuzeLabel}.`,
    telefoon ? `Bel op: ${telefoon}` : 'Bel op het bekende nummer.',
    notitie ? `Opmerking: ${notitie}` : '',
  ].filter(Boolean).join(' ');

  /* Nogmaals ingevuld: de bestaande open taak bijwerken in plaats van een tweede. */
  const { data: open } = await supabase
    .from('prospect_tasks')
    .select('id')
    .eq('prospect_id', id)
    .is('completed_at', null)
    .ilike('description', `${TAAK_KENMERK}%`)
    .limit(1);
  const taak = { due_at: due.toISOString(), description: beschrijving, seintje_min: 15, herinnerd_op: null };
  if (open?.length) {
    await supabase.from('prospect_tasks').update(taak).eq('id', open[0].id);
  } else {
    await supabase.from('prospect_tasks').insert({
      ...taak, prospect_id: id, type: 'call', title: TERUGBEL_TITEL,
      assigned_to_admin_id: p.account_manager_id, created_by_admin_id: p.account_manager_id,
    });
  }
  await supabase.from('prospect_activities').insert({
    prospect_id: id, type: 'note', title: 'Prospect vroeg om terugbellen via de contactmail', body: beschrijving,
    metadata: { via: 'contactmail', moment: body.moment, due_at: due.toISOString() },
  });
  if (['nieuw', 'voicemail', 'mail_verstuurd'].includes(p.status)) {
    await supabase.from('prospects').update({ status: 'contact' }).eq('id', id);
    await supabase.from('prospect_activities').insert({
      prospect_id: id, type: 'status_change', title: 'Status → Contact (terugbelverzoek via de contactmail)',
      metadata: { from: p.status, to: 'contact', via: 'contactmail' },
    });
  }

  /* De accountmanager direct laten weten: pushbericht en mail. */
  const tijd = due.toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  if (p.account_manager_id) {
    const [{ data: subs }, { data: am }] = await Promise.all([
      supabase.from('admin_push_subscriptions').select('id, endpoint, p256dh, auth').eq('admin_user_id', p.account_manager_id),
      supabase.from('admin_users').select('email, name').eq('id', p.account_manager_id).maybeSingle(),
    ]);
    if (subs?.length) {
      await verstuurPush(subs as PushAanmelding[], {
        title: 'Terugbelverzoek via de mail', body: `${wie} · ${tijd}`, url: `/admin/prospects?id=${id}`, tag: `contactverzoek-${id}`,
      }, 'admin_push_subscriptions').catch(() => {});
    }
    if (am?.email) {
      const html = `<p>${wie} vroeg via de contactmail om teruggebeld te worden: <strong>${keuzeLabel}</strong>.</p>
        <p>De terugbeltaak staat op <strong>${tijd}</strong>${telefoon ? `, op nummer <strong>${telefoon}</strong>` : ''}.${notitie ? `<br>Opmerking: ${notitie.replace(/[<>]/g, '')}` : ''}</p>
        <p><a href="${EMAIL_BASE_URL}/admin/prospects?id=${id}">Prospect openen</a></p>`;
      await sendEmail(String(am.email), `Terugbelverzoek: ${wie} (${tijd})`, html, { type: 'contactverzoek_am', metadata: { prospect_id: id } }).catch(() => false);
    }
  }
  return NextResponse.json({ success: true, moment: tijd });
}
