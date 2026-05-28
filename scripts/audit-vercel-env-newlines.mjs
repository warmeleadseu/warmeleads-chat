#!/usr/bin/env node
/**
 * Controleer Vercel env vars op trailing/leading newlines en fix ze desnoods.
 *
 *   node scripts/audit-vercel-env-newlines.mjs          # audit only
 *   node scripts/audit-vercel-env-newlines.mjs --fix    # update op Vercel
 */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const FIX = process.argv.includes('--fix');
const VERBOSE = process.argv.includes('--verbose');
const project = JSON.parse(readFileSync(resolve(process.cwd(), '.vercel/project.json'), 'utf8'));
const PROJECT_ID = project.projectId;
const TEAM_ID = project.orgId;
const TOKEN = JSON.parse(
  readFileSync(`${process.env.HOME}/Library/Application Support/com.vercel.cli/auth.json`, 'utf8'),
).token;

const HEADERS = { Authorization: `Bearer ${TOKEN}` };

/** Keys waar echte newlines of \\n in de waarde normaal zijn. */
const ALLOW_INTERNAL_NEWLINES = new Set(['GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY']);

function stripEnvValue(value) {
  if (value == null) return '';
  return String(value).replace(/[\r\n\u2028\u2029]+/g, '').trim();
}

function auditValue(key, value) {
  const problems = [];
  if (value == null || value === '') return problems;

  if (/^[\r\n\u2028\u2029]/.test(value)) problems.push('leading-newline');
  if (/[\r\n\u2028\u2029]$/.test(value)) problems.push('trailing-newline');
  if (/^\s/.test(value) && !/^[\r\n\u2028\u2029]/.test(value)) problems.push('leading-space');
  if (/\s$/.test(value) && !/[\r\n\u2028\u2029]$/.test(value)) problems.push('trailing-space');

  if (!ALLOW_INTERNAL_NEWLINES.has(key)) {
    const inner = value.replace(/^[\r\n\u2028\u2029\s]+|[\r\n\u2028\u2029\s]+$/g, '');
    if (/[\r\n\u2028\u2029]/.test(inner)) problems.push('internal-newline');
  } else if (key === 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY' && /[\r\n\u2028\u2029]/.test(value)) {
    problems.push('pem-real-newlines-use-literal-backslash-n');
  }

  return problems;
}

function fixValue(key, value, problems) {
  if (problems.includes('pem-real-newlines-use-literal-backslash-n')) {
    return value.trim().replace(/\r?\n/g, '\\n');
  }
  return stripEnvValue(value);
}

async function listEnvs() {
  const res = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Vercel list API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.envs ?? [];
}

async function decryptEnv(id) {
  const res = await fetch(
    `https://api.vercel.com/v1/projects/${PROJECT_ID}/env/${id}?decrypt=true&teamId=${TEAM_ID}`,
    { headers: HEADERS },
  );
  if (!res.ok) throw new Error(`Vercel decrypt API ${res.status} for ${id}: ${await res.text()}`);
  return res.json();
}

function updateEnv(key, target, value) {
  execSync(`printf '%s' ${JSON.stringify(value)} | vercel env update ${key} ${target}`, {
    stdio: 'inherit',
    shell: true,
  });
}

const rows = await listEnvs();
const issues = [];
let checked = 0;

for (const row of rows) {
  const decrypted = await decryptEnv(row.id);
  const key = decrypted.key ?? row.key;
  const targets = decrypted.target ?? row.target ?? [];
  const value = decrypted.value ?? '';
  checked += 1;

  const problems = auditValue(key, value);
  if (problems.length === 0) {
    if (VERBOSE) console.log(`  ok ${key} [${targets.join(', ')}] (len ${value.length})`);
    continue;
  }

  const cleaned = fixValue(key, value, problems);
  issues.push({
    id: row.id,
    key,
    targets,
    problems,
    beforeLen: value.length,
    afterLen: cleaned.length,
    cleaned,
  });
}

if (issues.length === 0) {
  console.log(`✓ Alle ${checked} Vercel env entries zijn schoon (geen newlines/spaties aan de rand).`);
  process.exit(0);
}

console.log(`⚠ ${issues.length} env entry(s) met whitespace/newline-problemen:\n`);
for (const i of issues) {
  console.log(
    `  ${i.key} [${i.targets.join(', ')}] — ${i.problems.join(', ')} (${i.beforeLen} → ${i.afterLen} chars)`,
  );
}

if (!FIX) {
  console.log('\nRun met --fix om op te schonen via `vercel env update`.');
  process.exit(1);
}

console.log('\nFixing…');
for (const i of issues) {
  for (const target of i.targets) {
    console.log(`→ ${i.key} (${target})`);
    updateEnv(i.key, target, i.cleaned);
  }
}
console.log('\n✓ Klaar. Redeploy production/preview om wijzigingen actief te maken.');
