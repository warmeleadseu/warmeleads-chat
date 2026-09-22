#!/usr/bin/env node
/**
 * Hoogt de straal van alle actieve straal-doelgebieden op met 3 km.
 *
 * Vervolg op de ophoging van 7 km op 22-9-2026. Samen dekt dat de band van
 * 5 t/m 10 km die eerder buiten beeld viel: wie 10 km buiten het gebied lag,
 * valt er daarna binnen.
 *
 * Alleen klanten MET een actieve batch; doelen van klanten zonder actieve
 * batch blijven ongemoeid.
 *
 * Gebruik (vanuit de projectmap):
 *   set -a && . ./.env.vercel.prod.full && set +a && node scripts/straal-plus-3km.mjs
 *
 * Zonder --echt draait hij als proef en schrijft hij niets.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ECHT = process.argv.includes('--echt');
const ERBIJ = 3;
const MOMENTOPNAME = 'straal-momentopname-voor-plus3.json';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Zet eerst de omgeving: set -a && . ./.env.vercel.prod.full && set +a');
  process.exit(1);
}
const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

const haal = async (pad) => {
  const r = await fetch(`${url}/rest/v1/${pad}`, { headers: h });
  if (!r.ok) throw new Error(`${pad} -> ${r.status} ${await r.text()}`);
  return r.json();
};

const batches = await haal('customer_batches?select=customer_id&status=eq.active');
const actief = new Set(batches.map((b) => b.customer_id));

const targets = await haal('customer_targets?select=*&is_active=eq.true&target_type=neq.province&limit=1000');
const scope = targets.filter((t) => t.radius_km != null && t.lat != null && actief.has(t.customer_id));

const klanten = await haal(`customers?select=id,name&id=in.(${[...actief].join(',')})`);
const naam = Object.fromEntries(klanten.map((c) => [c.id, c.name]));

console.log(`${ECHT ? 'UITVOEREN' : 'PROEFDRAAI (niets wordt geschreven)'}`);
console.log(`${scope.length} doelgebieden bij ${new Set(scope.map((t) => t.customer_id)).size} klanten\n`);

const perKlant = {};
for (const t of scope) {
  const n = naam[t.customer_id] ?? t.customer_id;
  perKlant[n] = perKlant[n] || [];
  perKlant[n].push(`${t.radius_km} -> ${t.radius_km + ERBIJ} km`);
}
for (const [n, rijen] of Object.entries(perKlant).sort()) {
  console.log(`  ${n.padEnd(34).slice(0, 34)} ${rijen.length}x   ${rijen.slice(0, 3).join(', ')}${rijen.length > 3 ? ', ...' : ''}`);
}

if (!ECHT) {
  console.log('\nNiets gewijzigd. Draai met --echt om het door te voeren.');
  process.exit(0);
}

writeFileSync(MOMENTOPNAME, JSON.stringify(scope, null, 2));
console.log(`\nMomentopname weggeschreven naar ${MOMENTOPNAME}`);

let ok = 0;
let fout = 0;
for (const t of scope) {
  const r = await fetch(`${url}/rest/v1/customer_targets?id=eq.${t.id}`, {
    method: 'PATCH',
    headers: { ...h, Prefer: 'return=minimal' },
    body: JSON.stringify({ radius_km: t.radius_km + ERBIJ }),
  });
  if (r.status < 400) ok++;
  else {
    fout++;
    console.error(`  MISLUKT ${t.id}: ${r.status}`);
  }
}
console.log(`bijgewerkt: ${ok} | mislukt: ${fout}`);

/* Controle achteraf: staat elk doel op de verwachte nieuwe waarde? */
const na = await haal('customer_targets?select=id,radius_km&is_active=eq.true&target_type=neq.province&limit=1000');
const kaart = new Map(na.map((t) => [t.id, t.radius_km]));
const afwijkend = scope.filter((t) => kaart.get(t.id) !== t.radius_km + ERBIJ);
console.log(`controle: afwijkend ${afwijkend.length} van ${scope.length}`);
if (afwijkend.length) process.exitCode = 1;
