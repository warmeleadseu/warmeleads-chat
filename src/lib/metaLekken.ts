/**
 * Advertenties die geld uitgeven en volgens Meta leads opleveren, terwijl er
 * bij ons niets van binnenkomt: het formulier hangt niet (meer) aan Zapier of
 * de webhook. Zo gingen in november bij Energiekompas Enschede en KwH Garant
 * Doorn/Woerden 26 betaalde leads verloren zonder dat iemand het zag.
 *
 * Telt per advertentie de uitgaven en Meta-leads van de afgelopen dagen
 * tegen wat er in die dagen binnenkwam: consumentenleads (leads.meta_ad_id)
 * en partneraanmeldingen (prospects, source_metadata.meta_ad_id).
 */

export type SpendRij = {
  ad_id: string | null; ad_name: string | null; campaign_id: string | null; campaign_name: string | null;
  date: string; spend: number | string | null; leads_count: number | null;
};

export type Lek = {
  ad_id: string; ad_name: string; campaign_id: string | null; campaign_name: string;
  uitgaven: number; metaLeads: number; laatsteDag: string;
};

/** Hoe ver terug: drie dagen plus vandaag, zodat een gat van een paar uur geen alarm geeft. */
export const LEK_DAGEN = 3;
/** Pas waarschuwen vanaf zoveel Meta-leads zonder één lead bij ons. */
export const LEK_MIN_META_LEADS = 3;
/** En vanaf dit bedrag aan uitgaven in die dagen. */
export const LEK_MIN_UITGAVEN = 20;

/** Campagnes van een ander bedrijf; tellen ook nergens anders mee (winst_lekkage). */
const ANDER_BEDRIJF = /\b(pakketadvies|energie)\b/i;

export function zoekLekken(spend: SpendRij[], binnengekomenPerAd: Map<string, number>): Lek[] {
  const perAd = new Map<string, Lek>();
  for (const r of spend) {
    if (!r.ad_id) continue;
    if (ANDER_BEDRIJF.test(r.campaign_name ?? '')) continue;
    const l = perAd.get(r.ad_id) ?? {
      ad_id: r.ad_id, ad_name: r.ad_name ?? r.ad_id, campaign_id: r.campaign_id, campaign_name: r.campaign_name ?? '',
      uitgaven: 0, metaLeads: 0, laatsteDag: r.date,
    };
    l.uitgaven += Number(r.spend) || 0;
    l.metaLeads += Number(r.leads_count) || 0;
    if (r.date > l.laatsteDag) l.laatsteDag = r.date;
    perAd.set(r.ad_id, l);
  }
  return [...perAd.values()]
    .map(l => ({ ...l, uitgaven: Math.round(l.uitgaven * 100) / 100 }))
    .filter(l => l.metaLeads >= LEK_MIN_META_LEADS && l.uitgaven >= LEK_MIN_UITGAVEN && (binnengekomenPerAd.get(l.ad_id) ?? 0) === 0)
    .sort((a, b) => b.uitgaven - a.uitgaven);
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const euro = (n: number) => `€${n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function bouwLekMail(lekken: Lek[], vanaf: string): { onderwerp: string; html: string } {
  const totaal = lekken.reduce((s, l) => s + l.uitgaven, 0);
  const leads = lekken.reduce((s, l) => s + l.metaLeads, 0);
  const onderwerp = lekken.length === 1
    ? `Advertentie zonder leads in het CRM: ${lekken[0].campaign_name || lekken[0].ad_name}`
    : `${lekken.length} advertenties zonder leads in het CRM`;
  const rijen = lekken.map(l => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a">${esc(l.campaign_name)}<br><span style="color:#64748b">${esc(l.ad_name)} · ${esc(l.ad_id)}</span></td>
      <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;white-space:nowrap">${euro(l.uitgaven)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right">${l.metaLeads}</td>
    </tr>`).join('');
  const html = `
    <p style="font-size:14px;color:#334155;line-height:1.6">Sinds ${esc(vanaf)} gaven deze advertenties samen ${euro(totaal)} uit en kregen ze volgens Meta ${leads} leads. Bij ons kwam daarvan niets binnen. Meestal hangt het formulier niet aan Zapier.</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0">
      <tr>
        <th style="text-align:left;padding:6px;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0">Campagne en advertentie</th>
        <th style="text-align:right;padding:6px;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0">Uitgaven</th>
        <th style="text-align:right;padding:6px;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0">Leads Meta</th>
      </tr>${rijen}
    </table>
    <p style="font-size:14px;color:#334155;line-height:1.6"><strong>Wat te doen:</strong> koppel het formulier van de advertentie in Zapier, of zet de advertentie stil. De leads die al binnen zijn, kun je in Meta downloaden onder Formulieren.</p>`;
  return { onderwerp, html };
}
