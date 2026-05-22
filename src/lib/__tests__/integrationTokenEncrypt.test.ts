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
