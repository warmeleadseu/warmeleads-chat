import { describe, it, expect } from 'vitest';
import {
  leesSnelraakToken,
  bouwSnelraakPayload,
  bouwSnelraakTestPayload,
  beoordeelSnelraak,
  SNELRAAK,
} from '../integrations/partners/snelraak';
import { verbergGeheim, kortAntwoord } from '../integrations/partners/verberg';
import { binnenLeverperiode, brancheToegestaan } from '../integrations/partners/repo';
import { normaliseerTestnummer } from '../integrations/partners/service';
import { PARTNERS, partnerOpId, partnerOpProvider, isPartnerProvider } from '../integrations/partners/registry';
import type { PartnerAntwoord, PartnerLead } from '../integrations/partners/types';

const TOKEN = 'VqFfxtlM93Y6muAjU-5yr5ZEOXSlko29P-ge';
const URL_OK = `https://snelraak.nl/api/v1/ingest/${TOKEN}`;

describe('Snelraak-adres: alleen een echt Snelraak-adres wordt geaccepteerd', () => {
  it('haalt het token uit een geldig adres', () => {
    expect(leesSnelraakToken(URL_OK)).toBe(TOKEN);
    expect(leesSnelraakToken(`  ${URL_OK}/  `)).toBe(TOKEN);
  });

  it.each([
    ['http in plaats van https', URL_OK.replace('https', 'http')],
    ['andere host', URL_OK.replace('snelraak.nl', 'evil.example')],
    ['subdomein', URL_OK.replace('snelraak.nl', 'x.snelraak.nl')],
    ['lijkt op snelraak', URL_OK.replace('snelraak.nl', 'snelraak.nl.evil.example')],
    ['www', URL_OK.replace('snelraak.nl', 'www.snelraak.nl')],
    ['poort', URL_OK.replace('snelraak.nl', 'snelraak.nl:8443')],
    ['inloggegevens', URL_OK.replace('https://', 'https://user:pass@')],
    ['queryparameter', `${URL_OK}?key=x`],
    ['fragment', `${URL_OK}#x`],
    ['ander pad', `https://snelraak.nl/api/v2/ingest/${TOKEN}`],
    ['extra padstuk', `${URL_OK}/extra`],
    ['te kort token', 'https://snelraak.nl/api/v1/ingest/abc'],
    ['vreemde tekens', 'https://snelraak.nl/api/v1/ingest/abc%2F..%2F..%2Fadmin1234567'],
    ['geen URL', 'snelraak'],
  ])('weigert: %s', (_, url) => {
    expect(leesSnelraakToken(url)).toBeNull();
  });

  it('bouwt de URL zelf op uit het token, en toont alleen een hint', () => {
    expect(SNELRAAK.bouwUrl(TOKEN)).toBe(URL_OK);
    expect(SNELRAAK.urlHint(TOKEN)).toBe('https://snelraak.nl/api/v1/ingest/••••P-ge');
    expect(SNELRAAK.urlHint(TOKEN)).not.toContain(TOKEN.slice(0, 10));
  });
});

const LEAD: PartnerLead = {
  id: 'lead-1',
  branch: 'thuisbatterij',
  naam_klant: 'Ron van Wielink',
  email: 'ron@example.com',
  telefoonnummer: '+31612345678',
  postcode: '1234AB',
  huisnummer: '12',
  plaatsnaam: 'Groningen',
  provincie: 'Groningen',
  land: 'NL',
  created_at: '2026-10-02T10:00:00Z',
  custom_fields: {
    stroomverbruik: '4500 kWh',
    zonnepanelen: true,
    budget: '',
    meta_leadgen_id: 'intern-123',
    max_customer_assignments: 2,
    straat: 'Hoofdstraat',
  },
};
const CTX = {
  straat: 'Hoofdstraat',
  brancheNaam: 'Thuisbatterij',
  toegestaneVelden: [
    { key: 'stroomverbruik', label: 'Stroomverbruik' },
    { key: 'zonnepanelen', label: 'Zonnepanelen' },
    { key: 'budget', label: 'Budget' },
  ],
};

