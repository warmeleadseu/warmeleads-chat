import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { STAFFEL_SLEUTEL, leesStaffels, maandTargets, ontbrekend, type NieuweTarget } from '@/lib/amStaffel';

/**
 * Elke nacht: de standaard bonusstaffels van accountmanagers (zie
 * src/lib/amStaffel.ts) als targets voor de lopende maand klaarzetten. Wat er
 * al staat, blijft staan; de ronde maakt alleen ontbrekende treden aan. Zo
 * staan op de 1e van de maand de treden er vanzelf.
 *
 * ?proef=1 laat zien wat er zou gebeuren zonder iets te doen.
 */

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;
  const proef = request.nextUrl.searchParams.get('proef') === '1';
  const supabase = createServerClient();
  const maand = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }).slice(0, 7);

  const { data: instelling, error } = await supabase.from('app_settings').select('value').eq('key', STAFFEL_SLEUTEL).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const staffels = leesStaffels(instelling?.value as string | null);
  if (staffels.length === 0) return NextResponse.json({ ok: true, maand, gedaan: 'geen staffels ingesteld' });

  /* Alleen voor medewerkers die nog actief zijn. */
  const { data: actief } = await supabase
    .from('admin_users')
    .select('id')
    .in('id', staffels.map(s => s.admin_user_id))
    .eq('is_active', true);
  const actieveIds = new Set((actief ?? []).map(a => a.id as string));

  const gewenst: NieuweTarget[] = staffels.filter(s => actieveIds.has(s.admin_user_id)).flatMap(s => maandTargets(s, maand));
  if (gewenst.length === 0) return NextResponse.json({ ok: true, maand, gedaan: 'niets voor deze maand' });

  const { data: bestaand, error: bErr } = await supabase
    .from('am_targets')
    .select('admin_user_id, target_type, target_value, period_start')
    .in('admin_user_id', [...new Set(gewenst.map(t => t.admin_user_id))])
    .eq('period_start', `${maand}-01`);
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  const nieuw = ontbrekend(gewenst, (bestaand ?? []) as { admin_user_id: string; target_type: string; target_value: number; period_start: string }[]);
  if (proef || nieuw.length === 0) {
    return NextResponse.json({ ok: true, proef, maand, aanTeMaken: nieuw.map(t => ({ label: t.label, waarde: t.target_value, bonus: t.bonus_amount })) });
  }

  const { error: iErr } = await supabase.from('am_targets').insert(nieuw);
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, maand, aangemaakt: nieuw.length });
}
