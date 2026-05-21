import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Smoke tests voor /api/admin/customers/options.
 *
 * Doel: bewijzen dat de endpoint
 *   1) álle klanten teruggeeft (geen DEFAULT_LIMIT=25 zoals het oude
 *      /api/admin/customers endpoint),
 *   2) alleen toegestane velden in de SELECT meeneemt,
 *   3) accountmanagers correct scoped op `account_manager_id`,
 *   4) de optionele `active=1` filter respecteert,
 *   5) bij ontbrekende `country` kolom (oude omgevingen) gracieus terugvalt.
 */

vi.mock('@/lib/adminAuth', () => ({
  verifyAdmin: vi.fn(),
  unauthorized: vi.fn(() => new Response(JSON.stringify({ error: 'Geen toegang' }), { status: 401 })),
}));

vi.mock('@/lib/customerCountrySupport', () => ({
  customersHaveCountryColumn: vi.fn(),
}));

interface QueryState {
  select?: string;
  filters: Array<{ op: string; args: unknown[] }>;
  orderBy?: { col: string; opts: unknown };
  limit?: number;
}

const captured: { lastQuery: QueryState | null } = { lastQuery: null };

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from(table: string) {
      if (table !== 'customers') throw new Error(`Unexpected table: ${table}`);
      const state: QueryState = { filters: [] };
      const builder: Record<string, unknown> = {};
      const passthrough = <K extends string>(key: K) => (...args: unknown[]) => {
        if (key === 'select') state.select = String(args[0]);
        else if (key === 'order') state.orderBy = { col: String(args[0]), opts: args[1] };
        else if (key === 'limit') state.limit = Number(args[0]);
        else state.filters.push({ op: key, args });
        return builder;
      };
      builder.select = passthrough('select');
      builder.order = passthrough('order');
      builder.limit = passthrough('limit');
      builder.eq = passthrough('eq');
      builder.or = passthrough('or');
      builder.then = (resolve: (v: { data: unknown; error: unknown }) => void) => {
        captured.lastQuery = state;
        return Promise.resolve(resolve({
          data: [
            { id: '1', name: 'Aanhuis Isolatie', is_active: true, account_manager_id: 'am-1' },
            { id: '2', name: 'ZPN Groep', is_active: true, account_manager_id: 'am-2' },
          ],
          error: null,
        }));
      };
      return builder;
    },
  }),
}));

import { GET } from '../route';
import { verifyAdmin } from '@/lib/adminAuth';
import { customersHaveCountryColumn } from '@/lib/customerCountrySupport';

const verifyAdminMock = vi.mocked(verifyAdmin);
const customersHaveCountryColumnMock = vi.mocked(customersHaveCountryColumn);

function buildRequest(qs = ''): Parameters<typeof GET>[0] {
  const url = `http://localhost/api/admin/customers/options${qs}`;
  // Het Next.js NextRequest type heeft een `nextUrl` met searchParams.
  return {
    nextUrl: new URL(url),
  } as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/admin/customers/options', () => {
  beforeEach(() => {
    captured.lastQuery = null;
    verifyAdminMock.mockReset();
    customersHaveCountryColumnMock.mockReset();
  });

  it('weigert niet-geauthenticeerde requests met 401', async () => {
    verifyAdminMock.mockResolvedValue(null);
    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
  });

  it('retourneert alle klanten zonder pagination (geen .range)', async () => {
    verifyAdminMock.mockResolvedValue({ id: 'su', role: 'superadmin', name: 'Super', email: 'a' } as never);
    customersHaveCountryColumnMock.mockResolvedValue(true);
    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.customers)).toBe(true);
    expect(json.customers).toHaveLength(2);
    expect(captured.lastQuery?.limit).toBeGreaterThanOrEqual(1000);
    // Sorteert alfabetisch op `name`.
    expect(captured.lastQuery?.orderBy?.col).toBe('name');
  });

  it('selecteert vat_id + country als de country-kolom bestaat', async () => {
    verifyAdminMock.mockResolvedValue({ id: 'su', role: 'superadmin', name: 'Super', email: 'a' } as never);
    customersHaveCountryColumnMock.mockResolvedValue(true);
    await GET(buildRequest());
    expect(captured.lastQuery?.select).toContain('country');
    expect(captured.lastQuery?.select).toContain('vat_id');
    expect(captured.lastQuery?.select).toContain('email');
  });

  it('laat country uit de SELECT wanneer de kolom (nog) niet bestaat', async () => {
    verifyAdminMock.mockResolvedValue({ id: 'su', role: 'superadmin', name: 'Super', email: 'a' } as never);
    customersHaveCountryColumnMock.mockResolvedValue(false);
    await GET(buildRequest());
    expect(captured.lastQuery?.select).not.toContain('country');
    expect(captured.lastQuery?.select).toContain('vat_id');
  });

  it('scoped automatisch op account_manager_id voor AM-rol', async () => {
    verifyAdminMock.mockResolvedValue({ id: 'am-42', role: 'accountmanager', name: 'L', email: 'l' } as never);
    customersHaveCountryColumnMock.mockResolvedValue(true);
    await GET(buildRequest());
    const eqFilters = captured.lastQuery?.filters.filter(f => f.op === 'eq') || [];
    expect(eqFilters.some(f => f.args[0] === 'account_manager_id' && f.args[1] === 'am-42')).toBe(true);
  });

  it('past is_active=true filter toe bij ?active=1', async () => {
    verifyAdminMock.mockResolvedValue({ id: 'su', role: 'superadmin', name: 'Super', email: 'a' } as never);
    customersHaveCountryColumnMock.mockResolvedValue(true);
    await GET(buildRequest('?active=1'));
    const eqFilters = captured.lastQuery?.filters.filter(f => f.op === 'eq') || [];
    expect(eqFilters.some(f => f.args[0] === 'is_active' && f.args[1] === true)).toBe(true);
  });

  it('past géén active filter toe wanneer ?active ontbreekt', async () => {
    verifyAdminMock.mockResolvedValue({ id: 'su', role: 'superadmin', name: 'Super', email: 'a' } as never);
    customersHaveCountryColumnMock.mockResolvedValue(true);
    await GET(buildRequest());
    const eqFilters = captured.lastQuery?.filters.filter(f => f.op === 'eq') || [];
    expect(eqFilters.some(f => f.args[0] === 'is_active')).toBe(false);
  });

  it('past .or() toe op name/contact_person/email bij ?search', async () => {
    verifyAdminMock.mockResolvedValue({ id: 'su', role: 'superadmin', name: 'Super', email: 'a' } as never);
    customersHaveCountryColumnMock.mockResolvedValue(true);
    await GET(buildRequest('?search=acme'));
    const orFilters = captured.lastQuery?.filters.filter(f => f.op === 'or') || [];
    expect(orFilters).toHaveLength(1);
    const orClause = String(orFilters[0].args[0]);
    expect(orClause).toContain('name.ilike.%acme%');
    expect(orClause).toContain('email.ilike.%acme%');
  });
});
