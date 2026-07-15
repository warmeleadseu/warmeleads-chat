/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { isPortalSessionRevoked } from '@/lib/portalSessionVersion';

function mockSupabase(version: number | null, error = false) {
  const chain: Record<string, unknown> = {};
  const maybeSingle = vi.fn().mockResolvedValue(
    error ? { data: null, error: { message: 'db error' } } : { data: version != null ? { version } : null, error: null },
  );
  chain.maybeSingle = maybeSingle;
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  const from = vi.fn().mockReturnValue(chain);
  return { from } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

describe('isPortalSessionRevoked', () => {
  it('returns false for impersonation tokens', async () => {
    const supabase = mockSupabase(9999999999);
    const revoked = await isPortalSessionRevoked(
      supabase,
      { typ: 'owner', sub: 'cust-id', imp: 'admin-id' },
      1000,
    );
    expect(revoked).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns true when token iat is before session version', async () => {
    const supabase = mockSupabase(2000);
    const revoked = await isPortalSessionRevoked(
      supabase,
      { typ: 'owner', sub: 'cust-id' },
      1000,
    );
    expect(revoked).toBe(true);
  });

  it('returns false when token iat is after session version', async () => {
    const supabase = mockSupabase(1000);
    const revoked = await isPortalSessionRevoked(
      supabase,
      { typ: 'portal_user', sub: 'user-id', cid: 'cust-id' },
      2000,
    );
    expect(revoked).toBe(false);
  });

  it('returns false when no version row exists', async () => {
    const supabase = mockSupabase(null);
    const revoked = await isPortalSessionRevoked(
      supabase,
      { typ: 'owner', sub: 'cust-id' },
      1000,
    );
    expect(revoked).toBe(false);
  });
});
