import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Naar wie een signaal over een klant gaat: de accountmanager van de batch,
 * anders die van de klant, en anders info@ (dan ziet in elk geval iemand het).
 */
export async function accountmanagerOntvanger(
  supabase: SupabaseClient,
  ids: { batchAm?: string | null; klantAm?: string | null },
): Promise<{ email: string; name: string | null }> {
  const amId = ids.batchAm || ids.klantAm;
  if (amId) {
    const { data: am } = await supabase.from('admin_users').select('email, name, is_active').eq('id', amId).maybeSingle();
    if (am?.email && am.is_active !== false) return { email: am.email as string, name: (am.name as string | null) ?? null };
  }
  return { email: 'info@warmeleads.eu', name: 'WarmeLeads' };
}
