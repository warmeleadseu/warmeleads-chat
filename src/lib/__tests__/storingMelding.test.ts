import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), EMAIL_BASE_URL: 'https://www.warmeleads.eu' }));

import { bepaalStoringen, bouwStoringMail, providerLabel, storingSleutel, type FoutRij } from '../integrations/storingMelding';

const NU = new Date('2026-10-07T12:00:00Z');
const uurGeleden = (u: number) => new Date(NU.getTime() - u * 3_600_000).toISOString();
const fout = (customer: string, provider: string, uur: number, melding = 'kapot'): FoutRij => ({
  customer_id: customer, provider, created_at: uurGeleden(uur), updated_at: uurGeleden(Math.max(0, uur - 1)), error_message: melding,
});

describe('bepaalStoringen', () => {
  it('Energiekompas-geval: weken alleen fouten, geen succes → storing met alle leads', () => {
    const fouten = [fout('ek', 'teamleader', 800, 'oud'), fout('ek', 'teamleader', 30), fout('ek', 'teamleader', 2, 'Token exchange faalde (400)')];
    const s = bepaalStoringen(fouten, new Map([[storingSleutel('ek', 'teamleader'), null]]), NU);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ customer_id: 'ek', provider: 'teamleader', aantal: 3, sinds: uurGeleden(800), laatsteFout: 'Token exchange faalde (400)' });
  });

  it('één afgewezen lead tussen geslaagde leveringen door is geen storing', () => {
    const s = bepaalStoringen([fout('vs', 'outbound_webhook', 30)], new Map([[storingSleutel('vs', 'outbound_webhook'), uurGeleden(1)]]), NU);
    expect(s).toEqual([]);
  });

  it('fouten korter dan een dag: nog geen storing (de retry kan het nog oplossen)', () => {
    const s = bepaalStoringen([fout('a', 'google_sheets', 23), fout('a', 'google_sheets', 5)], new Map(), NU);
    expect(s).toEqual([]);
  });

  it('telt alleen fouten na de laatste geslaagde levering', () => {
    const fouten = [fout('a', 'google_sheets', 100), fout('a', 'google_sheets', 40), fout('a', 'google_sheets', 26)];
    const s = bepaalStoringen(fouten, new Map([[storingSleutel('a', 'google_sheets'), uurGeleden(50)]]), NU);
    expect(s[0]).toMatchObject({ aantal: 2, sinds: uurGeleden(40), laatsteSucces: uurGeleden(50) });
  });

  it('houdt koppelingen per klant en provider apart, grootste eerst', () => {
    const fouten = [fout('a', 'teamleader', 30), fout('b', 'teamleader', 30), fout('b', 'teamleader', 29), fout('a', 'google_sheets', 2)];
    const s = bepaalStoringen(fouten, new Map(), NU);
    expect(s.map(x => x.sleutel)).toEqual(['b:teamleader', 'a:teamleader']);
  });
});

describe('bouwStoringMail', () => {
  it('maakt een duidelijk onderwerp en ontsnapt klantnamen', () => {
    const [s] = bepaalStoringen([fout('ek', 'teamleader', 30, '<script>')], new Map(), NU);
    const { onderwerp, html } = bouwStoringMail([{ ...s, klant: 'Energie & <Kompas>' }]);
    expect(onderwerp).toBe('[STORING] Teamleader van Energie & <Kompas> ontvangt geen leads meer (1 lead gemist, in het portaal staan ze wel)');
    expect(html).toContain('Energie &amp; &lt;Kompas&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('/admin/customers?open=ek');
  });

  it('meerdere koppelingen in één mail', () => {
    const st = bepaalStoringen([fout('a', 'teamleader', 30), fout('b', 'partner_snelraak', 30)], new Map(), NU);
    const { onderwerp } = bouwStoringMail(st.map(x => ({ ...x, klant: x.customer_id })));
    expect(onderwerp).toBe('[STORING] 2 koppelingen zetten geen leads meer door (2 leads gemist, in het portaal staan ze wel)');
  });
});

describe('onderwerp met laatste succes', () => {
  it('noemt de dag van de laatste geslaagde levering', () => {
    const [s] = bepaalStoringen([fout('ek', 'teamleader', 30)], new Map([[storingSleutel('ek', 'teamleader'), '2026-09-01T17:00:12Z']]), NU);
    expect(bouwStoringMail([{ ...s, klant: 'Energiekompas' }]).onderwerp).toBe('[STORING] Teamleader van Energiekompas ontvangt geen leads meer sinds 1 september (1 lead gemist, in het portaal staan ze wel)');
  });
});

describe('providerLabel', () => {
  it('geeft leesbare namen', () => {
    expect(providerLabel('teamleader')).toBe('Teamleader');
    expect(providerLabel('outbound_webhook')).toBe('Webhook (API-koppeling)');
    expect(providerLabel('partner_snelraak')).toBe('Snelraak');
  });
});
