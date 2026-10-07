import { describe, expect, it, vi } from 'vitest';
import { geldigeSleutelMetSlot, type TokenStand } from '../teamleader/tokenVernieuwing';
import { tokenFoutmelding } from '../teamleader/oauth';

const NU = 1_000_000_000_000;
const verlopen = (rt: string): TokenStand => ({ accessToken: `oud-${rt}`, refreshToken: rt, verlooptOp: new Date(NU - 1000) });
const vers = (at: string): TokenStand => ({ accessToken: at, refreshToken: `rt-${at}`, verlooptOp: new Date(NU + 3_600_000) });

/** Gedeelde "database" en één slot, zoals in productie. */
function omgeving(begin: TokenStand) {
  let stand: TokenStand | null = begin;
  let slotBezet = false;
  const vernieuwingen: string[] = [];
  const gebruikt = new Set<string>();
  const stappen = () => ({
    lees: async () => stand,
    neemSlot: async () => { if (slotBezet) return false; slotBezet = true; return true; },
    geefSlotTerug: async () => { slotBezet = false; },
    vernieuw: async (rt: string) => {
      /* Teamleader: een vernieuwingssleutel werkt precies één keer. */
      if (gebruikt.has(rt)) throw new Error('Teamleader weigerde de toegang (HTTP 400): invalid_grant');
      gebruikt.add(rt);
      vernieuwingen.push(rt);
      await new Promise(r => setTimeout(r, 5));
      stand = vers(`nieuw-${vernieuwingen.length}`);
      return stand.accessToken;
    },
    wacht: async () => { await new Promise(r => setTimeout(r, 1)); },
    nu: () => NU,
  });
  return { stappen, vernieuwingen, get stand() { return stand; }, zet: (s: TokenStand | null) => { stand = s; } };
}

describe('geldigeSleutelMetSlot', () => {
  it('geldige sleutel: niet vernieuwen', async () => {
    const o = omgeving(vers('a'));
    expect(await geldigeSleutelMetSlot(o.stappen())).toBe('a');
    expect(o.vernieuwingen).toEqual([]);
  });

  it('vier verzoeken tegelijk (portaal): precies één vernieuwing, iedereen dezelfde nieuwe sleutel', async () => {
    const o = omgeving(verlopen('r0'));
    const uit = await Promise.all([0, 1, 2, 3].map(() => geldigeSleutelMetSlot(o.stappen())));
    expect(o.vernieuwingen).toEqual(['r0']);
    expect(new Set(uit)).toEqual(new Set(['nieuw-1']));
    expect(o.stand?.refreshToken).toBe('rt-nieuw-1');
  });

  it('leest na het slot opnieuw: vernieuwde een ander net, dan diens sleutel', async () => {
    const o = omgeving(verlopen('r0'));
    const s = o.stappen();
    let lezingen = 0;
    const r = await geldigeSleutelMetSlot({
      ...s,
      lees: async () => { lezingen++; if (lezingen === 2) o.zet(vers('van-ander')); return s.lees(); },
    });
    expect(r).toBe('van-ander');
    expect(o.vernieuwingen).toEqual([]);
  });

  it('geeft het slot ook terug als vernieuwen mislukt', async () => {
    const o = omgeving(verlopen('r0'));
    const terug = vi.fn(async () => {});
    await expect(geldigeSleutelMetSlot({ ...o.stappen(), geefSlotTerug: terug, vernieuw: async () => { throw new Error('kapot'); } })).rejects.toThrow('kapot');
    expect(terug).toHaveBeenCalledOnce();
  });

  it('wacht niet eeuwig op een slot dat niet vrijkomt', async () => {
    let t = NU;
    await expect(geldigeSleutelMetSlot({
      lees: async () => verlopen('r0'),
      neemSlot: async () => false,
      geefSlotTerug: async () => {},
      vernieuw: async () => 'x',
      wacht: async () => { t += 5_000; },
      nu: () => t,
    })).rejects.toThrow(/al vernieuwd/);
  });

  it('niet leesbaar: opnieuw koppelen nodig', async () => {
    const o = omgeving(verlopen('r0'));
    o.zet(null);
    await expect(geldigeSleutelMetSlot(o.stappen())).rejects.toThrow(/opnieuw koppelen/);
  });
});

describe('tokenFoutmelding', () => {
  it('OAuth-fout met omschrijving', () => {
    expect(tokenFoutmelding(400, '{"error":"invalid_grant","error_description":"The refresh token is invalid."}'))
      .toBe('Teamleader weigerde de toegang (HTTP 400): invalid_grant: The refresh token is invalid.');
  });
  it('Teamleader-foutlijst', () => {
    expect(tokenFoutmelding(400, '{"errors":[{"title":"Client authentication failed","status":400}]}'))
      .toBe('Teamleader weigerde de toegang (HTTP 400): Client authentication failed');
  });
  it('geen JSON: tekst zonder HTML', () => {
    expect(tokenFoutmelding(502, '<html><body>Bad   gateway</body></html>')).toBe('Teamleader weigerde de toegang (HTTP 502): Bad gateway');
  });
  it('leeg antwoord', () => {
    expect(tokenFoutmelding(400, '')).toBe('Teamleader weigerde de toegang (HTTP 400)');
  });
});
