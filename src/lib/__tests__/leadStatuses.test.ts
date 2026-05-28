import { describe, expect, it } from 'vitest';
import { isValidLeadStatus, LEAD_STATUS_LABELS } from '@/lib/leadStatuses';
import { leadRowToAppointmentPrefill } from '@/lib/leadAppointmentPrefill';

describe('leadStatuses', () => {
  it('includes afspraak as valid status', () => {
    expect(isValidLeadStatus('afspraak')).toBe(true);
    expect(LEAD_STATUS_LABELS.afspraak).toBe('Afspraak');
    expect(isValidLeadStatus('invalid')).toBe(false);
  });
});

describe('leadRowToAppointmentPrefill', () => {
  it('maps portal lead fields for appointment modal', () => {
    const prefill = leadRowToAppointmentPrefill({
      id: 'lead-1',
      assignment_id: 'asgn-1',
      naam_klant: 'Jan',
      telefoonnummer: '0612345678',
      email: 'jan@test.nl',
      huisnummer: '12',
      postcode: '1234AB',
      plaatsnaam: 'Utrecht',
      branch: 'zonnepanelen',
      custom_fields: { straat: 'Teststraat' },
    });
    expect(prefill.lead_id).toBe('lead-1');
    expect(prefill.lead_assignment_id).toBe('asgn-1');
    expect(prefill.contact_name).toBe('Jan');
    expect(prefill.street).toBe('Teststraat');
    expect(prefill.branch).toBe('zonnepanelen');
  });
});
