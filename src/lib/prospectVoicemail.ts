import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Voicemailteller voor prospects: hoe vaak is iemand gebeld en kreeg je de
 * voicemail, en wanneer.
 *
 * Een voicemail is een activiteit van type 'call' met metadata.uitkomst =
 * 'voicemail' (de knop "Voicemail +1"), of een oudere statuswijziging naar
 * Voicemail van vóór die knop bestond. Zet de knop ook de status om, dan
 * krijgt die statuswijziging via_voicemail_knop, zodat hij niet dubbel telt.
 */

export type VoicemailActiviteit = {
  id?: string;
  prospect_id?: string;
  type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin_user_id?: string | null;
};

export type VoicemailMoment = { op: string; door: string | null };
export type VoicemailSamenvatting = { aantal: number; momenten: VoicemailMoment[] };

/** Statussen waaruit "Voicemail +1" de status naar Voicemail zet; hogere blijven staan. */
export const VOICEMAIL_ZET_STATUS_VANUIT = ['nieuw', 'contact', 'mail_verstuurd'];

export function isVoicemail(a: VoicemailActiviteit): boolean {
  const m = a.metadata ?? {};
  if (a.type === 'call') return m.uitkomst === 'voicemail';
  if (a.type === 'status_change') return m.to === 'voicemail' && !m.via_voicemail_knop;
  return false;
}

/** Puur: teller en momenten (nieuwste eerst) per prospect. */
export function vatVoicemailsSamen(
  acts: VoicemailActiviteit[],
  naamVan: (adminId: string | null | undefined) => string | null = () => null,
): Map<string, VoicemailSamenvatting> {
  const uit = new Map<string, VoicemailSamenvatting>();
  for (const a of acts) {
    if (!a.prospect_id || !isVoicemail(a)) continue;
    const s = uit.get(a.prospect_id) ?? { aantal: 0, momenten: [] };
    s.aantal++;
    s.momenten.push({ op: a.created_at, door: naamVan(a.admin_user_id) });
    uit.set(a.prospect_id, s);
  }
  for (const s of uit.values()) s.momenten.sort((x, y) => y.op.localeCompare(x.op));
  return uit;
}

/** Filterwaarde uit de lijst: '1', '2' of '3plus'. */
export function pastBijVoicemailFilter(aantal: number, filter: string): boolean {
  if (filter === '1') return aantal === 1;
  if (filter === '2') return aantal === 2;
  if (filter === '3plus') return aantal >= 3;
  return true;
}

const SELECT = 'id, prospect_id, type, metadata, created_at, admin_user_id';

async function adminNamen(supabase: SupabaseClient, acts: VoicemailActiviteit[]): Promise<(id: string | null | undefined) => string | null> {
  const ids = [...new Set(acts.map(a => a.admin_user_id).filter((x): x is string => !!x))];
  if (!ids.length) return () => null;
  const { data } = await supabase.from('admin_users').select('id, name').in('id', ids);
  const m = new Map((data ?? []).map(a => [a.id as string, (a.name as string) || null]));
  return id => (id ? m.get(id) ?? null : null);
}

/** Voicemails voor een set prospects (bijvoorbeeld één pagina van de lijst). */
export async function laadVoicemails(supabase: SupabaseClient, prospectIds: string[]): Promise<Map<string, VoicemailSamenvatting>> {
  if (!prospectIds.length) return new Map();
  const acts: VoicemailActiviteit[] = [];
  for (let i = 0; i < prospectIds.length; i += 200) {
    const { data } = await supabase
      .from('prospect_activities')
      .select(SELECT)
      .in('prospect_id', prospectIds.slice(i, i + 200))
      .in('type', ['call', 'status_change']);
    acts.push(...((data ?? []) as VoicemailActiviteit[]));
  }
  return vatVoicemailsSamen(acts, await adminNamen(supabase, acts));
}

/** Alle prospects die bij het voicemailfilter horen (voor de lijst en de export). */
export async function prospectIdsVoorVoicemailFilter(supabase: SupabaseClient, filter: string): Promise<string[]> {
  const acts: VoicemailActiviteit[] = [];
  for (let p = 0; p < 50; p++) {
    const { data } = await supabase
      .from('prospect_activities')
      .select('prospect_id, type, metadata, created_at')
      .in('type', ['call', 'status_change'])
      .order('id')
      .range(p * 1000, p * 1000 + 999);
    acts.push(...((data ?? []) as VoicemailActiviteit[]));
    if (!data || data.length < 1000) break;
  }
  return [...vatVoicemailsSamen(acts).entries()].filter(([, s]) => pastBijVoicemailFilter(s.aantal, filter)).map(([id]) => id);
}
