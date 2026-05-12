/**
 * Helpers rond de kolommen `customers.country` (NL/BE) en `invoices.vat_mode`,
 * die via migratie `100_customers_country_invoice_vat_mode.sql` worden toegevoegd.
 *
 * Doel: de codebase werkt zowel mét als zonder die migratie. Bij gebruik van deze
 * helpers wordt eenmalig per Node-proces gedetecteerd of de kolommen al bestaan:
 *   - Bestaan ze niet, dan worden ze veilig overgeslagen bij selects en writes
 *     (klanten worden in dat geval default als NL behandeld, geen BTW-verlegging).
 *   - Bestaan ze wel, dan worden ze normaal opgehaald en weggeschreven, en wordt
 *     reverse charge voor Belgische B2B klanten correct toegepast.
 */
import type { createServerClient } from '@/lib/supabase';

type Supabase = ReturnType<typeof createServerClient>;

let _customersCountryColumn: 'unknown' | 'yes' | 'no' = 'unknown';
let _invoicesVatModeColumn: 'unknown' | 'yes' | 'no' = 'unknown';

function isUndefinedColumnError(err: unknown, columnName: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  if (e.code === '42703') return true;
  if (typeof e.message === 'string' && new RegExp(`column .*${columnName}.* does not exist`, 'i').test(e.message)) {
    return true;
  }
  return false;
}

/**
 * Cached probe: bestaat `customers.country`?
 * Bij twijfel/andere fouten wordt `true` teruggegeven (optimistisch),
 * zodat het systeem werkt voor klanten waar de kolom wél bestaat.
 */
export async function customersHaveCountryColumn(supabase: Supabase): Promise<boolean> {
  if (_customersCountryColumn !== 'unknown') return _customersCountryColumn === 'yes';
  const { error } = await supabase
    .from('customers')
    .select('country', { head: true, count: 'exact' })
    .limit(1);
  if (!error) {
    _customersCountryColumn = 'yes';
    return true;
  }
  if (isUndefinedColumnError(error, 'country')) {
    _customersCountryColumn = 'no';
    return false;
  }
  // Andere fout (RLS, netwerk): niet cachen, optimistisch true.
  return true;
}

/** Cached probe: bestaat `invoices.vat_mode`? */
export async function invoicesHaveVatModeColumn(supabase: Supabase): Promise<boolean> {
  if (_invoicesVatModeColumn !== 'unknown') return _invoicesVatModeColumn === 'yes';
  const { error } = await supabase
    .from('invoices')
    .select('vat_mode', { head: true, count: 'exact' })
    .limit(1);
  if (!error) {
    _invoicesVatModeColumn = 'yes';
    return true;
  }
  if (isUndefinedColumnError(error, 'vat_mode')) {
    _invoicesVatModeColumn = 'no';
    return false;
  }
  return true;
}

/**
 * Bouwt de select-string voor `customers` op en voegt `country` toe wanneer de
 * kolom bestaat. `baseSelect` mag al `country` bevatten (wordt dan niet dubbel).
 */
export async function buildCustomerSelectWithCountry(
  supabase: Supabase,
  baseSelect: string,
): Promise<string> {
  if (/\bcountry\b/.test(baseSelect)) return baseSelect;
  const has = await customersHaveCountryColumn(supabase);
  return has ? `${baseSelect}, country` : baseSelect;
}

/** Verwijdert `country` uit de payload als de kolom (nog) niet bestaat in DB. */
export async function sanitizeCustomerWritePayload<T extends Record<string, unknown>>(
  supabase: Supabase,
  payload: T,
): Promise<T> {
  if (!('country' in payload)) return payload;
  const has = await customersHaveCountryColumn(supabase);
  if (has) return payload;
  const { country: _omit, ...rest } = payload;
  void _omit;
  return rest as T;
}

/** Verwijdert `vat_mode` uit de payload als de kolom (nog) niet bestaat in DB. */
export async function sanitizeInvoiceWritePayload<T extends Record<string, unknown>>(
  supabase: Supabase,
  payload: T,
): Promise<T> {
  if (!('vat_mode' in payload)) return payload;
  const has = await invoicesHaveVatModeColumn(supabase);
  if (has) return payload;
  const { vat_mode: _omit, ...rest } = payload;
  void _omit;
  return rest as T;
}

/** Test-only: reset gecachte staat (gebruikt door unit tests om probe opnieuw uit te voeren). */
export function __resetColumnSupportCacheForTests(): void {
  _customersCountryColumn = 'unknown';
  _invoicesVatModeColumn = 'unknown';
}
