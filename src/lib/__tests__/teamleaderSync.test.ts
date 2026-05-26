import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/teamleader/integrationRepo', () => ({
  getTeamleaderIntegration: vi.fn(),
  ensureValidAccessToken: vi.fn(),
  resolvePhaseIdForPipeline: vi.fn(),
}));

vi.mock('@/lib/teamleader/syncLeadRecord', () => ({
  syncLeadRecordToTeamleader: vi.fn(),
}));

import { createServerClient } from '@/lib/supabase';
import {
  getTeamleaderIntegration,
  ensureValidAccessToken,
  resolvePhaseIdForPipeline,
} from '@/lib/teamleader/integrationRepo';
import { syncLeadRecordToTeamleader } from '@/lib/teamleader/syncLeadRecord';
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

    expect(syncLeadRecordToTeamleader).not.toHaveBeenCalled();
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

    expect(syncLeadRecordToTeamleader).not.toHaveBeenCalled();
  });

  it('syncs via shared lead record helper on happy path', async () => {
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
    vi.mocked(syncLeadRecordToTeamleader).mockResolvedValue({
      contactId: 'contact-99',
      dealId: 'deal-88',
      branchSlug: 'zonnepanelen',
      branchName: 'Zonnepanelen',
    });

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

    await syncAssignmentToTeamleader({
      customerId: 'cust-1',
      leadId: 'lead-1',
      assignmentId: 'as-1',
    });

    expect(syncLeadRecordToTeamleader).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'access-tok',
        phaseId: 'phase-1',
        lead: expect.objectContaining({ email: 'jan@test.nl' }),
        assignmentId: 'as-1',
        leadId: 'lead-1',
      }),
    );
  });
});
