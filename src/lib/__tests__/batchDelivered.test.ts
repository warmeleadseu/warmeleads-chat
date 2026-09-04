import { describe, it, expect, vi } from 'vitest';
import { countDistinctLeadsForBatch, countDeliveredForBatch } from '../batchDelivered';

/**
 * Regressietests bij het incident van 16 augustus – 4 september 2026.
 *
 * Eén dubbele toewijzingsrij liet twee tellingen uit elkaar lopen: de
 * batchteller telde unieke leads (99), de veiligheidscheck in `distributeLead`
 * telde rijen (100). Bij batch_size 100 was de batch daardoor tegelijk "niet
 * vol" en "vol", won hij bij elke lead de sortering en blokkeerde hij daarna de
 * levering. Deze tests leggen vast dat er nog maar één telling bestaat en dat
 * die altijd unieke leads telt.
 */

type RpcAntwoord = { data: unknown; error: { message: string } | null };

function maakClient(opties: {
  rpc: RpcAntwoord;
  rijen?: { lead_id: string }[];
}) {
  const rpc = vi.fn().mockResolvedValue(opties.rpc);
  const range = vi.fn().mockResolvedValue({ data: opties.rijen ?? [], error: null });
  const eq = vi.fn(() => ({ range }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: { rpc, from } as any, rpc, from };
}

describe('countDistinctLeadsForBatch', () => {
  it('gebruikt de SQL-functie als die werkt', async () => {
    const { client, rpc } = maakClient({ rpc: { data: 99, error: null } });

    await expect(countDistinctLeadsForBatch(client, 'batch-1')).resolves.toBe(99);
    expect(rpc).toHaveBeenCalledWith('count_distinct_leads_for_batch', { p_batch_id: 'batch-1' });
  });

  it('valt bij een RPC-fout terug op unieke leads, niet op het aantal rijen', async () => {
    /* Exact de situatie van 14 augustus: 100 rijen, 99 unieke leads. Zou de
       fallback rijen tellen, dan ontstaat opnieuw de patstelling. */
    const rijen = [
      ...Array.from({ length: 99 }, (_, i) => ({ lead_id: `lead-${i}` })),
      { lead_id: 'lead-0' },
    ];
    const { client } = maakClient({ rpc: { data: null, error: { message: 'rpc weg' } }, rijen });

    await expect(countDistinctLeadsForBatch(client, 'batch-1')).resolves.toBe(99);
  });

  it('negeert een RPC die geen getal teruggeeft', async () => {
    const { client } = maakClient({
      rpc: { data: 'negenennegentig', error: null },
      rijen: [{ lead_id: 'a' }, { lead_id: 'b' }],
    });

    await expect(countDistinctLeadsForBatch(client, 'batch-1')).resolves.toBe(2);
  });
});

describe('countDeliveredForBatch', () => {
  it('telt de externe offset erbij', async () => {
    const { client } = maakClient({ rpc: { data: 40, error: null } });

    await expect(countDeliveredForBatch(client, 'batch-1', 5)).resolves.toBe(45);
  });

  it('behandelt een ontbrekende offset als nul', async () => {
    const { client } = maakClient({ rpc: { data: 40, error: null } });

    await expect(countDeliveredForBatch(client, 'batch-1', null)).resolves.toBe(40);
    await expect(countDeliveredForBatch(client, 'batch-1', undefined)).resolves.toBe(40);
  });
});
