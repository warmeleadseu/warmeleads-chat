#!/usr/bin/env node
/**
 * Go-live test: verstuurt een echte mail via Resend met de exacte from/replyTo
 * en List-Unsubscribe headers die de AM-compose feature ook gebruikt, zodat je
 * in de testmailbox kunt verifiëren dat:
 *   - de mail SPF/DKIM/DMARC passes haalt (header inspectie)
 *   - List-Unsubscribe correct in de header staat
 *   - Reply-To naar de AM-mailbox routeert
 *
 * Gebruik:
 *   RESEND_API_KEY=... node scripts/email-go-live-test.mjs \
 *     --to=test@inbox.com \
 *     --from-name="Luigi Pani" \
 *     --from-email=luigi@warmeleads.eu \
 *     [--subject="WarmeLeads go-live test"]
 *
 * Alternatief: zet vars in .env.local; dit script leest die niet automatisch in.
 */
import process from 'node:process';

function arg(key, fallback = '') {
  const hit = process.argv.find(a => a.startsWith(`--${key}=`));
  return hit ? hit.slice(key.length + 3) : fallback;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO = arg('to');
const FROM_NAME = arg('from-name', 'WarmeLeads');
const FROM_EMAIL = arg('from-email');
const SUBJECT = arg('subject', `WarmeLeads go-live test · ${new Date().toISOString().slice(0, 16)}`);

if (!RESEND_API_KEY) {
  console.error('Missende env var RESEND_API_KEY.');
  process.exit(2);
}
if (!TO || !FROM_EMAIL) {
  console.error('Gebruik: --to=<adres> --from-email=<am@warmeleads.eu> [--from-name=...] [--subject=...]');
  process.exit(2);
}
if (!FROM_EMAIL.toLowerCase().endsWith('@warmeleads.eu')) {
  console.error(`From-adres moet @warmeleads.eu zijn (kreeg: ${FROM_EMAIL}).`);
  process.exit(2);
}

const unsubscribeToken = `golive-${Date.now()}`;
const unsubscribeUrl = `https://www.warmeleads.eu/email/unsubscribe?token=${unsubscribeToken}`;

const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#0f172a;line-height:1.55;">
  <p>Hoi,</p>
  <p>Dit is een go-live test van de AM-mailcompose feature.</p>
  <p>Verstuurd als: <strong>${FROM_NAME} &lt;${FROM_EMAIL}&gt;</strong></p>
  <p>Controleer in deze mail:</p>
  <ul>
    <li>From-adres en weergavenaam</li>
    <li>Reply-To routeert naar ${FROM_EMAIL}</li>
    <li>SPF/DKIM/DMARC pass in raw headers</li>
    <li>List-Unsubscribe-link werkt: <a href="${unsubscribeUrl}">Afmelden</a></li>
  </ul>
  <p style="color:#64748b;font-size:12px;">Token: ${unsubscribeToken}</p>
</body></html>`;

const text = `Go-live test\n\nVerstuurd als: ${FROM_NAME} <${FROM_EMAIL}>\nUnsubscribe: ${unsubscribeUrl}\n`;

const payload = {
  from: `${FROM_NAME} <${FROM_EMAIL}>`,
  to: [TO],
  subject: SUBJECT,
  html,
  text,
  reply_to: FROM_EMAIL,
  headers: {
    'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@warmeleads.eu?subject=unsubscribe-${unsubscribeToken}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
};

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Resend API error (${res.status}):`, json);
  process.exit(1);
}
console.log('Verstuurd. Resend message id:', json.id);
console.log(`Check ${TO} en bekijk de raw headers (Gmail: "Show original").`);
