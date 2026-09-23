import { describe, it, expect } from 'vitest';
import { initialPipelineBatchStatus, initialAppointmentBatchStatus } from '../customerBatchStatus';

/**
 * In productie stonden vier volle bulkbatches op 'actief' (Oevering 101/101,
 * Lokaal Verduurzamen 50/50 en 228/228, Sky Connect 200/200). Ze kregen die
 * status bij betaling en kwamen er nooit meer uit: reconcile_batch_delivered()
 * sluit alleen batches met leveringsmodel 'capped' en bulk staat op 'manual'.
 * Daardoor telden ze overal mee als actieve klant.
 */

describe('initialPipelineBatchStatus', () => {
  it('zet een onbetaalde batch op wachten op betaling', () => {
    expect(initialPipelineBatchStatus(false)).toBe('pending_payment');
    expect(initialPipelineBatchStatus(false, 'bulk_leads')).toBe('pending_payment');
    expect(initialPipelineBatchStatus(false, 'niche_research')).toBe('pending_payment');
  });

  it('zet een betaalde pijplijnbatch op actief', () => {
    expect(initialPipelineBatchStatus(true)).toBe('active');
    expect(initialPipelineBatchStatus(true, 'leads')).toBe('active');
    expect(initialPipelineBatchStatus(true, 'niche_research')).toBe('active');
  });

  it('rondt een betaalde bulkbatch meteen af', () => {
    /* De leads gaan bij verkoop in één keer weg; er valt daarna niets meer te
       leveren, dus er hoort ook geen actieve batch open te blijven staan. */
    expect(initialPipelineBatchStatus(true, 'bulk_leads')).toBe('completed');
  });

  it('gaat om met een ontbrekend of onbekend soort', () => {
    expect(initialPipelineBatchStatus(true, null)).toBe('active');
    expect(initialPipelineBatchStatus(true, 'iets_nieuws')).toBe('active');
  });
});

describe('initialAppointmentBatchStatus', () => {
  it('volgt het bestaande patroon', () => {
    expect(initialAppointmentBatchStatus(true)).toBe('active');
    expect(initialAppointmentBatchStatus(false)).toBe('pending_payment');
  });
});
