import { describe, expect, it } from 'vitest';
import {
  agentMayAccessAssignment,
  applyPortalAgentAssignmentScope,
  buildPortalAgentLeadScope,
} from '../portalAgentLeadScope';

describe('buildPortalAgentLeadScope', () => {
  it('returns null for view-all / owner', () => {
    expect(
      buildPortalAgentLeadScope({
        portalUserId: 'a1',
        viewAll: true,
        agentsSeeUnassignedLeads: false,
      }),
    ).toBeNull();
  });

  it('defaults seeUnassigned to true', () => {
    const scope = buildPortalAgentLeadScope({
      portalUserId: 'a1',
      viewAll: false,
    });
    expect(scope).toEqual({
      portalUserId: 'a1',
      viewAll: false,
      seeUnassigned: true,
    });
  });

  it('respects agentsSeeUnassignedLeads=false', () => {
    const scope = buildPortalAgentLeadScope({
      portalUserId: 'a1',
      viewAll: false,
      agentsSeeUnassignedLeads: false,
    });
    expect(scope?.seeUnassigned).toBe(false);
  });
});

describe('agentMayAccessAssignment', () => {
  const strict = buildPortalAgentLeadScope({
    portalUserId: 'agent-1',
    viewAll: false,
    agentsSeeUnassignedLeads: false,
  });
  const pool = buildPortalAgentLeadScope({
    portalUserId: 'agent-1',
    viewAll: false,
    agentsSeeUnassignedLeads: true,
  });

  it('strict: only own assignments', () => {
    expect(agentMayAccessAssignment({ portal_user_id: 'agent-1' }, strict)).toBe(true);
    expect(agentMayAccessAssignment({ portal_user_id: null }, strict)).toBe(false);
    expect(agentMayAccessAssignment({ portal_user_id: 'other' }, strict)).toBe(false);
  });

  it('pool: own + unassigned', () => {
    expect(agentMayAccessAssignment({ portal_user_id: 'agent-1' }, pool)).toBe(true);
    expect(agentMayAccessAssignment({ portal_user_id: null }, pool)).toBe(true);
    expect(agentMayAccessAssignment({ portal_user_id: 'other' }, pool)).toBe(false);
  });
});

describe('applyPortalAgentAssignmentScope', () => {
  it('eq portal_user_id when strict', () => {
    const calls: string[] = [];
    const q = {
      or(filter: string) {
        calls.push(`or:${filter}`);
        return this;
      },
      eq(col: string, val: unknown) {
        calls.push(`eq:${col}=${val}`);
        return this;
      },
    };
    applyPortalAgentAssignmentScope(q, {
      portalUserId: 'a1',
      viewAll: false,
      seeUnassigned: false,
    });
    expect(calls).toEqual(['eq:portal_user_id=a1']);
  });

  it('or own+null when pool mode', () => {
    const calls: string[] = [];
    const q = {
      or(filter: string) {
        calls.push(`or:${filter}`);
        return this;
      },
      eq(col: string, val: unknown) {
        calls.push(`eq:${col}=${val}`);
        return this;
      },
    };
    applyPortalAgentAssignmentScope(q, {
      portalUserId: 'a1',
      viewAll: false,
      seeUnassigned: true,
    });
    expect(calls).toEqual(['or:portal_user_id.eq.a1,portal_user_id.is.null']);
  });
});
