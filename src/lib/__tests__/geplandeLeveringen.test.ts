import { describe, it, expect, vi, beforeEach } from 'vitest';

const assignMock = vi.fn();
vi.mock('../assignLeadToBatch', () => ({ assignLeadToBatch: (...a: unknown[]) => assignMock(...a) }));
vi.mock('../email', () => ({ sendLeadNotification: vi.fn() }));
vi.mock('../pushNotification', () => ({ sendNewLeadPush: vi.fn(() => Promise.resolve()) }));

import { verwerkGeplandeLeveringen } from '../geplandeLeveringen';

/**
 * Een geplande levering wordt op het moment van léveren getoetst, niet op het
 * moment van plannen. Tussen inplannen en uitvoeren kan een lead zijn derde
 * klant hebben gekregen; dan mag hij niet alsnog geleverd worden.
 */

type Opzet = {
  rijen?: Record<string, unknown>[];
  lead?: Record<string, unknown> | null;
  klant?: Record<string, unknown> | null;
  bestaandeToewijzingen?: { customer_id: string; assigned_at: string }[];
};

const updates: Record<string, unknown>[] = [];

function maakClient(o: Opzet) {
  const nu = new Date().toISOString();
  const from = (tabel: string) => {
    if (tabel === 'geplande_leadleveringen') {
      return {
        select: () => ({
          eq: () => ({
            lte: () => ({
              order: () => ({ limit: () => Promise.resolve({ data: o.rijen ?? [], error: null }) }),
            }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          updates.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    }
    if (tabel === 'leads') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: o.lead ?? null }) }) }) };
    }
    if (tabel === 'customers') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: o.klant ?? null }) }) }) };
    }
    if (tabel === 'lead_assignments') {
      return {
        select: () => ({
          neq: () => ({
            eq: () => Promise.resolve({
              data: (o.bestaandeToewijzingen ?? []).map(a => ({ ...a, assigned_at: a.assigned_at || nu })),
            }),
          }),
        }),
      };
    }
    throw new Error(`onverwachte tabel ${tabel}`);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any;
}

const RIJ = { id: 'r1', lead_id: 'l1', customer_id: 'k1', batch_id: 'b1', pogingen: 0 };
const LEAD = { id: 'l1', branch: 'thuisbatterij', custom_fields: null };
const KLANT = { id: 'k1', name: 'Partof', email: 'a@b.nl', branches: ['thuisbatterij'], is_active: true, email_notifications: false };

beforeEach(() => { updates.length = 0; assignMock.mockReset(); });

describe('verwerkGeplandeLeveringen', () => {
  it('doet niets als er niets aan de beurt is', async () => {
    const r = await verwerkGeplandeLeveringen(maakClient({ rijen: [] }));
    expect(r).toEqual({ bekeken: 0, geleverd: 0, overgeslagen: 0 });
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('levert een rij die aan de beurt is', async () => {
    assignMock.mockResolvedValue({ ok: true, assignmentId: 'a1', distance_km: 5 });
    const r = await verwerkGeplandeLeveringen(
      maakClient({ rijen: [RIJ], lead: LEAD, klant: KLANT, bestaandeToewijzingen: [{ customer_id: 'k2', assigned_at: '' }] }),
    );
    expect(r).toEqual({ bekeken: 1, geleverd: 1, overgeslagen: 0 });
    expect(updates[0]).toMatchObject({ status: 'geleverd', assignment_id: 'a1' });
  });

  it('slaat over zodra de lead al bij drie klanten staat', async () => {
    const r = await verwerkGeplandeLeveringen(
      maakClient({
        rijen: [RIJ], lead: LEAD, klant: KLANT,
        bestaandeToewijzingen: [
          { customer_id: 'k2', assigned_at: '' },
          { customer_id: 'k3', assigned_at: '' },
          { customer_id: 'k4', assigned_at: '' },
        ],
      }),
    );
    expect(r.geleverd).toBe(0);
    expect(r.overgeslagen).toBe(1);
    expect(assignMock).not.toHaveBeenCalled();
    expect(String(updates[0].laatste_reden)).toContain('plafond bereikt');
  });

  it('slaat over als de klant de lead al heeft', async () => {
    const r = await verwerkGeplandeLeveringen(
      maakClient({ rijen: [RIJ], lead: LEAD, klant: KLANT, bestaandeToewijzingen: [{ customer_id: 'k1', assigned_at: '' }] }),
    );
    expect(r.overgeslagen).toBe(1);
    expect(assignMock).not.toHaveBeenCalled();
    expect(String(updates[0].laatste_reden)).toContain('al aan deze klant');
  });

  it('bewaart de reden wanneer de toewijzing zelf wordt geweigerd', async () => {
    assignMock.mockResolvedValue({ ok: false, code: 'geo_mismatch', reason: 'buiten doelgebied' });
    const r = await verwerkGeplandeLeveringen(maakClient({ rijen: [RIJ], lead: LEAD, klant: KLANT }));
    expect(r.overgeslagen).toBe(1);
    expect(String(updates[0].laatste_reden)).toContain('geo_mismatch');
  });

  it('slaat over bij een inactieve klant', async () => {
    const r = await verwerkGeplandeLeveringen(
      maakClient({ rijen: [RIJ], lead: LEAD, klant: { ...KLANT, is_active: false } }),
    );
    expect(r.overgeslagen).toBe(1);
    expect(assignMock).not.toHaveBeenCalled();
  });
});
