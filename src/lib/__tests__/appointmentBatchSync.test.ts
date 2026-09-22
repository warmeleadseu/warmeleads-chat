import { describe, it, expect, vi } from 'vitest';
import { telGeleverdeAfspraken, syncAfsprakenBatch, heeftRuimte } from '../appointmentBatchSync';

/**
 * Regressietests bij een teller die nooit werd opgehoogd.
 *
 * `appointments_delivered` werd alleen gelezen. Zeven batches in productie
 * stonden op 0 van de 10 terwijl er al elf afspraken aan een batch hingen.
 */

function maakClient(opties: {
  afspraken?: { id: string; status: string }[];
  batch?: { id: string; batch_size: number; appointments_delivered: number; status: string } | null;
}) {
  const update = vi.fn((_velden: Record<string, unknown>) => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  const client = {
    from: vi.fn((tabel: string) => {
      if (tabel === 'appointments') {
        return { select: () => ({ eq: () => Promise.resolve({ data: opties.afspraken ?? [], error: null }) }) };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: opties.batch ?? null }) }) }),
        update,
      };
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { client, update };
}

describe('telGeleverdeAfspraken', () => {
  it('telt ingeplande, bezochte en no-show afspraken mee', () => {
    const { client } = maakClient({
      afspraken: [
        { id: '1', status: 'scheduled' },
        { id: '2', status: 'completed' },
        { id: '3', status: 'no_show' },
      ],
    });
    return expect(telGeleverdeAfspraken(client, 'b1')).resolves.toBe(3);
  });

  it('telt een geannuleerde afspraak niet mee', () => {
    /* Die heeft niet plaatsgevonden en mag geen plek uit de batch opsnoepen. */
    const { client } = maakClient({
      afspraken: [{ id: '1', status: 'completed' }, { id: '2', status: 'cancelled' }],
    });
    return expect(telGeleverdeAfspraken(client, 'b1')).resolves.toBe(1);
  });

  it('telt een verzette afspraak niet mee', () => {
    /* Zijn opvolger staat er als aparte rij bij; meetellen zou dubbel tellen. */
    const { client } = maakClient({
      afspraken: [{ id: 'oud', status: 'rescheduled' }, { id: 'nieuw', status: 'scheduled' }],
    });
    return expect(telGeleverdeAfspraken(client, 'b1')).resolves.toBe(1);
  });

  it('geeft nul terug bij een lege batch', () => {
    const { client } = maakClient({ afspraken: [] });
    return expect(telGeleverdeAfspraken(client, 'b1')).resolves.toBe(0);
  });
});

describe('syncAfsprakenBatch', () => {
  it('doet niets zonder batch-id', async () => {
    const { client } = maakClient({});
    await expect(syncAfsprakenBatch(client, null)).resolves.toBeNull();
    await expect(syncAfsprakenBatch(client, undefined)).resolves.toBeNull();
  });

  it('trekt een achterlopende teller gelijk', async () => {
    const { client, update } = maakClient({
      batch: { id: 'b1', batch_size: 10, appointments_delivered: 0, status: 'active' },
      afspraken: [{ id: '1', status: 'scheduled' }, { id: '2', status: 'completed' }],
    });
    const r = await syncAfsprakenBatch(client, 'b1');
    expect(r).toEqual({ geteld: 2, bijgewerkt: true, afgesloten: false });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ appointments_delivered: 2 }));
  });

  it('schrijft niets als de teller al klopt', async () => {
    const { client, update } = maakClient({
      batch: { id: 'b1', batch_size: 10, appointments_delivered: 1, status: 'active' },
      afspraken: [{ id: '1', status: 'scheduled' }],
    });
    const r = await syncAfsprakenBatch(client, 'b1');
    expect(r).toEqual({ geteld: 1, bijgewerkt: false, afgesloten: false });
    expect(update).not.toHaveBeenCalled();
  });

  it('sluit een volle batch', async () => {
    const { client, update } = maakClient({
      batch: { id: 'b1', batch_size: 2, appointments_delivered: 1, status: 'active' },
      afspraken: [{ id: '1', status: 'completed' }, { id: '2', status: 'scheduled' }],
    });
    const r = await syncAfsprakenBatch(client, 'b1');
    expect(r?.afgesloten).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('heropent een afgesloten batch nooit', async () => {
    /* De les uit migratie 158: een afgesloten batch is boekhouding uit het
       verleden en mag niet opnieuw afspraken gaan opnemen. */
    const { client, update } = maakClient({
      batch: { id: 'b1', batch_size: 10, appointments_delivered: 10, status: 'completed' },
      afspraken: [{ id: '1', status: 'scheduled' }],
    });
    const r = await syncAfsprakenBatch(client, 'b1');
    expect(r?.afgesloten).toBe(false);
    const geschreven = update.mock.calls[0][0];
    expect(geschreven.status).toBeUndefined();
  });
});

describe('heeftRuimte', () => {
  it('ziet ruimte in een actieve batch die nog niet vol is', () => {
    expect(heeftRuimte({ batch_size: 10, appointments_delivered: 9, status: 'active' })).toBe(true);
  });

  it('ziet geen ruimte in een volle batch', () => {
    expect(heeftRuimte({ batch_size: 10, appointments_delivered: 10, status: 'active' })).toBe(false);
  });

  it('ziet geen ruimte in een batch die niet actief is', () => {
    for (const status of ['completed', 'paused', 'pending_payment']) {
      expect(heeftRuimte({ batch_size: 10, appointments_delivered: 0, status }), status).toBe(false);
    }
  });

  it('beschouwt een batch zonder grootte als onbeperkt', () => {
    expect(heeftRuimte({ batch_size: 0, appointments_delivered: 99, status: 'active' })).toBe(true);
  });
});