describe('Snelraak-payload', () => {
  const p = bouwSnelraakPayload(LEAD, CTX);

  it('gebruikt de veldnamen die Snelraak aanbeveelt', () => {
    expect(p).toMatchObject({
      lead_id: 'lead-1',
      first_name: 'Ron',
      last_name: 'van Wielink',
      full_name: 'Ron van Wielink',
      phone: '+31612345678',
      email: 'ron@example.com',
      postal_code: '1234AB',
      city: 'Groningen',
      street: 'Hoofdstraat',
      house_number: '12',
      product: 'Thuisbatterij',
      payload_version: 1,
    });
  });

  it('zet de antwoorden leesbaar in de toelichting en als losse velden', () => {
    expect(p.description).toBe('Stroomverbruik: 4500 kWh. Zonnepanelen: Ja');
    expect(p.stroomverbruik).toBe('4500 kWh');
    expect(p.zonnepanelen).toBe('Ja');
  });

  it('stuurt geen interne velden en geen lege waarden mee', () => {
    expect(p).not.toHaveProperty('meta_leadgen_id');
    expect(p).not.toHaveProperty('max_customer_assignments');
    expect(p).not.toHaveProperty('budget');
    expect(Object.values(p)).not.toContain(null);
    expect(Object.values(p)).not.toContain('');
  });

  it('stuurt geen notities en geen is_test bij een echte lead', () => {
    const metNotitie = bouwSnelraakPayload({ ...LEAD, custom_fields: { ...LEAD.custom_fields } } as PartnerLead & { notities: string }, CTX);
    expect(JSON.stringify(metNotitie)).not.toContain('notities');
    expect(p).not.toHaveProperty('is_test');
  });

  it('laat een antwoord nooit een vast veld overschrijven', () => {
    const q = bouwSnelraakPayload(
      { ...LEAD, custom_fields: { phone: '0000' } },
      { ...CTX, toegestaneVelden: [{ key: 'phone', label: 'Telefoon (vraag)' }] },
    );
    expect(q.phone).toBe('+31612345678');
  });

  it('valt terug op de branche als de naam onbekend is, en op NL als land', () => {
    const q = bouwSnelraakPayload({ ...LEAD, land: null }, { ...CTX, brancheNaam: null });
    expect(q.product).toBe('thuisbatterij');
    expect(q.country).toBe('NL');
  });

  it('blijft ruim onder de 256 KB van Snelraak', () => {
    expect(JSON.stringify(p).length).toBeLessThan(10_000);
  });
});

describe('Snelraak-testlevering', () => {
  it('gebruikt nepgegevens met is_test', () => {
    const t = bouwSnelraakTestPayload();
    expect(t.is_test).toBe(true);
    expect(t.email).toBe('test@example.com');
    expect(t.lead_id).toBe('warmeleads-testlevering');
  });

  it('kan een eigen testnummer gebruiken', () => {
    expect(bouwSnelraakTestPayload({ telefoon: '+31643219739' }).phone).toBe('+31643219739');
  });
});

const antwoord = (o: Partial<PartnerAntwoord>): PartnerAntwoord => ({
  status: 200, body: '', timeout: false, netwerkfout: false, retryAfter: null, ...o,
});

describe('Antwoorden van Snelraak', () => {
  it('200 met ok:true is gelukt', () => {
    expect(beoordeelSnelraak(antwoord({ body: '{"ok":true}' })).soort).toBe('gelukt');
  });

  it('200 zonder ok:true is niet vanzelf gelukt', () => {
    expect(beoordeelSnelraak(antwoord({ body: '{"ok":false}' })).soort).toBe('tijdelijk');
    expect(beoordeelSnelraak(antwoord({ body: 'OK' })).soort).toBe('tijdelijk');
  });

  it('404 is blijvend: verkeerd adres, niet blijven proberen', () => {
    const u = beoordeelSnelraak(antwoord({ status: 404 }));
    expect(u.soort).toBe('blijvend');
    if (u.soort === 'blijvend') expect(u.melding).toContain('404');
  });

  it.each([400, 401, 403, 410, 413, 422, 301])('%i is blijvend', status => {
    expect(beoordeelSnelraak(antwoord({ status })).soort).toBe('blijvend');
  });

  it('429 is tijdelijk en geeft de wachttijd door', () => {
    const u = beoordeelSnelraak(antwoord({ status: 429, retryAfter: '30' }));
    expect(u).toMatchObject({ soort: 'tijdelijk', wachtSeconden: 30 });
  });

  it.each([500, 502, 503])('%i is tijdelijk', status => {
    expect(beoordeelSnelraak(antwoord({ status })).soort).toBe('tijdelijk');
  });

  it('time-out en netwerkfout zijn tijdelijk (Snelraak ontdubbelt op lead_id)', () => {
    expect(beoordeelSnelraak(antwoord({ status: 0, timeout: true })).soort).toBe('tijdelijk');
    expect(beoordeelSnelraak(antwoord({ status: 0, netwerkfout: true })).soort).toBe('tijdelijk');
  });
});

