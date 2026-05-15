#!/usr/bin/env node
/**
 * Voert supabase/migrations/103_batch_delivery_daily.sql uit op het gehoste project
 * via de Supabase Management API (vereist Personal Access Token, prefix sbp_).
 *
 * Gebruik:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-migration-103-management.mjs
 *
 * Optioneel: SUPABASE_PROJECT_REF=qwfkcpwxoymhpfdthpqv (default uit NEXT_PUBLIC_SUPABASE_URL in .env.local)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const migrationPath = resolve(root, 'supabase/migrations/103_batch_delivery_daily.sql');

function loadEnvLocal() {
  const p = resolve(root, '.env.local');
  if (!existsSync(p)) return;
  const text = readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function projectRefFromUrl(url) {
  const m = String(url).match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

loadEnvLocal();

const token = process.env.SUPABASE_ACCESS_TOKEN;
let ref = process.env.SUPABASE_PROJECT_REF;
if (!ref && process.env.NEXT_PUBLIC_SUPABASE_URL)
  ref = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

if (!token || !token.startsWith('sbp_')) {
  console.error(
    'Geen geldige SUPABASE_ACCESS_TOKEN (Supabase PAT, begint met sbp_). ' +
      'De service role key uit .env.local werkt niet op de Management API.'
  );
  process.exit(1);
}
if (!ref) {
  console.error('Geen project ref: zet SUPABASE_PROJECT_REF of NEXT_PUBLIC_SUPABASE_URL.');
  process.exit(1);
}

const sql = readFileSync(migrationPath, 'utf8');
const url = `https://api.supabase.com/v1/projects/${ref}/database/query`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const bodyText = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}:`, bodyText);
  process.exit(1);
}

console.log('Migratie 103 succesvol uitgevoerd op project', ref);
if (bodyText) console.log(bodyText);
