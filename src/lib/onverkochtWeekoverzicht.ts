import { EMAIL_BASE_URL } from './email';

/**
 * Wekelijks overzicht van onverkochte leads per branche en regio, voor
 * accountmanagers als verkooplijst: "in Gelderland liggen deze week 8
 * warmtepompleads zonder koper". Elke regel linkt naar precies die selectie
 * in Leads CRM (datumfilter op wervingsdatum, alleen niet uitgedeeld, alleen
 * geldige telefoonnummers), zodat de aantallen in de mail en het CRM gelijk
 * zijn.
 */

export type OnverkochtRij = { branch: string; provincie: string | null; land: string | null };
export type Week = { van: string; tot: string };

/** De afgelopen volledige week, maandag t/m zondag, in Nederlandse tijd. */
export function vorigeWeek(nu: Date = new Date()): Week {
  const nl = new Date(nu.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const dag = (nl.getDay() + 6) % 7; // maandag = 0
  const dezeMaandag = new Date(nl.getFullYear(), nl.getMonth(), nl.getDate() - dag);
  const van = new Date(dezeMaandag.getFullYear(), dezeMaandag.getMonth(), dezeMaandag.getDate() - 7);
  const tot = new Date(dezeMaandag.getFullYear(), dezeMaandag.getMonth(), dezeMaandag.getDate() - 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { van: iso(van), tot: iso(tot) };
}

export type Groep = { branch: string; totaal: number; regios: { provincie: string; aantal: number }[] };

export function groepeer(rijen: OnverkochtRij[]): Groep[] {
  const perBranche = new Map<string, Map<string, number>>();
  for (const r of rijen) {
    const regio = r.provincie?.trim() || (r.land === 'BE' ? 'België (provincie onbekend)' : 'Onbekend');
    const m = perBranche.get(r.branch) ?? new Map<string, number>();
    m.set(regio, (m.get(regio) ?? 0) + 1);
    perBranche.set(r.branch, m);
  }
  return [...perBranche.entries()]
    .map(([branch, m]) => ({
      branch,
      totaal: [...m.values()].reduce((a, b) => a + b, 0),
      regios: [...m.entries()].map(([provincie, aantal]) => ({ provincie, aantal })).sort((a, b) => b.aantal - a.aantal || a.provincie.localeCompare(b.provincie)),
    }))
    .sort((a, b) => b.totaal - a.totaal);
}

/** Link naar Leads CRM met precies deze selectie. */
export function crmLink(week: Week, branch?: string, provincie?: string): string {
  const p = new URLSearchParams({
    assignment: 'unassigned',
    phone_valid: 'true',
    date_from: week.van,
    date_to: week.tot,
    include_unknown_date: 'false',
  });
  if (branch) p.set('branch', branch);
  if (provincie && !provincie.startsWith('België') && provincie !== 'Onbekend') p.set('province', provincie);
  return `${EMAIL_BASE_URL}/admin/leads?${p.toString()}`;
}

export function datumNl(iso: string): string {
  const [j, m, d] = iso.split('-').map(Number);
  return new Date(j, m - 1, d).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function bouwInhoud(
  week: Week,
  groepen: Groep[],
  brancheNaam: (slug: string) => string,
  extra: { totaalLeads: number; nepnummers: number },
): { onderwerp: string; html: string } {
  const totaal = groepen.reduce((s, g) => s + g.totaal, 0);
  const periode = `${datumNl(week.van)} t/m ${datumNl(week.tot)}`;
  const onderwerp = `Onverkochte leads week ${week.van.slice(8, 10)}-${week.van.slice(5, 7)} t/m ${week.tot.slice(8, 10)}-${week.tot.slice(5, 7)}: ${totaal} zonder koper`;

  const blokken = groepen.map(g => `
    <tr><td style="padding:16px 0 6px">
      <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a">${esc(brancheNaam(g.branch))} &middot; ${g.totaal} lead${g.totaal === 1 ? '' : 's'}
        <a href="${crmLink(week, g.branch)}" style="margin-left:6px;font-size:12px;font-weight:600;color:#3B2F75">bekijk alle</a></p>
    </td></tr>
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e2e8f0;border-radius:8px">
        ${g.regios.map((r, i) => `
        <tr style="${i % 2 ? 'background:#f8fafc' : ''}">
          <td style="padding:7px 12px;font-size:13px;color:#334155">${esc(r.provincie)}</td>
          <td style="padding:7px 12px;font-size:13px;color:#0f172a;font-weight:700;text-align:right;width:60px">${r.aantal}</td>
          <td style="padding:7px 12px;font-size:12px;text-align:right;width:120px"><a href="${crmLink(week, g.branch, r.provincie)}" style="color:#3B2F75;font-weight:600">in Leads CRM &rarr;</a></td>
        </tr>`).join('')}
      </table>
    </td></tr>`).join('');

  const html = `
    <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#0f172a">Onverkochte leads van vorige week</p>
    <p style="margin:0 0 4px;font-size:14px;color:#475569">Periode: <strong>${esc(periode)}</strong> (wervingsdatum)</p>
    <p style="margin:0 0 14px;font-size:14px;color:#475569">
      Van de ${extra.totaalLeads} leads die deze week binnenkwamen, hebben er <strong>${totaal}</strong> met een geldig telefoonnummer nog geen enkele klant.
      Dit zijn kansen voor nieuwe afnemers in deze regio's, of voor een bulkpakket.
      ${extra.nepnummers ? `(${extra.nepnummers} leads met een ongeldig nummer zijn niet meegeteld.)` : ''}
    </p>
    <p style="margin:0 0 4px;font-size:13px;color:#64748b">
      In Leads CRM: filter op wervingsdatum ${esc(week.van)} t/m ${esc(week.tot)}, "niet uitgedeeld" en geldig telefoonnummer. De links hieronder zetten die filters voor je klaar.
    </p>
    ${totaal === 0
      ? '<p style="margin:16px 0 0;font-size:14px;color:#047857;font-weight:600">Alle leads van deze week zijn verkocht.</p>'
      : `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">${blokken}</table>`}`;

  return { onderwerp, html };
}

type Db = import('@supabase/supabase-js').SupabaseClient;

/**
 * Stelt het overzicht van een week samen uit de database. Onverkocht: een
 * geldig telefoonnummer en geen enkele klant behalve een masterportaal-spiegel.
 */
export async function stelWeekoverzichtSamen(supabase: Db, week: Week, spiegelKlanten: string[]) {
  const rijen: { branch: string; provincie: string | null; land: string | null; phone_valid: boolean | null; assigned_customer_ids: string[] | null }[] = [];
  for (let p = 0; p < 50; p++) {
    const { data, error } = await supabase
      .from('leads')
      .select('branch, provincie, land, phone_valid, assigned_customer_ids')
      .neq('bron', 'demo')
      .gte('wervingsdatum', week.van)
      .lte('wervingsdatum', week.tot)
      .order('id')
      .range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    rijen.push(...((data ?? []) as typeof rijen));
    if (!data || data.length < 1000) break;
  }
  const spiegel = new Set(spiegelKlanten);
  const zonderKlant = rijen.filter(r => (r.assigned_customer_ids ?? []).every(id => spiegel.has(id)));
  const onverkocht = zonderKlant.filter(r => r.phone_valid === true);

  const { data: branches } = await supabase.from('branches').select('slug, name');
  const namen = new Map((branches ?? []).map(b => [b.slug as string, b.name as string]));

  return {
    groepen: groepeer(onverkocht),
    totaalLeads: rijen.length,
    nepnummers: zonderKlant.filter(r => r.phone_valid === false).length,
    brancheNaam: (slug: string) => namen.get(slug) ?? slug,
  };
}
