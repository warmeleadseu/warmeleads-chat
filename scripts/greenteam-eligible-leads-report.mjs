#!/usr/bin/env node
/**
 * Thuisbatterij-leads op datum: hoeveel voldoen aan Greenteam maar zijn nog niet bij hen ingeladen.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full'), override: true });

const GREENTEAM_PATTERN = process.env.GREENTEAM_NAME || 'Greenteam';
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DATE_START = args[0] || '2026-05-26';
const DATE_END = args[1] || '2026-05-27';
const DATE_FIELD = process.argv.includes('--created-at') ? 'created_at' : 'wervingsdatum';

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Inline province match (same logic as provinceTargetMatch.ts)
const PROVINCES_BE = [
  'Antwerpen', 'Limburg', 'Oost-Vlaanderen', 'West-Vlaanderen', 'Vlaams-Brabant', 'Waals-Brabant',
  'Henegouwen', 'Luik', 'Luxemburg', 'Namen',
];
const PROVINCES_NL = [
  'Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen', 'Limburg', 'Noord-Brabant',
  'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland',
];

function normalizeProvincie(p) {
  if (!p) return '';
  const s = String(p).trim();
  const map = {
    'Noord Holland': 'Noord-Holland', 'Zuid Holland': 'Zuid-Holland', 'Noord Brabant': 'Noord-Brabant',
    'Fryslân': 'Friesland', 'Friesland': 'Friesland',
  };
  return map[s] || s;
}

function parseProvinceTargetToken(token) {
  const trimmed = token.trim();
  if (trimmed === 'Limburg (BE)') return { land: 'BE', name: 'Limburg' };
  if (trimmed === 'Limburg (NL)') return { land: 'NL', name: 'Limburg' };
  const m = trimmed.match(/^(NL|BE):(.+)$/);
  if (m) return { land: m[1], name: m[2] };
  return { land: null, name: normalizeProvincie(trimmed) || trimmed };
}

function resolveLeadLand(lead) {
  const raw = lead.land?.trim().toUpperCase();
  if (raw === 'NL' || raw === 'BE') return raw;
  const pc = (lead.postcode || '').replace(/\s/g, '').toUpperCase();
  if (/^\d{4}[A-Z]{2}$/.test(pc)) return 'NL';
  if (/^\d{4}$/.test(pc)) {
    const n = parseInt(pc, 10);
    if (n >= 1000 && n <= 9999) return 'BE';
  }
  return null;
}

function leadMatchesProvinceTarget(lead, targetToken) {
  const leadProv = normalizeProvincie(lead.provincie || '');
  if (!leadProv) return false;
  const parsed = parseProvinceTargetToken(targetToken);
  const targetName = normalizeProvincie(parsed.name) || parsed.name;
  if (leadProv !== targetName) return false;
  let requiredLand = parsed.land;
  if (!requiredLand) {
    if (targetName === 'Limburg') return false;
    if (PROVINCES_BE.includes(targetName)) requiredLand = 'BE';
    else if (PROVINCES_NL.includes(targetName)) requiredLand = 'NL';
    else return false;
  }
  const leadLand = resolveLeadLand(lead);
  if (!leadLand) return false;
  return leadLand === requiredLand;
}

function leadMatchesGreenteamTarget(lead, targets) {
  const hasCoords = lead.lat != null && lead.lng != null;
  const hasProv = !!lead.provincie;
  if (!hasCoords && !hasProv) return false;

  for (const t of targets) {
    if ((t.target_type || 'radius') === 'province') {
      const provs = Array.isArray(t.provinces) ? t.provinces : [];
      if (provs.some((p) => leadMatchesProvinceTarget(lead, p))) return true;
    } else if (hasCoords) {
      const dist = haversineKm(Number(lead.lat), Number(lead.lng), t.lat, t.lng);
      if (dist <= t.radius_km) return true;
    }
  }
  return false;
}

function dayBoundsAmsterdam(dateStr) {
  // Europe/Amsterdam calendar day → UTC range
  const start = new Date(`${dateStr}T00:00:00+02:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString(), label: dateStr };
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: customers } = await sb
  .from('customers')
  .select('id, name')
  .ilike('name', `%${GREENTEAM_PATTERN}%`);
const customer = customers?.[0];
if (!customer) {
  console.error('Greenteam klant niet gevonden');
  process.exit(1);
}

const { data: targets } = await sb
  .from('customer_targets')
  .select('label, lat, lng, radius_km, target_type, provinces')
  .eq('customer_id', customer.id)
  .eq('is_active', true);

console.log(`\nKlant: ${customer.name} (${customer.id})`);
console.log(`Periode: ${DATE_START} t/m ${DATE_END} | datumveld: ${DATE_FIELD} (NL-tijd)`);
for (const t of targets || []) {
  if ((t.target_type || 'radius') === 'province') {
    console.log(`  - ${t.label}: provincies ${(t.provinces || []).join(', ')}`);
  } else {
    console.log(`  - ${t.label}: ${t.radius_km}km rond (${t.lat}, ${t.lng})`);
  }
}

const days = [];
let d = new Date(DATE_START);
const endD = new Date(DATE_END);
while (d <= endD) {
  days.push(d.toISOString().slice(0, 10));
  d.setDate(d.getDate() + 1);
}

let totalInPeriod = 0;
let totalValidPhone = 0;
let totalInTarget = 0;
let totalNotAtGreenteam = 0;
const eligibleLeads = [];

for (const day of days) {
  const { start, end } = dayBoundsAmsterdam(day);
  const { data: leads, error } = await sb
    .from('leads')
    .select(
      'id, naam_klant, postcode, plaatsnaam, provincie, lat, lng, phone_valid, created_at, wervingsdatum, bron, land',
    )
    .eq('branch', 'thuisbatterij')
    .gte(DATE_FIELD, start)
    .lt(DATE_FIELD, end)
    .order(DATE_FIELD, { ascending: true });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const rows = leads || [];
  const validPhone = rows.filter((l) => l.phone_valid !== false);
  const inTarget = validPhone.filter((l) => leadMatchesGreenteamTarget(l, targets || []));
  const noGeo = validPhone.filter(
    (l) => !leadMatchesGreenteamTarget(l, targets || []) && !(l.lat && l.lng) && !l.provincie,
  );
  const wrongArea = validPhone.length - inTarget.length - noGeo.length;

  totalInPeriod += rows.length;
  totalValidPhone += validPhone.length;
  totalInTarget += inTarget.length;

  console.log(`\n── ${day} (${DATE_FIELD}, NL-tijd) ──`);
  console.log(`  Totaal thuisbatterij leads: ${rows.length}`);
  console.log(`  Geldig telefoonnummer: ${validPhone.length}`);
  console.log(`  In Greenteam targetgebied: ${inTarget.length}`);
  if (noGeo.length) console.log(`  Geen geo/provincie (niet matchbaar): ${noGeo.length}`);
  if (wrongArea) console.log(`  Buiten targetgebied: ${wrongArea}`);

  for (const l of inTarget) {
    eligibleLeads.push({ ...l, day });
  }
}

if (eligibleLeads.length === 0) {
  console.log('\nGeen eligible leads in targetgebied voor deze periode.');
  process.exit(0);
}

const leadIds = eligibleLeads.map((l) => l.id);
const { data: gtAssigns } = await sb
  .from('lead_assignments')
  .select('lead_id')
  .in('lead_id', leadIds)
  .eq('customer_id', customer.id);

const atGreenteam = new Set((gtAssigns || []).map((a) => a.lead_id));
const notAtGreenteam = eligibleLeads.filter((l) => !atGreenteam.has(l.id));
totalNotAtGreenteam = notAtGreenteam.length;

const { data: allAssigns } = await sb
  .from('lead_assignments')
  .select('lead_id, customer_id, customers(name)')
  .in('lead_id', notAtGreenteam.map((l) => l.id));

const assignsByLead = new Map();
for (const a of allAssigns || []) {
  if (!assignsByLead.has(a.lead_id)) assignsByLead.set(a.lead_id, []);
  assignsByLead.get(a.lead_id).push(a.customers?.name || a.customer_id);
}

console.log('\n════════════════════════════════════════');
console.log(`SAMENVATTING ${DATE_START} t/m ${DATE_END}`);
console.log(`  Leads gegenereerd (thuisbatterij): ${totalInPeriod}`);
console.log(`  Met geldig telefoonnummer: ${totalValidPhone}`);
console.log(`  In Greenteam targetgebied: ${totalInTarget}`);
console.log(`  → Nog NIET bij Greenteam, wél inladen: ${totalNotAtGreenteam}`);
console.log(`  Al bij Greenteam: ${totalInTarget - totalNotAtGreenteam}`);
console.log('════════════════════════════════════════');

if (notAtGreenteam.length > 0 && notAtGreenteam.length <= 40) {
  console.log('\nDetail (nog niet bij Greenteam):');
  for (const l of notAtGreenteam) {
    const others = assignsByLead.get(l.id) || [];
    console.log(
      `  ${l.day} | ${l.naam_klant || '—'} | ${l.postcode || ''} ${l.plaatsnaam || ''} | ${l.provincie || '—'} | andere klanten: ${others.length ? others.join(', ') : 'geen'}`,
    );
  }
} else if (notAtGreenteam.length > 40) {
  console.log(`\n(${notAtGreenteam.length} leads — lijst te lang, eerste 15:)`);
  for (const l of notAtGreenteam.slice(0, 15)) {
    const others = assignsByLead.get(l.id) || [];
    console.log(
      `  ${l.day} | ${l.naam_klant || '—'} | ${l.postcode || ''} | ${others.length ? others.join(', ') : 'geen andere'}`,
    );
  }
}
