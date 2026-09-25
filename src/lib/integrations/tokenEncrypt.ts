import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { getRawSessionSecret } from '@/lib/sessionSecrets';
import { stripEnvValue } from '@/lib/teamleader/credentials';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT = 'warmeleads-integration-v1';

/**
 * De sleutels waarmee we integratietokens versleutelen, op volgorde.
 *
 * Voorheen viel dit terug op het sessiegeheim. Dat koppelt twee dingen aan
 * elkaar die niets met elkaar te maken hebben: vervang je het sessiegeheim,
 * dan is in één klap géén enkel integratietoken meer te ontsleutelen, en dat
 * merk je pas als een klant belt dat zijn leads niet aankomen.
 *
 * Erger nog: het sessiegeheim staat bij Vercel als "sensitive", dus wie het
 * ophaalt krijgt niet de waarde maar de tekst `[SENSITIVE]`. Een token dat
 * buiten productie is opgeslagen werd daarmee met die placeholder versleuteld
 * en was in productie onleesbaar. De koppeling stuurde dan geen
 * `Authorization`-header mee en de ontvanger antwoordde met "invalid or
 * missing API key" — een foutmelding die naar de verkeerde kant wijst.
 *
 * Daarom nu een eigen sleutel, met het sessiegeheim als terugval zodat alles
 * wat er al in staat gewoon leesbaar blijft.
 */
function encryptionKeys(): Buffer[] {
  const sleutels: string[] = [];
  const eigen = stripEnvValue(process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY);
  if (eigen) sleutels.push(eigen);
  try {
    sleutels.push(getRawSessionSecret());
  } catch {
    /* Geen sessiegeheim beschikbaar: dan blijft alleen de eigen sleutel over. */
  }
  if (sleutels.length === 0) {
    throw new Error('Geen sleutel om integratietokens mee te versleutelen.');
  }
  return sleutels.map((raw) => scryptSync(raw, SALT, 32));
}

/** Versleutelen doen we altijd met de eerste sleutel. */
function encryptionKey(): Buffer {
  return encryptionKeys()[0];
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
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);

  /* Probeer elke sleutel. Tokens die met het oude sessiegeheim zijn opgeslagen
     blijven zo gewoon werken; er hoeft niets gemigreerd te worden. */
  let laatste: unknown = null;
  for (const key of encryptionKeys()) {
    try {
      const decipher = createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch (err) {
      laatste = err;
    }
  }
  throw laatste instanceof Error ? laatste : new Error('Ontsleutelen mislukt');
}
