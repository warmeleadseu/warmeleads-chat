import { describe, expect, it, vi } from 'vitest';

vi.mock('../email', () => ({ ALLOWED_FROM_DOMAIN: 'warmeleads.eu', EMAIL_BASE_URL: 'https://www.warmeleads.eu', sendEmail: vi.fn(), layout: (_: string, h: string) => h }));
vi.mock('../email/sendAsAdmin', () => ({ sendAsAdmin: vi.fn() }));
vi.mock('../email/composeContext', () => ({ loadAdminFull: vi.fn(), renderForRecipients: vi.fn(), resolveRecipients: vi.fn() }));
process.env.HERBESTEL_TOKEN_SECRET = 'test-geheim';

const { actieGroottes, actieNotitie, cadeauLeads, decemberactieLoopt, decemberbonus, DECEMBERACTIE_TOT_DAG } = await import('../decemberactie');
const { gebruiktBestelLink, vulBestelLink } = await import('../geplandeMailingen');
const { controleerHerbestelToken, herbestelUrl, leesBron } = await import('../herbestelToken');

describe('decemberactie', () => {
  it('1 gratis lead per 3', () => {
    expect([30, 50, 100, 2].map(decemberbonus)).toEqual([10, 16, 33, 0]);
  });
  it('cadeauleads alleen bij warmtepomp, per trede', () => {
    expect([29, 30, 49, 50, 75, 100, 300].map(n => cadeauLeads('warmtepomp', n))).toEqual([0, 5, 5, 10, 15, 20, 20]);
    expect(cadeauLeads('thuisbatterij', 100)).toBe(0);
  });
  it('maten uit de mail plus de vorige, boven het minimum', () => {
    expect(actieGroottes(40, 30)).toEqual([30, 40, 50, 75, 100]);
    expect(actieGroottes(20, 30)).toEqual([30, 50, 75, 100]);
  });
  it('loopt tot en met 31 december (Nederlandse tijd)', () => {
    expect(decemberactieLoopt(new Date('2026-12-31T22:30:00Z'))).toBe(true);
    expect(decemberactieLoopt(new Date('2026-12-31T23:30:00Z'))).toBe(false);
  });
  it('notitie op de bestelling noemt het tegoed', () => {
    expect(actieNotitie('warmtepomp', 50)).toBe('Decemberactie: 16 gratis leads tegoed bij volgende bestelling; 10 cadeauleads nog toe te voegen aan deze batch');
    expect(actieNotitie('thuisbatterij', 30)).toBe('Decemberactie: 10 gratis leads tegoed bij volgende bestelling');
  });
});

describe('persoonlijke bestellink in de mail', () => {
  it('herkent en vult {{bestel_link}} in alle tekstvelden', () => {
    const o = { body: '<a href="{{ bestel_link }}">Bestel</a>', cta_url: '{{bestel_link}}', n: 3 };
    expect(gebruiktBestelLink(o)).toBe(true);
    expect(gebruiktBestelLink({ body: '<p>geen</p>' })).toBe(false);
    expect(vulBestelLink(o, 'https://x/y')).toEqual({ body: '<a href="https://x/y">Bestel</a>', cta_url: 'https://x/y', n: 3 });
  });
  it('de link is geldig tot en met 31 december en draagt de bron', () => {
    const url = new URL(herbestelUrl('12e76ec9-0f59-4766-9198-665d5fdc2fde', 'decemberactie', { totDag: DECEMBERACTIE_TOT_DAG }));
    const v = url.searchParams.get('v'), t = url.searchParams.get('t');
    expect(leesBron(url.searchParams.get('b'))).toBe('decemberactie');
    expect(controleerHerbestelToken('12e76ec9-0f59-4766-9198-665d5fdc2fde', v, t, new Date('2026-12-31T12:00:00Z'))).toBe('ok');
    expect(controleerHerbestelToken('12e76ec9-0f59-4766-9198-665d5fdc2fde', v, t, new Date('2027-01-02T12:00:00Z'))).toBe('verlopen');
  });
});
