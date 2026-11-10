import type { SupabaseClient } from '@supabase/supabase-js';
import { layout, sendEmail } from './email';
import { amsterdamYmd } from './appointmentSlots';

/**
 * Een waarschuwing naar de actieve superadmins, hooguit één keer per soort
 * per dag (ook als de cron vaker draait). Voor dingen die anders stil
 * misgaan, zoals een mislukte sync van de Meta-uitgaven.
 */
export async function alarmeerSuperadmins(
  supabase: SupabaseClient,
  soort: string,
  onderwerp: string,
  html: string,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  const dag = amsterdamYmd(new Date());
  const { data: ontvangers } = await supabase.from('admin_users').select('email, name').eq('is_active', true).eq('role', 'superadmin');
  const { data: al } = await supabase
    .from('email_log').select('to_email').eq('type', soort).neq('status', 'failed').contains('metadata', { dag });
  const gehad = new Set((al ?? []).map(r => String(r.to_email).toLowerCase()));
  let verstuurd = 0;
  for (const o of ontvangers ?? []) {
    const email = String(o.email ?? '').trim();
    if (!email || gehad.has(email.toLowerCase())) continue;
    const ok = await sendEmail(email, onderwerp, layout(onderwerp, html), {
      type: soort,
      toName: (o.name as string | null) ?? undefined,
      metadata: { ...metadata, dag },
    });
    if (ok) verstuurd++;
  }
  return verstuurd;
}

export const escHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
