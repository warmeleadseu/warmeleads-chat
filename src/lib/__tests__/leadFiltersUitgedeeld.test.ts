import { describe, expect, it } from 'vitest';
import { applyLeadFilters } from '../leadFilters';
import { MASTER_PORTAL_MIRROR_BY_BRANCH } from '../masterPortalMirror';

/** Nep-query die vastlegt welke filters erop komen. */
function nepQuery() {
  const stappen: [string, unknown[]][] = [];
  const q: Record<string, unknown> = {};
  for (const m of ['eq', 'in', 'not', 'or', 'gte', 'lte', 'ilike', 'overlaps', 'containedBy', 'neq', 'is']) {
    q[m] = (...args: unknown[]) => { stappen.push([m, args]); return q; };
  }
  return { q, stappen };
}

const spiegel = Object.values(MASTER_PORTAL_MIRROR_BY_BRANCH);

describe('Leads CRM: uitgedeeld negeert de spiegelkopie naar het masterportaal', () => {
  it('niet uitgedeeld: geen andere klant dan het masterportaal', () => {
    const { q, stappen } = nepQuery();
    applyLeadFilters(q as never, { assignment: 'unassigned' } as never);
    expect(stappen).toContainEqual(['containedBy', ['assigned_customer_ids', spiegel]]);
  });
  it('uitgedeeld: minstens één andere klant', () => {
    const { q, stappen } = nepQuery();
    applyLeadFilters(q as never, { assignment: 'assigned' } as never);
    expect(stappen).toContainEqual(['not', ['assigned_customer_ids', 'cd', `{${spiegel.join(',')}}`]]);
  });
});
