import type { SupabaseClient } from '@supabase/supabase-js';
import type { PortalJwtClaims } from './portalSession';

/**
 * Returns true when the JWT was issued before the last password reset
 * (portal_session_versions bump). Impersonation tokens are exempt.
 */
export async function isPortalSessionRevoked(
  supabase: SupabaseClient,
  claims: PortalJwtClaims,
  tokenIssuedAtSec: number,
): Promise<boolean> {
  if ('imp' in claims && claims.imp) return false;

  let query = supabase.from('portal_session_versions').select('version').limit(1);

  if (claims.typ === 'portal_user') {
    query = query.eq('portal_user_id', claims.sub);
  } else {
    query = query.eq('customer_id', claims.sub).is('portal_user_id', null);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data?.version) return false;

  const revokedAfter = Number(data.version);
  if (!Number.isFinite(revokedAfter) || revokedAfter <= 0) return false;

  return tokenIssuedAtSec < revokedAfter;
}
