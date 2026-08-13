import { describe, expect, it } from 'vitest';
import {
  buildSampleWebhookPayload,
  pickWebhookSampleBranch,
} from '../integrations/outboundWebhook/payload';

describe('pickWebhookSampleBranch', () => {
  it('prefers explicit branch', () => {
    expect(
      pickWebhookSampleBranch({
        preferred: 'warmtepomp',
        webhookBranches: ['isolatie'],
        customerBranches: ['airco'],
      }),
    ).toBe('warmtepomp');
  });

  it('falls back to webhook filter, then customer, then warmtepomp', () => {
    expect(pickWebhookSampleBranch({ webhookBranches: ['thuisbatterij'] })).toBe('thuisbatterij');
    expect(pickWebhookSampleBranch({ customerBranches: ['airco'] })).toBe('airco');
    expect(pickWebhookSampleBranch({})).toBe('warmtepomp');
  });
});

describe('buildSampleWebhookPayload', () => {
  it('builds warmtepomp sample with custom fields by default', () => {
    const payload = buildSampleWebhookPayload(null, { branch: 'warmtepomp' });
    expect(payload.branch).toBe('warmtepomp');
    expect(payload.categorie).toBe('Warmtepomp');
    expect(payload.categorieen).toEqual(['Warmtepomp']);
    expect(payload.naam).toBe('Warme Leads Test');
    expect(payload.telefoonnummer).toBe('+31612345678');
    expect(payload.woningtype).toBe('Tussenwoning');
    expect(payload.bouwjaar).toBe('1998');
    expect(payload.huidige_verwarming).toBe('CV-ketel op gas');
  });

  it('builds isolatie sample with interesse mapping', () => {
    const payload = buildSampleWebhookPayload(null, { branch: 'isolatie' });
    expect(payload.branch).toBe('isolatie');
    expect(payload.categorie).toBe('Spouwmuurisolatie');
    expect(payload.interesse).toBe('(Spouw) muur');
  });
});
