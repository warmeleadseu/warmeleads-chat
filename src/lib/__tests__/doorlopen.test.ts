import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AANKONDIG_PCT, DOORLOOP_MAX_EXCL, batchKanDoorlopen, batchMagLeveren, betaalUiterlijk, doorloopGrootte,
  magStarten, magZelfAanzetten, volgendeDoorloopStap,
} from '../doorlopenRegels';
import { controleerStopToken, doorloopStopUrl, maakStopToken } from '../doorloopToken';
import { getDesiredMetaCampaignStatus, isBatchEligibleForMetaSync } from '../metaBatchCampaignSync';
import { isPortalBatchAwaitingPayment } from '../portalBatches';

const oud = process.env.HERBESTEL_TOKEN_SECRET;
beforeAll(() => { process.env.HERBESTEL_TOKEN_SECRET = 'test-geheim-voor-doorlopen-1234'; });
afterAll(() => { process.env.HERBESTEL_TOKEN_SECRET = oud; });

const nu = new Date('2026-10-28T10:00:00Z');
const dagenTerug = (d: number) => new Date(nu.getTime() - d * 86_400_000).toISOString();

describe('het gewone proces verandert niet', () => {
  it('zonder doorlopen is "mag leveren" precies "betaald"', () => {
    for (const is_paid of [true, false, null, undefined]) {
      expect(batchMagLeveren({ is_paid, op_factuur: false })).toBe(is_paid === true);
      expect(batchMagLeveren({ is_paid })).toBe(is_paid === true);
    }
  });
  it('een onbetaalde gewone batch blijft in het portaal "wacht op betaling"', () => {
    expect(isPortalBatchAwaitingPayment({ id: '1', status: 'active', is_paid: false })).toBe(true);
    expect(isPortalBatchAwaitingPayment({ id: '1', status: 'active', is_paid: false, op_factuur: false })).toBe(true);
  });
  it('Meta adverteert niet voor een onbetaalde gewone batch', () => {
    const rij = { id: '1', batch_kind: 'leads', is_paid: false, status: 'active', batch_size: 10, leads_delivered: 0, meta_campaign_sync_enabled: true, meta_campaign_ids: ['123456789'] };
    expect(getDesiredMetaCampaignStatus(rij)).toBe('PAUSED');
    expect(isBatchEligibleForMetaSync(rij)).toBe(false);
  });
});

describe('een doorloopbatch op factuur', () => {
  it('levert al voor de betaling', () => {
    expect(batchMagLeveren({ is_paid: false, op_factuur: true })).toBe(true);
  });
  it('staat in het portaal niet als "wacht op betaling" (de factuur staat onder Facturen)', () => {
    expect(isPortalBatchAwaitingPayment({ id: '1', status: 'active', is_paid: false, op_factuur: true })).toBe(false);
    expect(isPortalBatchAwaitingPayment({ id: '1', status: 'pending_payment', is_paid: false, op_factuur: true })).toBe(true);
  });
  it('houdt de Meta-campagnes aan', () => {
    const rij = { id: '1', batch_kind: 'leads', is_paid: false, op_factuur: true, status: 'active', batch_size: 10, leads_delivered: 0, meta_campaign_sync_enabled: true, meta_campaign_ids: ['123456789'] };
    expect(getDesiredMetaCampaignStatus(rij)).toBe('ACTIVE');
    expect(isBatchEligibleForMetaSync(rij)).toBe(true);
    expect(getDesiredMetaCampaignStatus({ ...rij, status: 'paused' })).toBe('PAUSED');
  });
});

describe('welke batches doorlopen', () => {
  it('alleen leadbatches met een prijs, niet handmatig of onderzoek', () => {
    expect(batchKanDoorlopen({ batch_kind: 'leads', delivery_model: 'capped', price_per_lead: 30, batch_size: 50 })).toBe(true);
    expect(batchKanDoorlopen({ batch_kind: 'bulk_leads', price_per_lead: 30, batch_size: 50 })).toBe(false);
    expect(batchKanDoorlopen({ batch_kind: 'niche_research', price_per_lead: 30, batch_size: 50 })).toBe(false);
    expect(batchKanDoorlopen({ batch_kind: 'leads', delivery_model: 'manual', price_per_lead: 30, batch_size: 50 })).toBe(false);
    expect(batchKanDoorlopen({ batch_kind: 'leads', delivery_model: 'unlimited', price_per_lead: 30, batch_size: 50 })).toBe(false);
    expect(batchKanDoorlopen({ batch_kind: 'leads', price_per_lead: 0, batch_size: 50 })).toBe(false);
  });
});

