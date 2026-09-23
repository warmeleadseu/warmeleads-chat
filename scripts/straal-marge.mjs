#!/usr/bin/env node
/**
 * Zet de marge rond de doelgebieden van klanten met een actieve batch op een
 * vaste waarde, gerekend vanaf de oorspronkelijke straal.
 *
 * Werkt absoluut, niet met optellen en aftrekken: de nieuwe straal wordt altijd
 * `oorspronkelijk + marge`. Daardoor kun je hem zo vaak draaien als je wilt
 * zonder dat waarden opstapelen, en kun je zonder rekenwerk van 7 naar 5 of
 * terug naar 0.
 *
 * De oorspronkelijke waarden staan in straal-oorspronkelijk.json, de
 * momentopname van vóór de eerste ophoging op 22-9-2026. Dat bestand staat
 * bewust niet in git: het bevat de locaties en stralen van klanten. Zet het
 * naast dit script voor je hem draait.
 *
 * Gebruik (vanuit de projectmap):
 *   set -a && . ./.env.vercel.prod.full && set +a
 *   node scripts/straal-marge.mjs --marge=5           # proefdraai
 *   node scripts/straal-marge.mjs --marge=5 --echt    # uitvoeren
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const ECHT = args.includes('--echt');
const margeArg = args.find((a) => a.startsWith('--marge='));
const MARGE = margeArg ? Number(margeArg.split('=')[1]) : NaN;

if (!Number.isFinite(MARGE) || MARGE < 0 || MARGE > 100) {
  console.error('Geef een marge op tussen 0 en 100, bijvoorbeeld --marge=5');
  process.exit(1);
}

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

const oorspronkelijk = JSON.parse(readFileSync('./straal-oorspronkelijk.json', 'utf8'));
const basis = new Map(oorspronkelijk.map((t) => [t.id, t.radius_km]));

const huidige = await haal('customer_targets?select=id,customer_id,radius_km&is_active=eq.true&target_type=neq.province&limit=1000');
const kaart = new Map(huidige.map((t) => [t.id, t.radius_km]));

const klanten = await haal(`customers?select=id,name&id=in.(${[...new Set(oorspronkelijk.map((t) => t.customer_id))].join(',')})`);
const naam = Object.fromEntries(klanten.map((c) => [c.id, c.name]));

/* Doelen die intussen zijn verwijderd of gedeactiveerd slaan we over in plaats
   van te raden wat ermee moet. */
const teDoen = oorspronkelijk.filter((t) => kaart.has(t.id));
const verdwenen = oorspronkelijk.length - teDoen.length;

console.log(ECHT ? 'UITVOEREN' : 'PROEFDRAAI (niets wordt geschreven)');
console.log(`marge: ${MARGE} km · ${teDoen.length} doelgebieden${verdwenen ? ` (${verdwenen} niet meer aanwezig, overgeslagen)` : ''}\n`);

const perKlant = {};
let wijzigt = 0;
for (const t of teDoen) {
  const nu = kaart.get(t.id);
  const nieuw = basis.get(t.id) + MARGE;
  if (nu !== nieuw) wijzigt++;
  const n = naam[t.customer_id] ?? t.customer_id;
  perKlant[n] = perKlant[n] || [];
  perKlant[n].push(`${nu} -> ${nieuw}`);
}
for (const [n, rijen] of Object.entries(perKlant).sort()) {
  console.log(`  ${n.padEnd(34).slice(0, 34)} ${String(rijen.length).padStart(2)}x   ${rijen.slice(0, 3).join(', ')}${rijen.length > 3 ? ', ...' : ''}`);
}
console.log(`\ndoelen die veranderen: ${wijzigt}`);

if (!ECHT) {
  console.log('Niets gewijzigd. Draai met --echt om het door te voeren.');
  process.exit(0);
}

writeFileSync(`straal-momentopname-voor-marge-${MARGE}.json`, JSON.stringify(huidige.filter((t) => basis.has(t.id)), null, 2));

let ok = 0;
let fout = 0;
for (const t of teDoen) {
  const nieuw = basis.get(t.id) + MARGE;
  if (kaart.get(t.id) === nieuw) { ok++; continue; }
  const r = await fetch(`${url}/rest/v1/customer_targets?id=eq.${t.id}`, {
    method: 'PATCH',
    headers: { ...h, Prefer: 'return=minimal' },
    body: JSON.stringify({ radius_km: nieuw }),
  });
  if (r.status < 400) ok++;
  else { fout++; console.error(`  MISLUKT ${t.id}: ${r.status}`); }
}
console.log(`bijgewerkt of al goed: ${ok} | mislukt: ${fout}`);

const na = await haal('customer_targets?select=id,radius_km&is_active=eq.true&target_type=neq.province&limit=1000');
const naKaart = new Map(na.map((t) => [t.id, t.radius_km]));
const afwijkend = teDoen.filter((t) => naKaart.get(t.id) !== basis.get(t.id) + MARGE);
console.log(`controle: afwijkend ${afwijkend.length} van ${teDoen.length}`);
if (afwijkend.length) process.exitCode = 1;
