import { describe, expect, it } from 'vitest';
import { bouwIntrekkingMail, magHerstellen, magIntrekken, mailOntvangers } from '../toestemming';

describe('toestemming ingetrokken', () => {
  it('rechten: admin en superadmin trekken in, alleen superadmin herstelt', () => {
    expect([magIntrekken('superadmin'), magIntrekken('admin'), magIntrekken('accountmanager')]).toEqual([true, true, false]);
    expect([magHerstellen('superadmin'), magHerstellen('admin'), magHerstellen('accountmanager')]).toEqual([true, false, false]);
  });

  it('mailt elke klant één keer, niet interne klanten en niet zonder e-mailadres', () => {
    const uit = mailOntvangers([
      { customer_id: 'K1', naam: 'Klant Een', email: 'een@x.nl', intern: false },
      { customer_id: 'K1', naam: 'Klant Een', email: 'een@x.nl', intern: false },
      { customer_id: 'K2', naam: 'WarmeLeads.eu', email: 'info@warmeleads.eu', intern: true },
      { customer_id: 'K3', naam: 'Zonder mail', email: null, intern: false },
      { customer_id: 'K4', naam: 'Kapot adres', email: 'geen-adres', intern: false },
      { customer_id: 'K5', naam: 'Klant Vijf', email: 'vijf@x.nl', intern: false },
    ]);
    expect(uit.map(o => o.customer_id)).toEqual(['K1', 'K5']);
  });

  it('mail noemt de aanvrager, vraagt niet meer te benaderen en te verwijderen, en ontsnapt HTML', () => {
    const { onderwerp, html } = bouwIntrekkingMail('Bouw & Co', {
      naam_klant: 'Jan <b>Jansen</b>', telefoonnummer: '0612345678', email: 'jan@x.nl', plaatsnaam: 'Enschede', created_at: '2026-11-03T10:00:00Z',
    });
    expect(onderwerp).toBe('Aanvrager Jan <b>Jansen</b> niet meer benaderen: toestemming ingetrokken');
    expect(html).toContain('Bouw &amp; Co');
    expect(html).toContain('Jan &lt;b&gt;Jansen&lt;/b&gt;');
    expect(html).toContain('0612345678');
    expect(html).toContain('3 november 2026');
    expect(html).toContain('binnen 5 werkdagen');
    expect(html).toContain('artikel 7.7');
  });
});