describe('grootte van de doorloop', () => {
  it('dezelfde grootte als het binnen het maximum past', () => {
    expect(doorloopGrootte(30, 50)).toEqual({ grootte: 50, verkleind: false });
    expect(doorloopGrootte(25, 100)).toEqual({ grootte: 100, verkleind: false });
  });
  it(`verkleind tot het maximum van ${DOORLOOP_MAX_EXCL} excl. btw`, () => {
    expect(doorloopGrootte(30, 100)).toEqual({ grootte: 83, verkleind: true });
    expect(doorloopGrootte(38.5, 100)).toEqual({ grootte: 64, verkleind: true });
  });
  it('niet als er minder dan 10 in passen of de gegevens niet kloppen', () => {
    expect(doorloopGrootte(300, 20)).toBeNull();
    expect(doorloopGrootte(0, 20)).toBeNull();
    expect(doorloopGrootte(30, 0)).toBeNull();
  });
});

describe('zelf aanzetten door de klant', () => {
  it('vanaf één betaalde batch, zonder achterstallige factuur', () => {
    expect(magZelfAanzetten({ betaaldeBatches: 1, achterstalligeFacturen: 0 })).toBe('ok');
    expect(magZelfAanzetten({ betaaldeBatches: 0, achterstalligeFacturen: 0 })).toBe('geen_betaalde_batch');
    expect(magZelfAanzetten({ betaaldeBatches: 3, achterstalligeFacturen: 1 })).toBe('achterstallig');
  });
  it('nooit voor interne of demoklanten', () => {
    expect(magZelfAanzetten({ betaaldeBatches: 5, achterstalligeFacturen: 0, intern: true })).toBe('niet_beschikbaar');
    expect(magZelfAanzetten({ betaaldeBatches: 5, achterstalligeFacturen: 0, demo: true })).toBe('niet_beschikbaar');
  });
});

describe('starten na de aankondiging', () => {
  it(`aangekondigd bij ${AANKONDIG_PCT}% (voor de afronding): direct starten`, () => {
    expect(magStarten({ doorloop_aangekondigd_op: dagenTerug(1), completed_at: nu.toISOString() }, nu)).toBe(true);
  });
  it('nooit zonder aankondiging', () => {
    expect(magStarten({ doorloop_aangekondigd_op: null, completed_at: nu.toISOString() }, nu)).toBe(false);
  });
  it('aangekondigd na de afronding (laat aangezet): pas na 24 uur', () => {
    const klaar = dagenTerug(2);
    expect(magStarten({ doorloop_aangekondigd_op: new Date(nu.getTime() - 23 * 3_600_000).toISOString(), completed_at: klaar }, nu)).toBe(false);
    expect(magStarten({ doorloop_aangekondigd_op: new Date(nu.getTime() - 25 * 3_600_000).toISOString(), completed_at: klaar }, nu)).toBe(true);
  });
});

describe('opvolging van een onbetaalde doorloopfactuur', () => {
  it('dag 5 herinnering, dag 7 pauze, dag 14 bellen', () => {
    expect(volgendeDoorloopStap({ created_at: dagenTerug(4) }, nu)).toBeNull();
    expect(volgendeDoorloopStap({ created_at: dagenTerug(5) }, nu)?.soort).toBe('herinnering');
    expect(volgendeDoorloopStap({ created_at: dagenTerug(7), doorloop_stap: 1 }, nu)?.soort).toBe('pauze');
    expect(volgendeDoorloopStap({ created_at: dagenTerug(14), doorloop_stap: 2 }, nu)?.soort).toBe('bellen');
    expect(volgendeDoorloopStap({ created_at: dagenTerug(20), doorloop_stap: 3 }, nu)).toBeNull();
  });
  it('een gemiste run slaat niet over naar te zacht: op dag 8 zonder stappen meteen de pauze', () => {
    expect(volgendeDoorloopStap({ created_at: dagenTerug(8), doorloop_stap: 0 }, nu)?.soort).toBe('pauze');
  });
  it('betaaltermijn van 7 dagen', () => {
    expect(betaalUiterlijk('2026-10-28T10:00:00Z').toISOString()).toBe('2026-11-04T10:00:00.000Z');
  });
});

describe('stoplink', () => {
  it('werkt alleen voor die klant en tot de vervaldag', () => {
    const u = new URL(doorloopStopUrl('klant-1', { siteUrl: 'https://x.test', nu }));
    expect(u.pathname).toBe('/doorlopen/stoppen');
    const [k, v, t] = ['k', 'v', 't'].map(p => u.searchParams.get(p));
    expect(controleerStopToken(k!, v, t, nu)).toBe('ok');
    expect(controleerStopToken('klant-2', v, t, nu)).toBe('ongeldig');
    expect(controleerStopToken(k!, String(Number(v) + 1), t, nu)).toBe('ongeldig');
    expect(controleerStopToken(k!, v, 'x'.repeat(32), nu)).toBe('ongeldig');
    expect(controleerStopToken(k!, v, t, new Date(nu.getTime() + 61 * 86_400_000))).toBe('verlopen');
  });
  it('is niet te verwisselen met een herbestellink', () => {
    expect(maakStopToken('b1', 20000)).not.toBe('');
    expect(controleerStopToken('b1', '20000', 'herbestel-token-van-dezelfde-lengte-xx', nu)).toBe('ongeldig');
  });
});
