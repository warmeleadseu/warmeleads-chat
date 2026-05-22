import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { getRawSessionSecret } from '@/lib/sessionSecrets';
import { stripEnvValue } from '@/lib/teamleader/credentials';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT = 'warmeleads-integration-v1';

function encryptionKey(): Buffer {
  const raw =
    stripEnvValue(process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY) || getRawSessionSecret();
  return scryptSync(raw, SALT, 32);
}

/** ciphertext format: base64(iv || tag || encrypted) */
export function encryptSecret(plain: string): string {
  const key = encryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(encoded: string): string {
  const key = encryptionKey();
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
