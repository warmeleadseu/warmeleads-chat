import { describe, it, expect, beforeEach, vi } from 'vitest';
import { leesVoorkeur, bewaarVoorkeur, isWeergave, opslagSleutel, WEERGAVEN, WEERGAVE_LABELS } from '../weergaveVoorkeur';

function maakOpslag() {
  const kluis = new Map<string, string>();
  return {
    getItem: (k: string) => kluis.get(k) ?? null,
    setItem: (k: string, v: string) => { kluis.set(k, v); },
    removeItem: (k: string) => { kluis.delete(k); },
    clear: () => kluis.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: maakOpslag() });
});

describe('isWeergave', () => {
  it('herkent de bestaande weergaven', () => {
    for (const w of WEERGAVEN) expect(isWeergave(w)).toBe(true);
  });

  it('wijst onzin af', () => {
    expect(isWeergave('galerij')).toBe(false);
    expect(isWeergave(null)).toBe(false);
    expect(isWeergave(3)).toBe(false);
  });
});

describe('voorkeur bewaren en lezen', () => {
  it('geeft de standaard terug als er niets is opgeslagen', () => {
    expect(leesVoorkeur('branches')).toBe('tabel');
    expect(leesVoorkeur('branches', 'kaarten')).toBe('kaarten');
  });

  it('leest terug wat er is bewaard', () => {
    bewaarVoorkeur('branches', 'compact');
    expect(leesVoorkeur('branches')).toBe('compact');
  });

  it('houdt pagina\'s uit elkaar', () => {
    /* Anders verandert een keuze op Branches ook die op Koppelingen. */
    bewaarVoorkeur('branches', 'compact');
    bewaarVoorkeur('koppelingen', 'kaarten');
    expect(leesVoorkeur('branches')).toBe('compact');
    expect(leesVoorkeur('koppelingen')).toBe('kaarten');
    expect(opslagSleutel('branches')).not.toBe(opslagSleutel('koppelingen'));
  });

  it('valt terug op de standaard bij een onbekende opgeslagen waarde', () => {
    /* Hernoemen we ooit een weergave, dan mag een oude waarde in iemands
       browser de pagina niet leeg laten. */
    window.localStorage.setItem(opslagSleutel('branches'), 'galerij');
    expect(leesVoorkeur('branches')).toBe('tabel');
  });

  it('valt terug op de standaard zonder browser', () => {
    vi.stubGlobal('window', undefined);
    expect(leesVoorkeur('branches')).toBe('tabel');
    expect(() => bewaarVoorkeur('branches', 'compact')).not.toThrow();
  });

  it('klapt niet als de opslag geweigerd wordt', () => {
    /* Privémodus of geblokkeerde site-data. */
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('geblokkeerd'); },
        setItem: () => { throw new Error('geblokkeerd'); },
      },
    });
    expect(leesVoorkeur('branches')).toBe('tabel');
    expect(() => bewaarVoorkeur('branches', 'compact')).not.toThrow();
  });
});

describe('labels', () => {
  it('heeft een label voor elke weergave', () => {
    for (const w of WEERGAVEN) expect(WEERGAVE_LABELS[w]).toBeTruthy();
  });
});
