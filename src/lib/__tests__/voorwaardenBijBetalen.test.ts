import { describe, expect, it } from 'vitest';
import { voorwaardenFactuurRegel, voorwaardenMailRegel, voorwaardenUrl } from '../voorwaardenBijBetalen';
import { buildOpenInvoiceEmailContent } from '../invoice';

describe('algemene voorwaarden bij betalen', () => {
  it('mailregel linkt naar de voorwaarden', () => {
    expect(voorwaardenMailRegel()).toContain(`href="${voorwaardenUrl()}"`);
    expect(voorwaardenMailRegel()).toContain('Door te betalen ga je akkoord');
    expect(voorwaardenMailRegel('doorlopen')).toContain('Op de nieuwe batch zijn onze');
    expect(voorwaardenFactuurRegel()).toMatch(/warmeleads\.eu\/algemene-voorwaarden$/);
  });

  it('staat in de mail met de openstaande factuur', () => {
    const c = buildOpenInvoiceEmailContent(
      { name: 'Klant', email: 'k@example.nl' },
      { invoice_number: 'WL-1', total_incl_btw: 121, description: 'Leads', id: 'i1' },
      'https://mollie.test/pay',
    );
    expect(c.html).toContain('algemene-voorwaarden');
  });
});
