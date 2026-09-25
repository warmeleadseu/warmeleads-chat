import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { decryptSecret, encryptSecret } from '@/lib/integrations/tokenEncrypt';

describe('integration token encrypt', () => {
  const prev = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY =
      'test-integration-encryption-key-32chars!!';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
    else process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = prev;
  });

  it('roundtrips secrets', () => {
    const plain = 'refresh_token_abc123_xyz';
    const enc = encryptSecret(plain);
    expect(enc).not.toBe(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });
});

describe('sleutelketen bij ontsleutelen', () => {
  const zetSleutels = (eigen?: string, sessie?: string) => {
    if (eigen === undefined) delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
    else process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = eigen;
    if (sessie === undefined) delete process.env.APP_SESSION_SECRET;
    else process.env.APP_SESSION_SECRET = sessie;
  };

  it('leest een token dat nog met het sessiegeheim is opgeslagen', async () => {
    /* De reden dat de terugval bestaat: bij Kpi Sales en ofrt.nl staan tokens
       die met het sessiegeheim zijn versleuteld en die moeten blijven werken. */
    const { encryptSecret, decryptSecret } = await import('@/lib/integrations/tokenEncrypt');
    zetSleutels(undefined, 'een-sessiegeheim-van-ruim-32-tekens-lang');
    const oud = encryptSecret('gl_oud_token');

    zetSleutels('een-eigen-sleutel-van-ruim-32-tekens-lang', 'een-sessiegeheim-van-ruim-32-tekens-lang');
    expect(decryptSecret(oud)).toBe('gl_oud_token');
  });

  it('versleutelt nieuw met de eigen sleutel', async () => {
    const { encryptSecret, decryptSecret } = await import('@/lib/integrations/tokenEncrypt');
    zetSleutels('een-eigen-sleutel-van-ruim-32-tekens-lang', 'een-sessiegeheim-van-ruim-32-tekens-lang');
    const nieuw = encryptSecret('gl_nieuw_token');

    /* Zonder sessiegeheim moet hij nog steeds leesbaar zijn: het hangt er niet
       langer aan vast. Dat is precies wat deze wijziging moest bereiken. */
    zetSleutels('een-eigen-sleutel-van-ruim-32-tekens-lang', undefined);
    expect(decryptSecret(nieuw)).toBe('gl_nieuw_token');
  });

  it('weigert een token dat met geen enkele sleutel klopt', async () => {
    const { encryptSecret, decryptSecret } = await import('@/lib/integrations/tokenEncrypt');
    zetSleutels('sleutel-a-van-ruim-tweeendertig-tekens', undefined);
    const met_a = encryptSecret('geheim');
    zetSleutels('sleutel-b-van-ruim-tweeendertig-tekens', 'sleutel-c-van-ruim-tweeendertig-tekens');
    expect(() => decryptSecret(met_a)).toThrow();
  });
});
