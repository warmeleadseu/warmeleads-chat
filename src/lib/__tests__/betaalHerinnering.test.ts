import { describe, expect, it } from 'vitest';
import { herinnerOverzicht, volgendeHerinnerStap } from '../betaalHerinnering';

const nu = new Date('2026-10-27T09:00:00Z');
const dagenGeleden = (d: number, uur = 0) => new Date(nu.getTime() - d * 86_400_000 - uur * 3_600_000).toISOString();

describe('volgendeHerinnerStap', () => {
  it('nog niets op dag 0 en 1', () => {
    expect(volgendeHerinnerStap({ created_at: dagenGeleden(0) }, nu)).toBeNull();
    expect(volgendeHerinnerStap({ created_at: dagenGeleden(1, 23) }, nu)).toBeNull();
  });
  it('dag 2, 5 en 10 een mail, 14 bellen, 21 verlopen', () => {
    expect(volgendeHerinnerStap({ created_at: dagenGeleden(2) }, nu)).toMatchObject({ stap: 1, soort: 'mail' });
    expect(volgendeHerinnerStap({ created_at: dagenGeleden(5), betaalherinnering_stap: 1 }, nu)).toMatchObject({ stap: 2, soort: 'mail' });
    expect(volgendeHerinnerStap({ created_at: dagenGeleden(10), betaalherinnering_stap: 2 }, nu)).toMatchObject({ stap: 3, soort: 'mail' });
    expect(volgendeHerinnerStap({ created_at: dagenGeleden(14), betaalherinnering_stap: 3 }, nu)).toMatchObject({ stap: 4, soort: 'bellen' });
    expect(volgendeHerinnerStap({ created_at: dagenGeleden(21), betaalherinnering_stap: 4 }, nu)).toMatchObject({ stap: 5, soort: 'verlopen' });
  });
  it('een gedane stap komt niet nog eens', () => {
    expect(volgendeHerinnerStap({ created_at: dagenGeleden(3), betaalherinnering_stap: 1 }, nu)).toBeNull();
    expect(volgendeHerinnerStap({ created_at: dagenGeleden(30), betaalherinnering_stap: 5 }, nu)).toBeNull();
  });
  it('wie laat meedoet krijgt alleen de hoogste verstreken stap, geen stapel mails', () => {
    expect(volgendeHerinnerStap({ created_at: dagenGeleden(11) }, nu)).toMatchObject({ stap: 3 });
  });
  it('na terugzetten telt de reeks vanaf herinnering_vanaf', () => {
    const b = { created_at: dagenGeleden(60), herinnering_vanaf: dagenGeleden(1), betaalherinnering_stap: 0 };
    expect(volgendeHerinnerStap(b, nu)).toBeNull();
    expect(volgendeHerinnerStap({ ...b, herinnering_vanaf: dagenGeleden(2) }, nu)).toMatchObject({ stap: 1 });
  });
});

describe('herinnerOverzicht', () => {
  it('toont wat gedaan is en wanneer de volgende stap komt', () => {
    const o = herinnerOverzicht({ created_at: '2026-10-01T10:00:00Z', betaalherinnering_stap: 2 });
    expect(o.gedaan?.stap).toBe(2);
    expect(o.volgende?.stap).toBe(3);
    expect(o.volgende?.op.toISOString()).toBe('2026-10-11T10:00:00.000Z');
  });
  it('na de laatste stap geen volgende', () => {
    expect(herinnerOverzicht({ created_at: '2026-10-01T10:00:00Z', betaalherinnering_stap: 5 }).volgende).toBeNull();
  });
});
