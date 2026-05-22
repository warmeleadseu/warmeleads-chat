import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import bcrypt from 'bcryptjs';
import { logAudit } from '@/lib/audit';
import { buildPhoneSearchIlikeClauses, sanitizePostgrestIlike } from '@/lib/phoneSearch';
import { sanitizeCustomerWritePayload, customersHaveCountryColumn } from '@/lib/customerCountrySupport';
import { recalcOpenInvoicesForCustomer } from '@/lib/recalcOpenInvoices';
import { enrichCustomersWithCounts } from '@/lib/adminCustomerEnrichment';
import {
  applyCustomerBranchesChange,
  branchesChanged,
  normalizeCustomerBranchSlugs,
  validateCustomerBranchSlugs,
} from '@/lib/customerBranches';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const url = request.nextUrl;

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT))));
  const search = (url.searchParams.get('search') || '').trim();
  const status = url.searchParams.get('status') || 'all';
  const sort = url.searchParams.get('sort') || 'name';
  const order = url.searchParams.get('order') || 'asc';

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let countQuery = supabase.from('customers').select('id', { count: 'exact', head: true });
  let dataQuery = supabase.from('customers').select('*');

  if (admin.role === 'accountmanager') {
    countQuery = countQuery.eq('account_manager_id', admin.id);
    dataQuery = dataQuery.eq('account_manager_id', admin.id);
  }

  if (search) {
    const sanitized = sanitizePostgrestIlike(search);
    const parts = [
      `name.ilike.%${sanitized}%`,
      `contact_person.ilike.%${sanitized}%`,
      `email.ilike.%${sanitized}%`,
      `city.ilike.%${sanitized}%`,
      ...buildPhoneSearchIlikeClauses('phone', search),
    ];
    const searchFilter = parts.join(',');
    countQuery = countQuery.or(searchFilter);
    dataQuery = dataQuery.or(searchFilter);
  }

  if (status === 'active') {
    countQuery = countQuery.eq('portal_active', true).not('password_hash', 'is', null).or(`last_seen_at.gte.${sevenDaysAgo},last_login_at.gte.${sevenDaysAgo}`);
    dataQuery = dataQuery.eq('portal_active', true).not('password_hash', 'is', null).or(`last_seen_at.gte.${sevenDaysAgo},last_login_at.gte.${sevenDaysAgo}`);
  } else if (status === 'never') {
    countQuery = countQuery.eq('portal_active', true).not('password_hash', 'is', null).is('last_login_at', null);
    dataQuery = dataQuery.eq('portal_active', true).not('password_hash', 'is', null).is('last_login_at', null);
  } else if (status === 'inactive') {
    countQuery = countQuery.not('last_login_at', 'is', null).or(`last_seen_at.lte.${thirtyDaysAgo},and(last_seen_at.is.null,last_login_at.lte.${thirtyDaysAgo})`);
    dataQuery = dataQuery.not('last_login_at', 'is', null).or(`last_seen_at.lte.${thirtyDaysAgo},and(last_seen_at.is.null,last_login_at.lte.${thirtyDaysAgo})`);
  }

  const allowedSorts: Record<string, string> = {
    name: 'name',
    created: 'created_at',
    last_login: 'last_seen_at',
    login_count: 'login_count',
  };
  const sortCol = allowedSorts[sort] || 'name';
  const asc = order !== 'desc';

  dataQuery = dataQuery
    .order(sortCol, { ascending: asc, nullsFirst: false })
    .range((page - 1) * limit, page * limit - 1);

  const [{ count: totalCount }, { data: customers, error }] = await Promise.all([
    countQuery,
    dataQuery,
  ]);

  if (error) {
    return NextResponse.json({ error: 'Klanten ophalen mislukt' }, { status: 500 });
  }

  const total = totalCount || 0;

  const enriched = await enrichCustomersWithCounts(
    supabase,
    (customers || []) as Array<Record<string, unknown> & { id: string; password_hash?: string | null }>,
  );

  let kpis = undefined;
  if (page === 1) {
    let kpiBase = supabase.from('customers').select('id, portal_active, password_hash, last_login_at, last_seen_at, login_count, is_active', { count: 'exact' });
    if (admin.role === 'accountmanager') {
      kpiBase = kpiBase.eq('account_manager_id', admin.id);
    }
    const { data: allForKpi } = await kpiBase;
    if (allForKpi) {
      const portalUsers = allForKpi.filter(c => c.portal_active && c.password_hash);
      const active7d = portalUsers.filter(c => {
        const seen = c.last_seen_at ? new Date(c.last_seen_at).getTime() : 0;
        const login = c.last_login_at ? new Date(c.last_login_at).getTime() : 0;
        return Math.max(seen, login) > Date.now() - 7 * 24 * 60 * 60 * 1000;
      });
      const neverLogged = portalUsers.filter(c => !c.last_login_at || !c.login_count);
      const churning = portalUsers.filter(c => {
        if (!c.last_login_at) return false;
        const seen = c.last_seen_at ? new Date(c.last_seen_at).getTime() : 0;
        const login = c.last_login_at ? new Date(c.last_login_at).getTime() : 0;
        return Math.max(seen, login) < Date.now() - 30 * 24 * 60 * 60 * 1000;
      });
      kpis = {
        totalCustomers: allForKpi.length,
        activeCustomers: allForKpi.filter(c => c.is_active).length,
        portalUsers: portalUsers.length,
        active7d: active7d.length,
        neverLoggedIn: neverLogged.length,
        churning: churning.length,
      };
    }
  }

  return NextResponse.json({
    customers: enriched,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
    kpis,
  });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ error: 'Bedrijfsnaam is verplicht' }, { status: 400 });
    }

    const { password, ...rest } = body;

    if (typeof rest.email === 'string') {
      rest.email = rest.email.toLowerCase().trim();
    }

    if (password) {
      rest.password_hash = await bcrypt.hash(password, 12);
      rest.portal_password = password;
    }

    if (admin.role === 'accountmanager' && !rest.account_manager_id) {
      rest.account_manager_id = admin.id;
    }

    const supabase = createServerClient();

    if ('branches' in rest) {
      const validated = await validateCustomerBranchSlugs(
        supabase,
        normalizeCustomerBranchSlugs(rest.branches),
      );
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      rest.branches = validated.slugs;
    } else {
      return NextResponse.json({ error: 'Selecteer minimaal één branche' }, { status: 400 });
    }

    const insertPayload = await sanitizeCustomerWritePayload(supabase, rest);
    const { data, error } = await supabase.from('customers').insert(insertPayload).select().single();

    if (error) {
      return NextResponse.json({ error: 'Klant aanmaken mislukt', details: error.message }, { status: 500 });
    }
    logAudit({ adminId: admin.id, adminName: admin.name, action: 'create_customer', entityType: 'customer', entityId: data.id, details: { name: data.name } });
    return NextResponse.json({ success: true, customer: { ...data, password_hash: undefined } });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { id, password, ...rawUpdates } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });

    // demo_mode kantelt alleen via de Mollie-webhook (eerste betaalde batch) of het registratie-endpoint.
    // Voorkom dat een admin-PUT per ongeluk een demo-portaal ontdoet van zijn demo-status.
    const { demo_mode: _ignoredDemoMode, ...updates } = rawUpdates as Record<string, unknown>;
    void _ignoredDemoMode;

    if (password) {
      updates.password_hash = await bcrypt.hash(password as string, 12);
      updates.portal_password = password;
    }

    if (typeof updates.email === 'string') {
      updates.email = updates.email.toLowerCase().trim();
    }

    const supabase = createServerClient();

    const hasCountryColumn = await customersHaveCountryColumn(supabase);
    const beforeSelect = hasCountryColumn ? 'country, vat_id, branches' : 'vat_id, branches';
    const { data: before } = await supabase
      .from('customers')
      .select(beforeSelect)
      .eq('id', id)
      .maybeSingle<{ country?: string | null; vat_id?: string | null; branches?: string[] | null }>();

    if ('branches' in updates) {
      const validated = await validateCustomerBranchSlugs(
        supabase,
        normalizeCustomerBranchSlugs(updates.branches),
      );
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      updates.branches = validated.slugs;
    }

    const updatePayload = await sanitizeCustomerWritePayload(supabase, updates);
    const { data, error } = await supabase.from('customers').update(updatePayload).eq('id', id).select().single();

    if (error) {
      return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 });
    }

    let branchChangeMeta: Awaited<ReturnType<typeof applyCustomerBranchesChange>> | null = null;
    if ('branches' in updates) {
      const prevBranches = normalizeCustomerBranchSlugs(before?.branches);
      const nextBranches = normalizeCustomerBranchSlugs(data.branches);
      if (branchesChanged(prevBranches, nextBranches)) {
        try {
          branchChangeMeta = await applyCustomerBranchesChange(
            supabase,
            id,
            prevBranches,
            nextBranches,
          );
          logAudit({
            adminId: admin.id,
            adminName: admin.name,
            action: 'customer.branches_updated',
            entityType: 'customer',
            entityId: id,
            details: {
              from: prevBranches,
              to: nextBranches,
              warnings: branchChangeMeta.warnings,
            },
          });
        } catch (e) {
          console.error('[admin/customers PUT] branch sync failed:', e);
        }
      }
    }

    let recalcedInvoices: Awaited<ReturnType<typeof recalcOpenInvoicesForCustomer>> = [];
    // Vergelijk de feitelijke kolomwaarden vóór/na de update om strikte tekst-mismatches
    // (case, whitespace, undefined-vs-null) te omzeilen. Recalc is goedkoop en idempotent.
    const after = data as { country?: string | null; vat_id?: string | null } | null;
    const normCountry = (v: unknown) => {
      const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
      return s === 'BE' ? 'BE' : 'NL';
    };
    const normVatId = (v: unknown) => {
      const s = typeof v === 'string' ? v.trim() : '';
      return s.length > 0 ? s.toUpperCase() : null;
    };
    const countryChanged = hasCountryColumn
      && normCountry(before?.country) !== normCountry(after?.country);
    const vatIdChanged = normVatId(before?.vat_id) !== normVatId(after?.vat_id);
    if (countryChanged || vatIdChanged) {
      try {
        recalcedInvoices = await recalcOpenInvoicesForCustomer(supabase, id);
        if (recalcedInvoices.length > 0) {
          await logAudit({
            adminId: admin.id ?? null,
            adminName: admin.name ?? admin.email ?? null,
            action: 'invoices.recalc_after_customer_country_change',
            entityType: 'customer',
            entityId: id,
            details: {
              count: recalcedInvoices.length,
              invoices: recalcedInvoices,
              changed: { country: countryChanged, vat_id: vatIdChanged },
            },
          });
        }
      } catch (e) {
        console.error('[admin/customers PUT] recalc open invoices failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      customer: { ...data, password_hash: undefined },
      recalced_invoices: recalcedInvoices,
      branch_change: branchChangeMeta,
    });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });

    const supabase = createServerClient();
    const { error } = await supabase.from('customers').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
