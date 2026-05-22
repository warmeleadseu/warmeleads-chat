import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/teamleader/integrationRepo', () => ({
  getTeamleaderIntegration: vi.fn(),
  ensureValidAccessToken: vi.fn(),
  resolvePhaseIdForPipeline: vi.fn(),
}));

vi.mock('@/lib/teamleader/contacts', () => ({
  findOrCreateContact: vi.fn(),
}));

vi.mock('@/lib/teamleader/deals', () => ({
  createDeal: vi.fn(),
}));

vi.mock('@/lib/teamleader/customFieldDefinitions', () => ({
  listCustomFieldDefinitions: vi.fn().mockResolvedValue([]),
}));

import { createServerClient } from '@/lib/supabase';
import {
  getTeamleaderIntegration,
  ensureValidAccessToken,
  resolvePhaseIdForPipeline,
} from '@/lib/teamleader/integrationRepo';
import { findOrCreateContact } from '@/lib/teamleader/contacts';
import { createDeal } from '@/lib/teamleader/deals';
import { syncAssignmentToTeamleader } from '@/lib/teamleader/syncAssignment';

function mockSupabase(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
    update: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return {
    from: vi.fn(() => chain),
    _chain: chain,
  };
}

describe('syncAssignmentToTeamleader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips when no integration', async () => {
    const sb = mockSupabase();
    vi.mocked(createServerClient).mockReturnValue(sb as never);
    vi.mocked(getTeamleaderIntegration).mockResolvedValue(null);

    await syncAssignmentToTeamleader({
      customerId: 'cust-1',
      leadId: 'lead-1',
      assignmentId: 'as-1',
    });

    expect(findOrCreateContact).not.toHaveBeenCalled();
  });

  it('skips demo leads', async () => {
    const sb = mockSupabase();
    const chain = sb._chain;
    vi.mocked(createServerClient).mockReturnValue(sb as never);
    vi.mocked(getTeamleaderIntegration).mockResolvedValue({
      id: 'int-1',
      customer_id: 'cust-1',
      access_token: 'tok',
      refresh_token: 'ref',
      expires_at: new Date(Date.now() + 3600_000),
      settings: { enabled: true, pipeline_id: 'pipe-1', phase_id: 'phase-1' },
      connected_at: new Date().toISOString(),
    });

    chain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'as-1', customer_id: 'cust-1', lead_id: 'lead-1' },
      })
      .mockResolvedValueOnce({ data: null });
    chain.single.mockResolvedValue({
      data: { id: 'lead-1', bron: 'demo', naam_klant: 'Demo', branch: 'test' },
    });

    await syncAssignmentToTeamleader({
      customerId: 'cust-1',
      leadId: 'lead-1',
      assignmentId: 'as-1',
    });

    expect(findOrCreateContact).not.toHaveBeenCalled();
  });

  it('syncs contact and deal on happy path', async () => {
    const sb = mockSupabase();
    const chain = sb._chain;
    vi.mocked(createServerClient).mockReturnValue(sb as never);
    vi.mocked(getTeamleaderIntegration).mockResolvedValue({
      id: 'int-1',
      customer_id: 'cust-1',
      access_token: 'tok',
      refresh_token: 'ref',
      expires_at: new Date(Date.now() + 3600_000),
      settings: { enabled: true, pipeline_id: 'pipe-1', phase_id: 'phase-1' },
      connected_at: new Date().toISOString(),
    });
    vi.mocked(ensureValidAccessToken).mockResolvedValue('access-tok');
    vi.mocked(resolvePhaseIdForPipeline).mockResolvedValue('phase-1');
    vi.mocked(findOrCreateContact).mockResolvedValue('contact-99');
    vi.mocked(createDeal).mockResolvedValue('deal-88');

    chain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'as-1', customer_id: 'cust-1', lead_id: 'lead-1' },
      })
      .mockResolvedValueOnce({ data: null });
    chain.single.mockResolvedValue({
      data: {
        id: 'lead-1',
        bron: 'meta',
        naam_klant: 'Jan Jansen',
        email: 'jan@test.nl',
        branch: 'zonnepanelen',
      },
    });
    chain.insert.mockResolvedValue({ error: null });
    const branchesChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'br-1', name: 'Zonnepanelen' } }),
    };
    const branchFieldsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
    };
    vi.mocked(sb.from).mockImplementation(((table: string) => {
      if (table === 'branches') return branchesChain;
      if (table === 'branch_fields') return branchFieldsChain;
      return chain;
    }) as typeof sb.from);

    await syncAssignmentToTeamleader({
      customerId: 'cust-1',
      leadId: 'lead-1',
      assignmentId: 'as-1',
    });

    expect(findOrCreateContact).toHaveBeenCalledWith(
      'access-tok',
      expect.objectContaining({ email: 'jan@test.nl' }),
      [],
    );
    expect(createDeal).toHaveBeenCalledWith(
      'access-tok',
      expect.objectContaining({ contactId: 'contact-99', phaseId: 'phase-1' }),
    );
  });
});
