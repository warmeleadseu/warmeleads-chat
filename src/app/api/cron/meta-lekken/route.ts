import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { layout, sendEmail } from '@/lib/email';
import { amsterdamWallTimeToUtc, amsterdamYmd } from '@/lib/appointmentSlots';
import { bouwLekMail, LEK_DAGEN, zoekLekken, type SpendRij } from '@/lib/metaLekken';

/**
 * Elke ochtend: advertenties die geld uitgeven en volgens Meta leads krijgen,
 * terwijl er bij ons niets binnenkomt (src/lib/metaLekken.ts). Gaat naar de
 * actieve superadmins, alleen als er iets is en hooguit één keer per dag.
 * Met ?proef=1 komt de lijst terug zonder dat er iets wordt verstuurd.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAIL_TYPE = 'meta_lekken';

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();
  const vandaag = amsterdamYmd(new Date());
  const vanafDag = amsterdamYmd(new Date(amsterdamWallTimeToUtc(vandaag, '12:00').getTime() - LEK_DAGEN * 86_400_000));
  const vanafIso = amsterdamWallTimeToUtc(vanafDag, '00:00').toISOString();

  try {
    const spend: SpendRij[] = [];
    for (let p = 0; p < 20; p++) {
      const { data, error } = await supabase
        .from('meta_ad_spend')
        .select('ad_id, ad_name, campaign_id, campaign_name, date, spend, leads_count')
        .gte('date', vanafDag)
        .order('id')
        .range(p * 1000, p * 1000 + 999);
      if (error) throw new Error(`uitgaven: ${error.message}`);
      spend.push(...((data ?? []) as SpendRij[]));
      if (!data || data.length < 1000) break;
    }

    const binnen = new Map<string, number>();
    const tel = (ad: unknown) => { if (typeof ad === 'string' && ad) binnen.set(ad, (binnen.get(ad) ?? 0) + 1); };
    for (let p = 0; p < 20; p++) {
      const { data, error } = await supabase
        .from('leads').select('meta_ad_id').gte('created_at', vanafIso).not('meta_ad_id', 'is', null)
        .order('id').range(p * 1000, p * 1000 + 999);
      if (error) throw new Error(`leads: ${error.message}`);
      for (const l of data ?? []) tel(l.meta_ad_id);
      if (!data || data.length < 1000) break;
    }
    for (let p = 0; p < 20; p++) {
      const { data, error } = await supabase
        .from('prospects').select('source_metadata').eq('source', 'meta_partner').gte('created_at', vanafIso)
        .order('id').range(p * 1000, p * 1000 + 999);
      if (error) throw new Error(`partneraanmeldingen: ${error.message}`);
      for (const r of data ?? []) tel((r.source_metadata as { meta_ad_id?: unknown } | null)?.meta_ad_id);
      if (!data || data.length < 1000) break;
    }

    const lekken = zoekLekken(spend, binnen);
    if (request.nextUrl.searchParams.get('proef') === '1') return NextResponse.json({ vanaf: vanafDag, lekken });
    if (lekken.length === 0) return NextResponse.json({ ok: true, vanaf: vanafDag, lekken: 0 });

    const { onderwerp, html } = bouwLekMail(lekken, vanafDag);
    const { data: ontvangers } = await supabase.from('admin_users').select('email, name').eq('is_active', true).eq('role', 'superadmin');
    const { data: al } = await supabase
      .from('email_log').select('to_email').eq('type', MAIL_TYPE).neq('status', 'failed').contains('metadata', { dag: vandaag });
    const gehad = new Set((al ?? []).map(r => String(r.to_email).toLowerCase()));

    let verstuurd = 0;
    for (const o of ontvangers ?? []) {
      const email = String(o.email ?? '').trim();
      if (!email || gehad.has(email.toLowerCase())) continue;
      const ok = await sendEmail(email, onderwerp, layout(onderwerp, html), {
        type: MAIL_TYPE,
        toName: (o.name as string | null) ?? undefined,
        metadata: { dag: vandaag, advertenties: lekken.map(l => l.ad_id), uitgaven: lekken.reduce((s, l) => s + l.uitgaven, 0) },
      });
      if (ok) verstuurd++;
    }
    return NextResponse.json({ ok: true, vanaf: vanafDag, lekken: lekken.length, verstuurd });
  } catch (e) {
    console.error('[cron/meta-lekken]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Controle mislukt' }, { status: 500 });
  }
}
