import { describe, expect, it } from 'vitest';
import { bouwSlides, huidigeIndex, leesDuur, leesVasteSlide, onderwerpen, paginaVan, stapIndex } from '../liveSlides';

const vol = { batches: 13, heeftGeld: true, heeftTeam: true };

describe('live-dashboard slides', () => {
  it('zet de onderwerpen in vaste volgorde en verdeelt batches over pagina’s', () => {
    const s = bouwSlides(vol);
    expect(s.map(x => x.key)).toEqual(['vandaag', 'batches-1', 'batches-2', 'geld', 'team']);
    expect(s[1]).toMatchObject({ pagina: 1, paginas: 2, duurMs: 12_000 });
    expect(s[0].duurMs).toBe(15_000);
  });
  it('één batchpagina krijgt de gewone duur', () => {
    expect(bouwSlides({ ...vol, batches: 8 }).find(x => x.id === 'batches')?.duurMs).toBe(15_000);
  });
  it('slaat lege slides over; Vandaag staat er altijd', () => {
    expect(bouwSlides({ batches: 0, heeftGeld: false, heeftTeam: false }).map(x => x.key)).toEqual(['vandaag']);
    expect(bouwSlides({ batches: 3, heeftGeld: false, heeftTeam: true }).map(x => x.key)).toEqual(['vandaag', 'batches-1', 'team']);
  });
  it('past de duur toe en zet desgewenst vast op één onderwerp', () => {
    expect(bouwSlides(vol, { duurSec: 20 })[0].duurMs).toBe(20_000);
    expect(bouwSlides(vol, { vast: 'batches' }).map(x => x.key)).toEqual(['batches-1', 'batches-2']);
    /* Vastgezet op iets dat er niet is: gewoon alles tonen in plaats van een leeg scherm. */
    expect(bouwSlides({ ...vol, heeftGeld: false }, { vast: 'geld' })).toHaveLength(4);
  });
  it('leest de URL-instellingen veilig', () => {
    expect(leesVasteSlide('Batches')).toBe('batches');
    expect(leesVasteSlide('kaart')).toBeNull();
    expect(leesVasteSlide(null)).toBeNull();
    expect(leesDuur('20')).toBe(20);
    expect(leesDuur('2')).toBe(5);
    expect(leesDuur('999')).toBe(120);
    expect(leesDuur('abc')).toBe(15);
    expect(leesDuur(null)).toBe(15);
  });
  it('houdt de plek vast als de data ververst', () => {
    const s = bouwSlides(vol);
    expect(huidigeIndex(s, 'geld')).toBe(3);
    /* Pagina 2 bestaat niet meer: laatste batchpagina. */
    expect(huidigeIndex(bouwSlides({ ...vol, batches: 5 }), 'batches-2')).toBe(1);
    /* Geen batches meer: door naar het volgende onderwerp. */
    expect(huidigeIndex(bouwSlides({ ...vol, batches: 0 }), 'batches-1')).toBe(1);
    expect(huidigeIndex(bouwSlides({ batches: 0, heeftGeld: false, heeftTeam: false }), 'team')).toBe(0);
    expect(huidigeIndex(s, null)).toBe(0);
  });
  it('bladert rond in beide richtingen', () => {
    expect(stapIndex(4, 5, 1)).toBe(0);
    expect(stapIndex(0, 5, -1)).toBe(4);
    expect(stapIndex(0, 0, 1)).toBe(0);
  });
  it('groepeert pagina’s tot één onderwerp en knipt de batches per pagina', () => {
    expect(onderwerpen(bouwSlides(vol)).map(o => [o.id, o.eersteIndex, o.paginas])).toEqual([
      ['vandaag', 0, 1], ['batches', 1, 2], ['geld', 3, 1], ['team', 4, 1],
    ]);
    const items = Array.from({ length: 13 }, (_, i) => i);
    expect(paginaVan(items, 2)).toEqual([8, 9, 10, 11, 12]);
    expect(paginaVan(items, 1)).toHaveLength(8);
  });
});
