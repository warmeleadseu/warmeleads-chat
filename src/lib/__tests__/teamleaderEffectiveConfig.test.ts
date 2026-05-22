/**
 * @vitest-environment node
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@/lib/supabase';
import {
  encryptSecret,
} from '@/lib/integrations/tokenEncrypt';
import {
  getCustomerOAuthConfig,
  getEffectiveOAuthConfig,
  getGlobalOAuthConfig,
  saveCustomerOAuthCredentials,
} from '@/lib/teamleader/credentials';

const previousEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  process.env.APP_SESSION_SECRET = 'test-session-secret-min-32-chars!!';
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY =
    'unit-test-integration-encryption-key-32!';
});

beforeEach(() => {
  for (const k of ['TEAMLEADER_CLIENT_ID', 'TEAMLEADER_CLIENT_SECRET', 'TEAMLEADER_REDIRECT_URI'] as const) {
    previousEnv[k] = process.env[k];
    delete process.env[k];
  }
  vi.clearAllMocks();
});

afterEach(() => {
  for (const [k, v] of Object.entries(previousEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function buildSupabaseMock(opts: {
  customerCreds?: { client_id_enc: string | null; client_secret_enc: string | null } | null;
  appSettings?: { key: string; value: string }[];
  upsertSpy?: ReturnType<typeof vi.fn>;
}) {
  const customerChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: opts.customerCreds ?? null }),
  };
  const settingsChain = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: opts.appSettings ?? [] }),
  };
  const customerUpsert = {
    upsert: opts.upsertSpy ?? vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    from: vi.fn((table: string) => {
      if (table === 'customer_integrations') {
        return { ...customerChain, ...customerUpsert };
      }
      if (table === 'app_settings') return settingsChain;
      throw new Error(`Unexpected table ${table}`);
    }),
  } as unknown as Parameters<typeof getEffectiveOAuthConfig>[0];
}

describe('getEffectiveOAuthConfig', () => {
  it('returns customer config when client credentials are stored', async () => {
    const sb = buildSupabaseMock({
      customerCreds: {
        client_id_enc: encryptSecret('cust-id'),
        client_secret_enc: encryptSecret('cust-secret'),
      },
    });
    const cfg = await getEffectiveOAuthConfig(sb, 'cust-1');
    expect(cfg).toEqual({
      clientId: 'cust-id',
      clientSecret: 'cust-secret',
      redirectUri: expect.stringContaining('/api/portal/integrations/teamleader/callback'),
      source: 'customer',
    });
  });

  it('falls back to env when customer has no credentials', async () => {
    process.env.TEAMLEADER_CLIENT_ID = 'env-id';
    process.env.TEAMLEADER_CLIENT_SECRET = 'env-secret';
    const sb = buildSupabaseMock({ customerCreds: null });
    vi.mocked(createServerClient).mockReturnValue(sb as never);
    const cfg = await getEffectiveOAuthConfig(sb, 'cust-1');
    expect(cfg?.source).toBe('global');
    expect(cfg?.clientId).toBe('env-id');
  });

  it('falls back to app_settings when env is empty', async () => {
    const sb = buildSupabaseMock({
      customerCreds: null,
      appSettings: [
        { key: 'teamleader_client_id', value: 'admin-id' },
        { key: 'teamleader_client_secret', value: 'admin-secret' },
      ],
    });
    vi.mocked(createServerClient).mockReturnValue(sb as never);
    const cfg = await getEffectiveOAuthConfig(sb, 'cust-1');
    expect(cfg?.source).toBe('global');
    expect(cfg?.clientId).toBe('admin-id');
  });

  it('returns null when nothing is configured anywhere', async () => {
    const sb = buildSupabaseMock({ customerCreds: null, appSettings: [] });
    vi.mocked(createServerClient).mockReturnValue(sb as never);
    expect(await getEffectiveOAuthConfig(sb, 'cust-1')).toBeNull();
  });
});

describe('getGlobalOAuthConfig', () => {
  it('strips newlines from env values', async () => {
    process.env.TEAMLEADER_CLIENT_ID = 'env-id\n';
    process.env.TEAMLEADER_CLIENT_SECRET = ' env-secret\r\n';
    const sb = buildSupabaseMock({});
    vi.mocked(createServerClient).mockReturnValue(sb as never);
    const cfg = await getGlobalOAuthConfig();
    expect(cfg?.clientId).toBe('env-id');
    expect(cfg?.clientSecret).toBe('env-secret');
  });
});

describe('getCustomerOAuthConfig', () => {
  it('returns null when row has no credentials', async () => {
    const sb = buildSupabaseMock({
      customerCreds: { client_id_enc: null, client_secret_enc: null },
    });
    expect(await getCustomerOAuthConfig(sb, 'cust-1')).toBeNull();
  });
});

describe('saveCustomerOAuthCredentials', () => {
  it('rejects empty values', async () => {
    const sb = buildSupabaseMock({});
    await expect(
      saveCustomerOAuthCredentials(sb, 'cust-1', { clientId: '', clientSecret: 'secret' }),
    ).rejects.toThrow(/Client ID/);
  });

  it('stores encrypted values on success', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const sb = buildSupabaseMock({ upsertSpy: upsert });
    await saveCustomerOAuthCredentials(sb, 'cust-1', {
      clientId: 'plaintext-id\n',
      clientSecret: 'plaintext-secret\r',
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    const payload = upsert.mock.calls[0][0];
    expect(payload.customer_id).toBe('cust-1');
    expect(payload.client_id_enc).not.toBe('plaintext-id');
    expect(payload.client_secret_enc).not.toBe('plaintext-secret');
  });
});
