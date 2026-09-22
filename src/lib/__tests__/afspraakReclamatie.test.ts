import { describe, it, expect } from 'vitest';
import {
  magReclameren,
  isGeldigeReden,
  redenLabel,
  AFSPRAAK_RECLAMATIE_REDENEN,
  RECLAMATIE_TERMIJN_DAGEN,
} from '../afspraakReclamatie';

const NU = new Date('2026-09-22T12:00:00.000Z');
const gisteren = '2026-09-21T10:00:00.000Z';
const morgen = '2026-09-23T10:00:00.000Z';
const langGeleden = '2026-08-01T10:00:00.000Z';

describe('magReclameren', () => {
  it('mag op een afspraak die net is geweest', () => {
    expect(magReclameren({ starts_at: gisteren, status: 'no_show' }, null, NU)).toEqual({ mag: true });
    expect(magReclameren({ starts_at: gisteren, status: 'completed' }, null, NU)).toEqual({ mag: true });
  });

  it('mag niet vooraf', () => {
    const r = magReclameren({ starts_at: morgen, status: 'scheduled' }, null, NU);
    expect(r.mag).toBe(false);
    expect(r.mag === false && r.reden).toContain('moet nog plaatsvinden');
  });

  it('mag niet buiten de termijn', () => {
    const r = magReclameren({ starts_at: langGeleden, status: 'no_show' }, null, NU);
    expect(r.mag).toBe(false);
    expect(r.mag === false && r.reden).toContain(String(RECLAMATIE_TERMIJN_DAGEN));
  });

  it('mag precies op de grens van de termijn nog wel', () => {
    const grens = new Date(NU.getTime() - RECLAMATIE_TERMIJN_DAGEN * 86_400_000).toISOString();
    expect(magReclameren({ starts_at: grens, status: 'no_show' }, null, NU).mag).toBe(true);
  });

  it('mag niet op een geannuleerde afspraak', () => {
    /* Die telt ook niet mee als geleverd, dus er valt niets te compenseren. */
    const r = magReclameren({ starts_at: gisteren, status: 'cancelled' }, null, NU);
    expect(r.mag).toBe(false);
  });

  it('verwijst bij een verzette afspraak naar de opvolger', () => {
    const r = magReclameren({ starts_at: gisteren, status: 'rescheduled' }, null, NU);
    expect(r.mag === false && r.reden).toContain('nieuwe afspraak');
  });

  it('staat geen tweede reclamatie op dezelfde afspraak toe', () => {
    /* Anders kan één afspraak twee keer gecompenseerd worden. */
    const r = magReclameren({ starts_at: gisteren, status: 'no_show' }, { id: 'r1', status: 'pending' }, NU);
    expect(r.mag).toBe(false);
    expect(r.mag === false && r.reden).toContain('al een reclamatie');
  });

  it('noemt de uitkomst als er al beoordeeld is', () => {
    const r = magReclameren({ starts_at: gisteren, status: 'no_show' }, { id: 'r1', status: 'approved' }, NU);
    expect(r.mag === false && r.reden).toContain('Goedgekeurd');
  });

  it('valt niet over een onleesbare datum', () => {
    expect(magReclameren({ starts_at: 'onzin', status: 'no_show' }, null, NU).mag).toBe(false);
  });
});

describe('redenen', () => {
  it('accepteert alleen bekende redenen', () => {
    for (const r of AFSPRAAK_RECLAMATIE_REDENEN) expect(isGeldigeReden(r.value)).toBe(true);
    expect(isGeldigeReden('verzonnen')).toBe(false);
    expect(isGeldigeReden(null)).toBe(false);
  });

  it('geeft een leesbaar label en valt terug op de ruwe waarde', () => {
    expect(redenLabel('niet_verschenen')).toBe('Klant was niet thuis');
    expect(redenLabel('onbekend')).toBe('onbekend');
  });
});
