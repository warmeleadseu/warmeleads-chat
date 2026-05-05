#!/usr/bin/env node
/**
 * Email-deliverability check voor warmeleads.eu.
 *
 * Controleert SPF, DKIM (Resend selectoren) en DMARC voor het from-domein
 * dat AM-mails versturen, en print een korte samenvatting met aanbevelingen.
 *
 * Gebruik:
 *   node scripts/check-email-deliverability.mjs
 *   node scripts/check-email-deliverability.mjs --domain=warmeleads.eu
 *
 * Werkt zonder externe dependencies (gebruikt node:dns/promises).
 */
import { promises as dns } from 'node:dns';

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [k, ...v] = arg.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : 'true'];
  }),
);

const DOMAIN = (args.domain || 'warmeleads.eu').trim().toLowerCase();
const RESEND_DKIM_SELECTORS = ['resend', 'resend2', 'resend._domainkey'];

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function pass(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}
function fail(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}
function warn(msg) {
  console.log(`${colors.yellow}!${colors.reset} ${msg}`);
}
function info(msg) {
  console.log(`${colors.cyan}i${colors.reset} ${msg}`);
}

async function lookupTxt(name) {
  try {
    const records = await dns.resolveTxt(name);
    return records.map(parts => parts.join(''));
  } catch (err) {
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') return [];
    throw err;
  }
}

async function lookupCname(name) {
  try {
    return await dns.resolveCname(name);
  } catch (err) {
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') return [];
    throw err;
  }
}

async function checkSpf() {
  console.log(`\n${colors.bold}SPF${colors.reset}`);
  const txt = await lookupTxt(DOMAIN);
  const spfRecords = txt.filter(r => r.toLowerCase().startsWith('v=spf1'));
  if (spfRecords.length === 0) {
    fail(`Geen SPF-record gevonden voor ${DOMAIN}`);
    info('Voeg toe: "v=spf1 include:_spf.resend.com ~all"');
    return false;
  }
  if (spfRecords.length > 1) {
    fail('Meerdere SPF-records gevonden (RFC 7208 staat er maar 1 toe). Voeg de mechanisms samen in 1 record.');
    spfRecords.forEach(r => console.log('  ', r));
    return false;
  }
  const spf = spfRecords[0];
  pass(`SPF gevonden: ${spf}`);
  if (!spf.toLowerCase().includes('include:_spf.resend.com')) {
    warn('SPF bevat geen "include:_spf.resend.com" — voeg toe vóór go-live, anders SPF-fail bij Resend.');
    return false;
  }
  pass('SPF includeert Resend');
  if (/(\s|^)\+all(\s|$)/i.test(spf)) {
    warn('SPF eindigt op "+all" — onveilig. Gebruik "~all" of "-all".');
  }
  return true;
}

async function checkDkim() {
  console.log(`\n${colors.bold}DKIM (Resend)${colors.reset}`);
  let foundAny = false;
  for (const sel of RESEND_DKIM_SELECTORS) {
    const host = sel.includes('_domainkey') ? `${sel}.${DOMAIN}` : `${sel}._domainkey.${DOMAIN}`;
    const cname = await lookupCname(host);
    if (cname.length > 0) {
      pass(`DKIM CNAME gevonden voor ${sel} → ${cname.join(', ')}`);
      foundAny = true;
      continue;
    }
    const txt = await lookupTxt(host);
    if (txt.length > 0) {
      const dkimTxt = txt.find(r => /\bp=/.test(r));
      if (dkimTxt) {
        pass(`DKIM TXT gevonden voor ${sel} (${dkimTxt.length} chars)`);
        foundAny = true;
      }
    }
  }
  if (!foundAny) {
    fail('Geen DKIM-records gevonden voor Resend-selectoren');
    info('Pak de exacte CNAMEs uit Resend → Domains → warmeleads.eu en publiceer ze in DNS.');
    return false;
  }
  return foundAny;
}

async function checkDmarc() {
  console.log(`\n${colors.bold}DMARC${colors.reset}`);
  const txt = await lookupTxt(`_dmarc.${DOMAIN}`);
  const dmarc = txt.find(r => r.toLowerCase().startsWith('v=dmarc1'));
  if (!dmarc) {
    fail(`Geen DMARC-record op _dmarc.${DOMAIN}`);
    info('Aanbevolen: "v=DMARC1; p=quarantine; rua=mailto:dmarc@warmeleads.eu; adkim=s; aspf=s"');
    return false;
  }
  pass(`DMARC gevonden: ${dmarc}`);
  const policy = (dmarc.match(/p=([a-zA-Z]+)/) || [])[1]?.toLowerCase();
  if (!policy || policy === 'none') {
    warn('DMARC-policy is "none" — alleen rapportage, geen bescherming. Upgrade naar quarantine of reject zodra alles groen staat.');
  } else {
    pass(`DMARC-policy: ${policy}`);
  }
  if (!/rua=/.test(dmarc)) {
    warn('Geen rua=-rapportadres ingesteld; voeg toe voor zichtbaarheid in spoofing-attempts.');
  }
  return true;
}

async function checkMxResend() {
  console.log(`\n${colors.bold}Resend bounce-MX (optioneel)${colors.reset}`);
  try {
    const records = await dns.resolveMx(`bounces.${DOMAIN}`);
    if (records.length > 0) {
      pass(`MX op bounces.${DOMAIN}: ${records.map(r => r.exchange).join(', ')}`);
      return true;
    }
  } catch (err) {
    if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') throw err;
  }
  info(`Geen bounces.${DOMAIN} MX gevonden — alleen relevant als je Resend met custom return-path gebruikt.`);
  return null;
}

(async () => {
  console.log(`${colors.bold}Email-deliverability check voor ${DOMAIN}${colors.reset}`);
  let allOk = true;
  try {
    if (!(await checkSpf())) allOk = false;
    if (!(await checkDkim())) allOk = false;
    if (!(await checkDmarc())) allOk = false;
    await checkMxResend();
  } catch (err) {
    fail(`DNS-lookup fout: ${err.message}`);
    process.exit(2);
  }

  console.log('');
  if (allOk) {
    pass('Alle kritieke checks geslaagd. Klaar voor go-live test.');
    process.exit(0);
  }
  warn('Niet alle checks zijn geslaagd. Los bovenstaande punten op vóór je AM-bulkmails verstuurt.');
  process.exit(1);
})();
