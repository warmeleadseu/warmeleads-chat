/**
 * Unit tests voor de credentials-lookup.
 *
 * Belangrijke gedragingen:
 *  - Env-var heeft voorrang boven `app_settings`.
 *  - Whitespace wordt getrimd.
 *  - 5-min cache zorgt dat we niet per request de DB raken.
 *  - `getProviderCapabilities` rapporteert correct welke providers
 *    bruikbaar zijn.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase voordat we credentials.ts laden, anders importeert die
// de echte client met env-vars.
vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
    }),
  }),
}));

describe('credentials · env-vars hebben voorrang', () => {
  beforeEach(async () => {
    vi.resetModules();
    delete process.env.REPLICATE_API_TOKEN;
    delete process.env.PEXELS_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('retourneert null wanneer noch env noch app_settings is gezet', async () => {
    const mod = await import('@/lib/imageProviders/credentials');
    mod.__resetCredentialsCache();
    expect(await mod.getReplicateToken()).toBeNull();
    expect(await mod.getPexelsKey()).toBeNull();
  });

  it('leest Replicate-token uit env', async () => {
    process.env.REPLICATE_API_TOKEN = 'r8_test_token  ';
    const mod = await import('@/lib/imageProviders/credentials');
    mod.__resetCredentialsCache();
    expect(await mod.getReplicateToken()).toBe('r8_test_token');
  });

  it('leest Pexels-key uit env en trimt whitespace', async () => {
    process.env.PEXELS_API_KEY = '\tabc123\n';
    const mod = await import('@/lib/imageProviders/credentials');
    mod.__resetCredentialsCache();
    expect(await mod.getPexelsKey()).toBe('abc123');
  });

  it('getProviderCapabilities reflecteert beschikbaarheid', async () => {
    process.env.REPLICATE_API_TOKEN = 'r8_x';
    process.env.OPENAI_API_KEY = 'sk-x';
    const mod = await import('@/lib/imageProviders/credentials');
    mod.__resetCredentialsCache();
    const caps = await mod.getProviderCapabilities();
    expect(caps).toEqual({ openai: true, replicate: true, pexels: false });
  });
});
