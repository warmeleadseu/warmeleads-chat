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
let _invoicesDueDateColumn: 'unknown' | 'yes' | 'no' = 'unknown';
let _invoicesCreditNoteOfColumn: 'unknown' | 'yes' | 'no' = 'unknown';

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

/** Cached probe: bestaat `invoices.due_date`? */
export async function invoicesHaveDueDateColumn(supabase: Supabase): Promise<boolean> {
  if (_invoicesDueDateColumn !== 'unknown') return _invoicesDueDateColumn === 'yes';
  const { error } = await supabase
    .from('invoices')
    .select('due_date', { head: true, count: 'exact' })
    .limit(1);
  if (!error) {
    _invoicesDueDateColumn = 'yes';
    return true;
  }
  if (isUndefinedColumnError(error, 'due_date')) {
    _invoicesDueDateColumn = 'no';
    return false;
  }
  return true;
}

/** Cached probe: bestaat `invoices.credit_note_of`? */
export async function invoicesHaveCreditNoteOfColumn(supabase: Supabase): Promise<boolean> {
  if (_invoicesCreditNoteOfColumn !== 'unknown') return _invoicesCreditNoteOfColumn === 'yes';
  const { error } = await supabase
    .from('invoices')
    .select('credit_note_of', { head: true, count: 'exact' })
    .limit(1);
  if (!error) {
    _invoicesCreditNoteOfColumn = 'yes';
    return true;
  }
  if (isUndefinedColumnError(error, 'credit_note_of')) {
    _invoicesCreditNoteOfColumn = 'no';
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

/**
 * Verwijdert kolommen uit de payload die (nog) niet in de DB bestaan
 * (`vat_mode`, `due_date`, `credit_note_of`). Zo werkt het schrijven van
 * facturen zowel mét als zonder de bijbehorende migraties.
 */
export async function sanitizeInvoiceWritePayload<T extends Record<string, unknown>>(
  supabase: Supabase,
  payload: T,
): Promise<T> {
  let result: Record<string, unknown> = payload;

  if ('vat_mode' in result && !(await invoicesHaveVatModeColumn(supabase))) {
    const { vat_mode: _omit, ...rest } = result;
    void _omit;
    result = rest;
  }
  if ('due_date' in result && !(await invoicesHaveDueDateColumn(supabase))) {
    const { due_date: _omit, ...rest } = result;
    void _omit;
    result = rest;
  }
  if ('credit_note_of' in result && !(await invoicesHaveCreditNoteOfColumn(supabase))) {
    const { credit_note_of: _omit, ...rest } = result;
    void _omit;
    result = rest;
  }

  return result as T;
}

/** Test-only: reset gecachte staat (gebruikt door unit tests om probe opnieuw uit te voeren). */
export function __resetColumnSupportCacheForTests(): void {
  _customersCountryColumn = 'unknown';
  _invoicesVatModeColumn = 'unknown';
  _invoicesDueDateColumn = 'unknown';
  _invoicesCreditNoteOfColumn = 'unknown';
}
