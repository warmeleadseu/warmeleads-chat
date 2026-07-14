import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

function readEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }
  return { url, key };
}

/**
 * Service-role client (untyped). Blijft bestaan voor bestaande code; nieuwe/
 * gemigreerde code gebruikt bij voorkeur `createTypedServerClient()` voor
 * compile-time veiligheid op tabellen/kolommen.
 */
export const createServerClient = () => {
  const { url, key } = readEnv();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

/**
 * Getypte service-role client op basis van de gegenereerde `Database`-types
 * (zie `src/lib/database.types.ts`, hergenereren met
 * `supabase gen types typescript --project-id <ref> --schema public`).
 * Gefaseerde adoptie: gebruik dit in nieuwe modules zodat kolom-/tabelnamen
 * en resultaattypes kloppen.
 */
export const createTypedServerClient = (): SupabaseClient<Database> => {
  const { url, key } = readEnv();
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

export type { Database };
