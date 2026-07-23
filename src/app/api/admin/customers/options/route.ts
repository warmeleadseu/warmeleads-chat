import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { sanitizePostgrestIlike } from '@/lib/phoneSearch';
import { customersHaveCountryColumn } from '@/lib/customerCountrySupport';
import { amCustomerAccessOrFilter } from '@/lib/permissions';

/**
 * GET /api/admin/customers/options
 *
 * Lichtgewicht klanten-feed voor dropdowns/kiezers (Nieuwe batch, Nieuwe
 * factuur, Bulk lead export, Afspraak plannen, AM-koppeling, ...).
 *
 * Waarom een aparte endpoint?
 *   `/api/admin/customers` heeft DEFAULT_LIMIT=25 + MAX_LIMIT=100 +
 *   `enrichCustomersWithCounts()` (KPIs, batches, openstaande facturen).
 *   Dat is correct voor het klantenoverzicht, maar te zwaar én te
 *   beperkt voor een simpele dropdown — kiezers werden alfabetisch
 *   afgekapt op de eerste 25 klanten, waardoor admins de helft van hun
 *   portefeuille niet meer konden selecteren.
 *
 * Filters (allemaal optioneel):
 *   - `active=1`      → alleen `is_active=true` klanten
 *   - `search=...`    → ilike op name + contact_person + email
 *
 * Respect voor accountmanagers: zij zien alleen klanten waar zij als
 * `account_manager_id` aan gekoppeld zijn (consistent met de andere
 * `/api/admin/customers*` endpoints).
 *
 * Velden in de response zijn bewust minimaal gehouden — dropdown
 * componenten hebben alleen id/name/email/is_active/account_manager_id
 * nodig. `country` en `vat_id` worden meegestuurd voor de Nieuwe-factuur
 * dropdown (BTW-berekening hangt daarvan af). Geen tellertjes, geen
 * joins. Dat houdt de query snel ook bij 1000+ klanten.
 */

const ABSOLUTE_MAX = 5000;

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const url = request.nextUrl;
  const activeOnly = url.searchParams.get('active') === '1' || url.searchParams.get('active') === 'true';
  const search = (url.searchParams.get('search') || '').trim();

  // Sommige oude omgevingen hebben nog geen `country` kolom — netjes
  // detecteren en weglaten uit de SELECT om een 42703-fout te vermijden.
  const hasCountry = await customersHaveCountryColumn(supabase);
  const baseFields = ['id', 'name', 'email', 'is_active', 'account_manager_id', 'vat_id'];
  const selectFields = hasCountry ? [...baseFields, 'country'].join(', ') : baseFields.join(', ');

  let query = supabase
    .from('customers')
    .select(selectFields)
    .order('name', { ascending: true, nullsFirst: false })
    .limit(ABSOLUTE_MAX);

  if (admin.role === 'accountmanager') {
    query = query.or(amCustomerAccessOrFilter(admin.id));
  }
  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  if (search) {
    const safe = sanitizePostgrestIlike(search);
    const or = [
      `name.ilike.%${safe}%`,
      `contact_person.ilike.%${safe}%`,
      `email.ilike.%${safe}%`,
    ].join(',');
    query = query.or(or);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Klanten ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ customers: data || [] });
}
