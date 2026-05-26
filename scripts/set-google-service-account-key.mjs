#!/usr/bin/env node
/**
 * Zet GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env.local en Vercel (alle omgevingen).
 * Gebruik: node scripts/set-google-service-account-key.mjs /pad/naar/service-account.json
 *
 * JSON downloaden: Google Cloud Console → IAM → Service accounts →
 * warmeleads-sheets@light-footing-452919-u7 → Keys → Add key → JSON
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Gebruik: node scripts/set-google-service-account-key.mjs <service-account.json>');
  process.exit(1);
}

const json = JSON.parse(readFileSync(resolve(jsonPath), 'utf8'));
const email = json.client_email?.trim();
const privateKey = json.private_key?.trim();
if (!privateKey?.includes('BEGIN PRIVATE KEY')) {
  console.error('Ongeldig JSON: private_key ontbreekt');
  process.exit(1);
}
if (email && !email.includes('light-footing-452919')) {
  console.warn(`Waarschuwing: verwacht project light-footing-452919, got ${email}`);
}

/** Vercel env: één regel met \\n tussen PEM-regels */
const vercelValue = privateKey.replace(/\r?\n/g, '\\n');

const envLocalPath = resolve(process.cwd(), '.env.local');
let envText = '';
try {
  envText = readFileSync(envLocalPath, 'utf8');
} catch {
  envText = '';
}

const keyName = 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY';
const managedKeys = new Set([keyName, 'GOOGLE_SERVICE_ACCOUNT_EMAIL']);
const lines = envText
  .split('\n')
  .filter((line) => {
    const k = line.match(/^([A-Z0-9_]+)=/)?.[1];
    return !k || !managedKeys.has(k);
  });
while (lines.length && lines[lines.length - 1] === '') lines.pop();
if (email) lines.push(`GOOGLE_SERVICE_ACCOUNT_EMAIL=${email}`);
lines.push(`${keyName}="${vercelValue}"`);
writeFileSync(envLocalPath, `${lines.join('\n')}\n`);
console.log('✓ .env.local bijgewerkt');

for (const env of ['production', 'preview', 'development']) {
  try {
    execSync(`vercel env rm ${keyName} ${env} --yes`, { stdio: 'pipe' });
  } catch {
    /* bestaat nog niet */
  }
  execSync(`printf '%s' ${JSON.stringify(vercelValue)} | vercel env add ${keyName} ${env}`, {
    stdio: 'inherit',
    shell: true,
  });
  console.log(`✓ Vercel ${env}: ${keyName}`);
}

console.log('\nKlaar. Redeploy production op Vercel om de nieuwe env actief te maken.');
