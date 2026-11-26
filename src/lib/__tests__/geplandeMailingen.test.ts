import { describe, expect, it, vi } from 'vitest';

vi.mock('../email', () => ({ ALLOWED_FROM_DOMAIN: 'warmeleads.eu', EMAIL_BASE_URL: 'https://x', sendEmail: vi.fn(), layout: (_: string, h: string) => h }));
vi.mock('../email/sendAsAdmin', () => ({ sendAsAdmin: vi.fn() }));
vi.mock('../email/composeContext', () => ({ loadAdminFull: vi.fn(), renderForRecipients: vi.fn(), resolveRecipients: vi.fn() }));

const { magActie } = await import('../geplandeMailingen');
const { maakCampagneVeilig } = await import('../email/templates/campagne');

const NU = new Date('2026-11-27T08:00:00Z');

describe('geplande mailing: wat mag wanneer', () => {
  it('alleen een concept goedkeuren, en niet ver in het verleden', () => {
    expect(magActie('concept', 'goedkeuren', '2026-11-27T08:30:00Z', NU)).toBeNull();
    expect(magActie('concept', 'goedkeuren', '2026-11-27T07:30:00Z', NU)).toBeNull();
    expect(magActie('concept', 'goedkeuren', '2026-11-27T06:00:00Z', NU)).toMatch(/verleden/);
    expect(magActie('goedgekeurd', 'goedkeuren', '2026-11-27T08:30:00Z', NU)).toMatch(/concept/);
  });
  it('annuleren tot hij weg is, terug naar concept alleen na goedkeuren', () => {
    expect(magActie('concept', 'annuleren', '', NU)).toBeNull();
    expect(magActie('goedgekeurd', 'annuleren', '', NU)).toBeNull();
    expect(magActie('bezig', 'annuleren', '', NU)).not.toBeNull();
    expect(magActie('verstuurd', 'annuleren', '', NU)).not.toBeNull();
    expect(magActie('goedgekeurd', 'naar_concept', '', NU)).toBeNull();
    expect(magActie('concept', 'naar_concept', '', NU)).not.toBeNull();
  });
});

describe('campagnemail: opmaak blijft, gevaar gaat eruit', () => {
  it('houdt tabellen en stijlen', () => {
    const html = maakCampagneVeilig('<table style="border:1px solid #eee"><tr><td style="padding:8px">30 leads</td></tr></table>');
    expect(html).toContain('<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #eee">');
    expect(html).toContain('<td style="padding:8px">30 leads</td>');
  });
  it('haalt scripts, handlers, gevaarlijke stijlen en links weg', () => {
    const html = maakCampagneVeilig('<script>alert(1)</script><p onclick="x()" style="background:url(http://e)">a</p><a href="javascript:x()">b</a><img src=x onerror=y><a href="https://warmeleads.eu/portal">c</a>');
    expect(html).not.toMatch(/script|onclick|url\(|javascript|<img/i);
    expect(html).toContain('<p>a</p>');
    expect(html).toContain('href="#"');
    expect(html).toContain('href="https://warmeleads.eu/portal"');
  });
});