describe('Geheim adres lekt nergens', () => {
  it('poetst het token weg, ook zonder het token te kennen', () => {
    expect(verbergGeheim(`fout bij ${URL_OK}`, TOKEN)).not.toContain(TOKEN);
    expect(verbergGeheim(`fetch failed: ${URL_OK}`)).not.toContain(TOKEN);
    expect(verbergGeheim(`fetch failed: ${URL_OK}`)).toContain('/ingest/••••');
  });

  it('maakt antwoordtekst kort en veilig', () => {
    expect(kortAntwoord(`x`.repeat(500)).length).toBeLessThanOrEqual(201);
    expect(kortAntwoord(`zie ${URL_OK}`, TOKEN)).not.toContain(TOKEN);
  });
});

describe('Leverperiode en branchefilter', () => {
  it('levert niets van vóór de koppeling', () => {
    const s = { leveren_vanaf: '2026-10-02T12:00:00Z' };
    expect(binnenLeverperiode(s, '2026-10-02T11:59:00Z')).toBe(false);
    expect(binnenLeverperiode(s, '2026-10-02T12:01:00Z')).toBe(true);
    expect(binnenLeverperiode({}, '2020-01-01T00:00:00Z')).toBe(true);
  });

  it('leeg branchefilter betekent alle branches', () => {
    expect(brancheToegestaan({}, 'thuisbatterij')).toBe(true);
    expect(brancheToegestaan({ branches: ['warmtepomp'] }, 'thuisbatterij')).toBe(false);
    expect(brancheToegestaan({ branches: ['thuisbatterij'] }, 'thuisbatterij')).toBe(true);
  });
});

describe('Testnummer van de admin', () => {
  it.each([
    ['0643219739', '+31643219739'],
    ['+31643219739', '+31643219739'],
    ['0031 6 43 21 97 39', '+31643219739'],
    ['06-4321-9739', '+31643219739'],
  ])('%s wordt %s', (in_, uit) => expect(normaliseerTestnummer(in_)).toBe(uit));

  it.each(['0201234567', '12345', '+32470123456', ''])('weigert %s', n => {
    expect(normaliseerTestnummer(n)).toBeNull();
  });
});

describe('Partnerregister', () => {
  it('kent Snelraak onder een eigen provider, los van de algemene webhook', () => {
    expect(partnerOpId('snelraak')?.provider).toBe('partner_snelraak');
    expect(partnerOpProvider('partner_snelraak')?.id).toBe('snelraak');
    expect(isPartnerProvider('outbound_webhook')).toBe(false);
    expect(new Set(PARTNERS.map(p => p.provider)).size).toBe(PARTNERS.length);
  });

  it('respecteert de limiet van 120 per minuut', () => {
    for (const p of PARTNERS) expect(60_000 / p.pauzeMs).toBeLessThanOrEqual(120);
  });
});

describe('Partnerlogo', () => {
  it('elk logo bestaat, is vierkant, transparant en klein', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sharp = (await import('sharp')).default;
    for (const p of PARTNERS) {
      if (!p.logo) continue;
      const bestand = path.join(process.cwd(), 'public', p.logo);
      expect(fs.existsSync(bestand)).toBe(true);
      const m = await sharp(bestand).metadata();
      expect(m.width).toBe(m.height);
      expect(m.width).toBeGreaterThanOrEqual(128);
      expect(m.hasAlpha).toBe(true);
      expect(fs.statSync(bestand).size).toBeLessThan(60_000);
    }
  });
});
