/**
 * Unit tests voor de reclamatie-helpers die in alle CPL-berekeningen
 * (admin/costs, live-stats, AI Studio tree, optimizer) worden gebruikt.
 *
 * We testen vooral de pure functies:
 *  - `reclamationPairKey` is deterministisch en collision-safe.
 *  - `netEffectiveCpl` rondt en handelt edge cases af.
 *  - `countApprovedReclamationsForAssignments` matched correct op
 *    (lead_id, customer_id) en dedupliceert.
 *
 * De Supabase-query in `getApprovedReclamationStats` testen we niet hier;
 * dat doet de integratietest tegen een echte DB.
 */
import { describe, it, expect } from 'vitest';
import {
  reclamationPairKey,
  netEffectiveCpl,
  countApprovedReclamationsForAssignments,
} from '@/lib/reclamationStats';

describe('reclamationPairKey', () => {
  it('produceert deterministische sleutels', () => {
    expect(reclamationPairKey('lead-1', 'cust-1')).toBe('lead-1::cust-1');
  });

  it('vermijdt collisions tussen lead- en customer-IDs', () => {
    // Zonder separator zou 'a:b' en 'a:bc' kunnen botsen via concat.
    const a = reclamationPairKey('lead-1', 'cust-1');
    const b = reclamationPairKey('lead-1c', 'ust-1');
    expect(a).not.toBe(b);
  });
});

describe('netEffectiveCpl', () => {
  it('berekent eff. CPL met aftrek van goedgekeurde reclamaties', () => {
    expect(netEffectiveCpl(100, 10, 0)).toBe(10);
    expect(netEffectiveCpl(100, 10, 2)).toBe(100 / 8);
  });

  it('retourneert null als alle leveringen gereclameerd zijn', () => {
    expect(netEffectiveCpl(100, 5, 5)).toBeNull();
  });

  it('retourneert null bij meer reclamaties dan leveringen (pathologisch)', () => {
    expect(netEffectiveCpl(100, 3, 10)).toBeNull();
  });

  it('retourneert null bij 0 leveringen', () => {
    expect(netEffectiveCpl(50, 0, 0)).toBeNull();
  });
});

describe('countApprovedReclamationsForAssignments', () => {
  type Row = { lead_id: string; customer_id: string; branch?: string };

  it('telt een match op (lead_id, customer_id)', () => {
    const assignments: Row[] = [
      { lead_id: 'l1', customer_id: 'c1' },
      { lead_id: 'l2', customer_id: 'c2' },
      { lead_id: 'l3', customer_id: 'c3' },
    ];
    const approved = new Set([reclamationPairKey('l2', 'c2')]);
    const res = countApprovedReclamationsForAssignments(assignments, approved);
    expect(res.total).toBe(1);
    expect(res.pairKeys.has('l2::c2')).toBe(true);
  });

  it('dedupliceert dubbele assignments voor hetzelfde paar', () => {
    // Pathologisch maar mogelijk: dezelfde lead+customer toegewezen via 2
    // rijen. Eén goedgekeurde reclamatie moet maar 1× worden afgetrokken.
    const assignments: Row[] = [
      { lead_id: 'l1', customer_id: 'c1' },
      { lead_id: 'l1', customer_id: 'c1' },
    ];
    const approved = new Set([reclamationPairKey('l1', 'c1')]);
    const res = countApprovedReclamationsForAssignments(assignments, approved);
    expect(res.total).toBe(1);
  });

  it('telt niet als de lead aan een andere klant is toegewezen', () => {
    // Lead L is aan klant A en B toegewezen. Klant A reclameert succesvol.
    // Klant B's levering moet wél meetellen.
    const assignments: Row[] = [
      { lead_id: 'l1', customer_id: 'cust-a' },
      { lead_id: 'l1', customer_id: 'cust-b' },
    ];
    const approved = new Set([reclamationPairKey('l1', 'cust-a')]);
    const res = countApprovedReclamationsForAssignments(assignments, approved);
    expect(res.total).toBe(1);
    expect(res.pairKeys.has('l1::cust-a')).toBe(true);
    expect(res.pairKeys.has('l1::cust-b')).toBe(false);
  });

  it('aggregeert per branche als branchOfAssignment is meegegeven', () => {
    const assignments: Row[] = [
      { lead_id: 'l1', customer_id: 'c1', branch: 'thuisbatterij' },
      { lead_id: 'l2', customer_id: 'c2', branch: 'airco' },
      { lead_id: 'l3', customer_id: 'c3', branch: 'thuisbatterij' },
    ];
    const approved = new Set([
      reclamationPairKey('l1', 'c1'),
      reclamationPairKey('l3', 'c3'),
    ]);
    const res = countApprovedReclamationsForAssignments(
      assignments,
      approved,
      a => a.branch ?? null,
    );
    expect(res.total).toBe(2);
    expect(res.byBranch.get('thuisbatterij')).toBe(2);
    expect(res.byBranch.get('airco')).toBeUndefined();
  });

  it('retourneert 0 bij lege approved-set', () => {
    const assignments: Row[] = [
      { lead_id: 'l1', customer_id: 'c1' },
    ];
    const res = countApprovedReclamationsForAssignments(assignments, new Set());
    expect(res.total).toBe(0);
    expect(res.pairKeys.size).toBe(0);
  });
});
