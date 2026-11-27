import { describe, expect, it } from 'vitest';
import { isTerugbelKeuze, maskeerTelefoon, terugbelMoment } from '../contactverzoek';

const iso = (d: Date) => d.toISOString().replace('.000', '');

describe('terugbelmoment uit de contactpagina', () => {
  it('woensdag 10:00: zsm over 15 min, vanmiddag 13:00, volgende werkdag 9:30 / 13:30', () => {
    const nu = new Date('2026-11-25T09:00:00Z'); // wo 10:00 NL
    expect(iso(terugbelMoment('zsm', nu))).toBe('2026-11-25T09:15:00Z');
    expect(iso(terugbelMoment('vandaag_middag', nu))).toBe('2026-11-25T12:00:00Z');
    expect(iso(terugbelMoment('morgen_ochtend', nu))).toBe('2026-11-26T08:30:00Z');
    expect(iso(terugbelMoment('morgen_middag', nu))).toBe('2026-11-26T12:30:00Z');
  });
  it('vroeg in de ochtend: zsm om 9:15 dezelfde dag', () => {
    expect(iso(terugbelMoment('zsm', new Date('2026-11-25T06:30:00Z')))).toBe('2026-11-25T08:15:00Z');
  });
  it('middag al bezig: vanmiddag wordt over 15 minuten', () => {
    expect(iso(terugbelMoment('vandaag_middag', new Date('2026-11-25T13:00:00Z')))).toBe('2026-11-25T13:15:00Z');
  });
  it('vrijdagavond en zaterdag: naar maandag', () => {
    const vrijdag = new Date('2026-11-27T17:00:00Z'); // vr 18:00 NL
    expect(iso(terugbelMoment('zsm', vrijdag))).toBe('2026-11-30T08:15:00Z');
    expect(iso(terugbelMoment('vandaag_middag', vrijdag))).toBe('2026-11-30T12:00:00Z');
    expect(iso(terugbelMoment('morgen_ochtend', vrijdag))).toBe('2026-11-30T08:30:00Z');
    const zaterdag = new Date('2026-11-28T10:00:00Z');
    expect(iso(terugbelMoment('zsm', zaterdag))).toBe('2026-11-30T08:15:00Z');
    expect(iso(terugbelMoment('morgen_middag', zaterdag))).toBe('2026-11-30T12:30:00Z');
  });
  it('zomertijd: 9:30 Nederlandse tijd is 7:30 UTC', () => {
    expect(iso(terugbelMoment('morgen_ochtend', new Date('2026-06-10T08:00:00Z')))).toBe('2026-06-11T07:30:00Z');
  });
  it('keuzes en telefoon afschermen', () => {
    expect(isTerugbelKeuze('zsm')).toBe(true);
    expect(isTerugbelKeuze('morgen')).toBe(false);
    expect(maskeerTelefoon('06 12345678')).toBe('06••••678');
    expect(maskeerTelefoon('')).toBeNull();
  });
});

describe('mail na 3× voicemail', async () => {
  const { vi } = await import('vitest');
  vi.doMock('../email', () => ({ EMAIL_BASE_URL: 'https://www.warmeleads.eu', sendEmail: vi.fn(), ALLOWED_FROM_DOMAIN: 'warmeleads.eu', layout: (_: string, h: string) => h }));
  vi.doMock('../email/sendAsAdmin', () => ({ sendAsAdmin: vi.fn() }));
  vi.doMock('../email/composeContext', () => ({ loadAdminFull: vi.fn(), renderForRecipients: vi.fn(), resolveRecipients: vi.fn() }));
  process.env.HERBESTEL_TOKEN_SECRET = 'test-geheim';
  const { contactverzoekTemplate, contactUrl, contactTokenKlopt } = await import('../contactverzoekServer');

  it('bevat de drie opties, de momenten en een geldige persoonlijke link', () => {
    const url = contactUrl('12e76ec9-0f59-4766-9198-665d5fdc2fde');
    const t = new URL(url).searchParams.get('t');
    expect(contactTokenKlopt('12e76ec9-0f59-4766-9198-665d5fdc2fde', t)).toBe(true);
    expect(contactTokenKlopt('a1468442-d31c-400d-ad09-3999ea18734a', t)).toBe(false);
    const ctx = {
      recipient: { firstName: 'Jan', companyName: 'Jansen Installatie', name: 'Jan Jansen' },
      admin: { firstName: 'Luigi', name: 'Luigi Pani' },
      optionValues: { contact_url: url, momenten: ['maandag 24 november 10:12', 'dinsdag 25 november 14:30', 'woensdag 26 november 09:05'] },
      signatureHtml: '<p>Luigi</p>', unsubscribeUrl: 'https://x/u',
    } as unknown as Parameters<typeof contactverzoekTemplate.render>[0];
    const { html } = contactverzoekTemplate.render(ctx);
    expect(contactverzoekTemplate.defaultSubject(ctx)).toBe('We probeerden u te bereiken, Jansen Installatie');
    expect(html).toContain('Beste Jan');
    expect(html).toContain('3 keer geprobeerd te bellen');
    expect(html).toContain('dinsdag 25 november 14:30');
    expect(html).toContain(url);
    expect(html).toContain('/plan-gesprek');
    expect(html).toContain('tel:+31850477067');
    expect(html).toContain('keuze=geen_interesse');
    expect(html).not.toContain('undefined');
  });
});
