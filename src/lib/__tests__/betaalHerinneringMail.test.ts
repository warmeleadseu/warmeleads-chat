import { describe, expect, it } from 'vitest';
import { buildUnpaidBatchReminderEmailContent } from '../email';

const klant = { id: 'k1', name: 'Testbedrijf', email: 'test@example.com', contact_person: 'Sam', country: 'NL', vat_id: null };
const batch = { id: 'b1', branch: 'thuisbatterij', branch_name: 'Thuisbatterij', batch_size: 20, price_per_lead: 30, total_price: 600 };

describe('betaalherinnering (mail)', () => {
  it('zonder opties: zoals de handmatige herinnering', () => {
    const c = buildUnpaidBatchReminderEmailContent(klant, batch);
    expect(c.subject).toBe('Herinnering: je batch Thuisbatterij wacht op betaling');
    expect(c.html).not.toContain('geldig tot');
    expect(c.metadata).not.toHaveProperty('stap');
  });
  it('automatische reeks: geldigheidsdatum, stap in de metadata', () => {
    const c = buildUnpaidBatchReminderEmailContent(klant, batch, { geldigTot: new Date('2026-11-10T12:00:00Z'), stap: 2 });
    expect(c.html).toContain('Dit aanbod is geldig tot en met');
    expect(c.html).toContain('10 november');
    expect(c.metadata).toMatchObject({ stap: 2, automatisch: true });
  });
  it('de derde mail is de laatste herinnering', () => {
    const c = buildUnpaidBatchReminderEmailContent(klant, batch, { laatste: true, stap: 3 });
    expect(c.subject).toBe('Laatste herinnering: je batch Thuisbatterij wacht op betaling');
  });
});
