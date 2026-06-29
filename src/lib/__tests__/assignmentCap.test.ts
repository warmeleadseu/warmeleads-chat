import { describe, it, expect } from 'vitest';
import {
  MAX_CUSTOMER_ASSIGNMENTS,
  effectiveMaxAssignments,
  recentDistinctCustomerIds,
  canAssignWithinCap,
} from '../assignmentCap';

const now = new Date('2026-06-29T10:00:00Z');
const daysAgo = (d: number) =>
  new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

describe('effectiveMaxAssignments', () => {
  it('default = hard plafond zonder override', () => {
    expect(effectiveMaxAssignments({})).toBe(MAX_CUSTOMER_ASSIGNMENTS);
    expect(effectiveMaxAssignments({ custom_fields: null })).toBe(MAX_CUSTOMER_ASSIGNMENTS);
    expect(effectiveMaxAssignments({ custom_fields: {} })).toBe(MAX_CUSTOMER_ASSIGNMENTS);
  });

  it('verlaagt via custom_fields (number én string)', () => {
    expect(effectiveMaxAssignments({ custom_fields: { max_customer_assignments: 1 } })).toBe(1);
    expect(effectiveMaxAssignments({ custom_fields: { max_customer_assignments: '2' } })).toBe(2);
  });

  it('clampt nooit boven het harde plafond en nooit onder 1', () => {
    expect(effectiveMaxAssignments({ custom_fields: { max_customer_assignments: 9 } })).toBe(3);
    expect(effectiveMaxAssignments({ custom_fields: { max_customer_assignments: 0 } })).toBe(3);
    expect(effectiveMaxAssignments({ custom_fields: { max_customer_assignments: -5 } })).toBe(3);
  });
});

describe('recentDistinctCustomerIds', () => {
  it('telt distinct klanten binnen 30 dagen', () => {
    const set = recentDistinctCustomerIds(
      [
        { customer_id: 'a', assigned_at: daysAgo(1) },
        { customer_id: 'a', assigned_at: daysAgo(2) }, // dubbel → 1x
        { customer_id: 'b', assigned_at: daysAgo(5) },
      ],
      now,
    );
    expect(set.size).toBe(2);
  });

  it('negeert toewijzingen ouder dan het venster', () => {
    const set = recentDistinctCustomerIds(
      [
        { customer_id: 'a', assigned_at: daysAgo(1) },
        { customer_id: 'b', assigned_at: daysAgo(45) }, // buiten venster
      ],
      now,
    );
    expect(set.size).toBe(1);
  });

  it('telt toewijzingen zonder datum mee (cap niet omzeilbaar)', () => {
    const set = recentDistinctCustomerIds([{ customer_id: 'a', assigned_at: null }], now);
    expect(set.size).toBe(1);
  });
});

describe('canAssignWithinCap', () => {
  const within = (ids: string[]) =>
    ids.map((id) => ({ customer_id: id, assigned_at: daysAgo(1) }));

  it('blokkeert de 4e klant', () => {
    expect(
      canAssignWithinCap({}, within(['a', 'b', 'c']), 'd', now),
    ).toBe(false);
  });

  it('staat een 3e klant toe', () => {
    expect(canAssignWithinCap({}, within(['a', 'b']), 'c', now)).toBe(true);
  });

  it('telt de kandidaat-klant zelf niet dubbel mee', () => {
    // al 3 klanten, maar kandidaat is er één van → her-toewijzing telt niet als 4e
    expect(canAssignWithinCap({}, within(['a', 'b', 'c']), 'c', now)).toBe(true);
  });

  it('respecteert een verlaagde per-lead cap', () => {
    const lead = { custom_fields: { max_customer_assignments: 1 } };
    expect(canAssignWithinCap(lead, within(['a']), 'b', now)).toBe(false);
    expect(canAssignWithinCap(lead, [], 'a', now)).toBe(true);
  });
});
