# AM Mail-Compose · Go-live runbook

Deze checklist hoort bij de feature **AM Mail-Compose** (account managers
versturen vanuit de admin gepersonaliseerde 1-op-1 en bulk mails). Doorloop
alles vóór je de feature voor productie aanzet.

## 1. DNS-checks (SPF, DKIM, DMARC)

Resend dashboard → Domains → `warmeleads.eu` moet alle drie groen zijn.

Verifieer extern via:

```bash
node scripts/check-email-deliverability.mjs
```

Het script controleert:

- **SPF** — moet exact één record zijn op `warmeleads.eu` met
  `include:_spf.resend.com` en eindigen op `~all` (of `-all`).
- **DKIM** — Resend levert 2 CNAME-records (selectoren `resend` en
  `resend2`); beide moeten resolven naar `*.resend.com`.
- **DMARC** — record op `_dmarc.warmeleads.eu`. Start met
  `p=quarantine` of `p=reject` zodra DKIM/SPF stabiel zijn (begin
  eventueel met `p=none` + `rua=` voor monitoring).

Voorbeeld DNS (vul Resend-CNAMEs in):

```
warmeleads.eu             TXT    "v=spf1 include:_spf.resend.com ~all"
resend._domainkey         CNAME  <waarde uit Resend>
resend2._domainkey        CNAME  <waarde uit Resend>
_dmarc.warmeleads.eu      TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc@warmeleads.eu; adkim=s; aspf=s"
```

## 2. Webhook configureren

Resend dashboard → Webhooks → endpoint:

```
https://www.warmeleads.eu/api/webhooks/resend?secret=<RESEND_WEBHOOK_SECRET>
```

Activeer events: `email.sent`, `email.delivered`, `email.opened`,
`email.clicked`, `email.bounced`, `email.complained`.

Zet de geheime sleutel óók in Vercel als env var
`RESEND_WEBHOOK_SECRET`.

## 3. Test-mail vanuit script

```bash
RESEND_API_KEY=re_*** node scripts/email-go-live-test.mjs \
  --to=jezelf@gmail.com \
  --from-name="Luigi Pani" \
  --from-email=luigi@warmeleads.eu
```

Open de ontvangen mail (Gmail → ⋮ → Show original) en controleer:

- `Authentication-Results: ... spf=pass dkim=pass dmarc=pass`
- `From: Luigi Pani <luigi@warmeleads.eu>`
- `Reply-To: luigi@warmeleads.eu`
- `List-Unsubscribe:` aanwezig met http- én mailto-variant
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

## 4. End-to-end test in admin

Inloggen als account manager (rol `accountmanager` of `admin`) en doorloop:

1. **1-op-1 prospect** — open een prospect-drawer → "Mail" → kies template
   `Eerste kennismaking` → vink branches en `show_pricing` aan → preview →
   "Test mail naar mezelf" → "Versturen". Check:
   - mail komt aan op je eigen Gmail
   - `prospect_activities` heeft een `email`-rij erbij
   - `last_contacted_at` is bijgewerkt
   - tab "Mail" in drawer toont de regel
2. **1-op-1 customer** — zelfde maar dan in customer-detailpaneel.
3. **Bulk 5 prospects** — selecteer in de prospects-lijst → "Mail
   versturen" → template `pricing_overview` → versturen. Check `email_log`.
4. **Bulk 50 customers** — zelfde, met `re_engage`. Bevestig dat het
   binnen ~10s/8 mails verloopt (rate-limit `SEND_INTERVAL_MS = 125`).
5. **Bulk 150 customers** — verifieer dat een `email_jobs`-rij wordt
   aangemaakt en de UI live de progress-bar toont via polling.
6. **Opt-out** — klik in een ontvangen testmail op de Afmelden-link →
   bevestig op `/email/unsubscribe` → stuur dezelfde recipient nogmaals
   en check dat `email_log.status='opt_out'` is en de mail niet uitgaat.
7. **Hard bounce** — verstuur naar `bounce@simulator.amazonses.com` (of
   Resend's eigen sandbox-bounce-adres) → controleer dat na de webhook
   `email_log.status='bounced'` is en bij twee hard bounces het adres in
   `email_optouts(scope='all', source='hard_bounce')` belandt.
8. **Webhook open/click** — open de mail (open-event) en klik een link
   (click-event). `opens_count` en `clicks_count` op `email_log` moeten
   ophogen, plus `last_opened_at` / `last_clicked_at`.
9. **AM-signature override** — `/admin/account` → e-mailhandtekening
   panel → plak custom HTML → preview verandert mee → verstuur testmail
   → ontvanger ziet de override. Reset → default-render komt terug.
10. **Audit-log** — verifieer entries `email.sent`, `email.bulk_sent`,
    `email.test_sent` in `audit_log`.

## 5. Vercel env-vars

Zorg dat deze in Vercel staan:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `EMAIL_BASE_URL` (= `https://www.warmeleads.eu`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`

## 6. Rollout-volgorde

1. DNS staat groen → run `check-email-deliverability.mjs` en `email-go-live-test.mjs`.
2. Migratie `083_am_outbound_emails.sql` is uitgerold (lokaal al gedaan).
3. Deploy de feature naar Vercel.
4. Webhook in Resend wijzen naar productie-URL.
5. Eerste week alleen 1-op-1 mails toestaan; bulk-knoppen onder
   superadmin-role hangen totdat de logs schoon zijn.
6. Daarna bulk vrijgeven.

## 7. Niet vergeten

- Voeg `unsubscribe@warmeleads.eu` toe als alias in Google Workspace die
  doorforward naar `dmarc@warmeleads.eu` of een gedeelde inbox, zodat
  mailto-unsubscribes binnenkomen.
- Plan een DMARC-rapport-review na 7 dagen (`rua=` adres).
