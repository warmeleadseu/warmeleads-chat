import { describe, expect, it } from 'vitest';
import { antwoordenUitFormulier, brancheUitCampagne, lekAdvertenties } from '../metaLekInhaal';

describe('lekkende advertenties zelf inhalen', () => {
  it('herkent de branche uit de campagnenaam', () => {
    expect(brancheUitCampagne('Thuisbatterij | Energiekompas - Enschede - Kopie')).toBe('thuisbatterij');
    expect(brancheUitCampagne('Warmtepomp | Energiekompas - Enschede 6')).toBe('warmtepomp');
    expect(brancheUitCampagne('Thuisbatterij partners | Werving')).toBeNull();
    expect(brancheUitCampagne('PakketAdvies | Energie')).toBeNull();
    expect(brancheUitCampagne('Iets anders')).toBeNull();
    expect(brancheUitCampagne(null)).toBeNull();
  });

  it('alleen advertenties waarvan bij ons nooit iets binnenkwam', () => {
    const spend = [
      { ad_id: 'lek', campaign_id: 'c', campaign_name: 'Thuisbatterij | Energiekompas - Enschede - Kopie', leads_count: 3 },
      { ad_id: 'lek', campaign_id: 'c', campaign_name: 'Thuisbatterij | Energiekompas - Enschede - Kopie', leads_count: 3 },
      { ad_id: 'goed', campaign_id: 'c', campaign_name: 'Thuisbatterij | Energiekompas - Enschede - Kopie', leads_count: 5 },
      { ad_id: 'stil', campaign_id: 'c', campaign_name: 'Thuisbatterij | X', leads_count: 0 },
      { ad_id: 'partner', campaign_id: 'p', campaign_name: 'Warmtepomp partners | Y', leads_count: 4 },
    ];
    const r = lekAdvertenties(spend, new Map([['goed', 5]]));
    expect(r).toEqual([{ ad_id: 'lek', campaign_id: 'c', campaign_name: 'Thuisbatterij | Energiekompas - Enschede - Kopie', branch: 'thuisbatterij', metaLeads: 6 }]);
  });

  it('neemt de antwoorden over zonder naam, adres en contactgegevens', () => {
    const velden = [
      { name: 'full_name', values: ['Jan'] },
      { name: 'email', values: ['jan@x.nl'] },
      { name: 'phone_number', values: ['0612345678'] },
      { name: 'post_code', values: ['7511AA'] },
      { name: 'heb_je_zonnepanelen?', values: ['ja'] },
      { name: 'wanneer_wil_je_starten?', values: ['binnen_3_maanden'] },
      { name: 'leeg', values: [] },
    ];
    expect(antwoordenUitFormulier(velden, { 'heb_je_zonnepanelen?': 'zonnepanelen' })).toEqual({
      zonnepanelen: 'ja',
      'wanneer_wil_je_starten?': 'binnen_3_maanden',
    });
  });
});
