import { describe, it, expect } from 'vitest';
import { leesOntvangerUitslag } from '../integrations/outboundWebhook/transport';
import { samenvatting } from '../integrations/outboundWebhook/payload';
import { defaultFieldMappings } from '../integrations/outboundWebhook/fields';

/* De antwoorden hieronder zijn letterlijk wat Ventasol teruggaf op
   verbindingstests (30 sep 2026). Ze antwoorden altijd met HTTP 200. */

describe('leesOntvangerUitslag', () => {
  it('herkent een geweigerde lead in een 200-antwoord, met de reden', () => {
    const u = leesOntvangerUitslag('{"imported":0,"enriched":0,"skipped":0,"failed":[{"index":0,"reason":"geen naam"}]}');
    expect(u.geweigerd).toBe('geen naam');
  });

  it('neemt de reden over bij een ongeldig telefoonnummer', () => {
    const u = leesOntvangerUitslag('{"imported":0,"enriched":0,"skipped":0,"failed":[{"index":0,"reason":"ongeldig of ontbrekend telefoonnummer"}]}');
    expect(u.geweigerd).toBe('ongeldig of ontbrekend telefoonnummer');
  });

  it('ziet een geïmporteerde lead als geslaagd', () => {
    const u = leesOntvangerUitslag('{"imported":1,"enriched":0,"skipped":0,"failed":[]}');
    expect(u).toEqual({ geweigerd: null, notitie: null });
  });

  it('ziet een overgeslagen lead als aangenomen, met een notitie', () => {
    const u = leesOntvangerUitslag('{"imported":0,"skipped":[{"index":0,"reason":"bestaat al"}],"failed":[]}');
    expect(u.geweigerd).toBeNull();
    expect(u.notitie).toContain('bestaat al');
  });

  it('telt ook een aantal in plaats van een lijst', () => {
    expect(leesOntvangerUitslag('{"imported":0,"failed":1}').geweigerd).toBeTruthy();
  });

  it('laat andere ontvangers ongemoeid: geen JSON of geen failed-veld is gewoon geslaagd', () => {
    expect(leesOntvangerUitslag('OK').geweigerd).toBeNull();
    expect(leesOntvangerUitslag('').geweigerd).toBeNull();
    expect(leesOntvangerUitslag('{"success":true,"id":"abc"}').geweigerd).toBeNull();
    expect(leesOntvangerUitslag('[1,2]').geweigerd).toBeNull();
  });
});

describe('samenvatting', () => {
  it('zet de antwoorden als leesbare tekst achter elkaar, zonder adresvelden', () => {
    expect(samenvatting({ straat: 'Noorderstraat', termijn: 'Binnen 6 maanden', eigenaar_woning: true }, null))
      .toBe('Termijn: Binnen 6 maanden. Eigenaar woning: Ja');
  });

  it('zet notities erachter en slaat lege waarden over', () => {
    expect(samenvatting({ termijn: '', materiaal: 'Kunststof' }, 'Wil 6 kozijnen vervangen'))
      .toBe('Materiaal: Kunststof. Notities: Wil 6 kozijnen vervangen');
  });

  it('geeft null als er niets te melden is', () => {
    expect(samenvatting({ straat: 'X' }, '  ')).toBeNull();
  });

  it('staat standaard uit, zodat bestaande koppelingen geen nieuw veld krijgen', () => {
    const m = defaultFieldMappings().find(f => f.source === 'samenvatting');
    expect(m?.enabled).toBe(false);
  });
});
