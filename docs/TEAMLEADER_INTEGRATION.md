# Teamleader Focus-integratie (klantportaal)

## Belangrijk: Warme Leads heeft géén Teamleader-account nodig

Onze klanten brengen hun **eigen** OAuth-app mee. Iedere klant maakt zelf een gratis private integratie aan in zijn eigen Teamleader Focus, plakt Client ID + Secret in het portaal en doet daarna OAuth. Wij hoeven niets aan onze kant te registreren.

```
Klant A
  └── Teamleader (eigen Focus-account)
       └── Marketplace → Create integration (gratis, privaat)
       └── Client ID + Secret → in Warme Leads-portaal plakken
       └── OAuth → tokens van klant A worden bij ons opgeslagen
Klant B
  └── Idem, volledig los van klant A
```

> Optioneel: als jij toch één centrale Warme Leads-OAuth-app wilt aanbieden (zodat klanten geen eigen integratie hoeven aan te maken), kun je dat in **Admin → Koppelingen** invullen. Klant-eigen credentials hebben altijd voorrang.

## Klantflow (de standaard route)

### Stap 1 — Klant maakt integratie in zijn Teamleader

1. Klant gaat naar [Teamleader Marketplace → Build](https://marketplace.focus.teamleader.eu/build) en logt in met zijn eigen Teamleader-account.
2. Klikt op **Create integration** → naam: bijv. `Warme Leads`.
3. Vult bij **Redirect URI** exact onze callback-URL in. Het portaal toont en kopieert deze URL automatisch — bijvoorbeeld: `https://warmeleads.eu/api/portal/integrations/teamleader/callback`.
4. Bewaart de integratie. Kopieert **Client ID** en **Client Secret**.

### Stap 2 — Klant plakt credentials in Warme Leads-portaal

Portaal → **Account** → sectie **Teamleader Focus** → plak Client ID en Secret → Opslaan.

### Stap 3 — Klant doet OAuth

Klik op **Koppel mijn Teamleader-account**. De klant logt in (zit al ingelogd in eigen Teamleader), klikt **Authorize**, en wordt teruggestuurd naar het portaal.

### Stap 4 — Klant kiest pipeline en zet sync aan

Pipeline kiezen, eventueel deal-titel template aanpassen, **sync aan**, opslaan. Vanaf nu gaan alleen leads die aan deze klant zijn toegewezen automatisch als contact + deal naar Teamleader.

## Wat we per klant opslaan (encrypted)

In `customer_integrations`:

| Veld | Doel |
|------|------|
| `client_id_enc`, `client_secret_enc` | Klant-eigen OAuth-app credentials |
| `access_token_enc`, `refresh_token_enc`, `expires_at` | OAuth-tokens van die klant |
| `settings.pipeline_id`, `settings.deal_title_template`, `settings.enabled` | Sync-voorkeuren |

Tokens worden versleuteld met AES-256-GCM (`INTEGRATION_TOKEN_ENCRYPTION_KEY` of fallback op `APP_SESSION_SECRET`/`CRON_SECRET`).

## Database

- `supabase/migrations/122_teamleader_integration.sql` — `customer_integrations` + `integration_sync_log`
- `supabase/migrations/123_teamleader_per_customer_oauth_app.sql` — `client_id_enc` + `client_secret_enc`

## Optioneel: centrale Warme Leads-app

Als je tóch een fallback wilt aanbieden (klanten kunnen direct koppelen zonder eigen integratie aan te maken):

- **Admin → Koppelingen → Teamleader Focus** → Client ID + Secret plakken.
- Of Vercel env vars `TEAMLEADER_CLIENT_ID` / `TEAMLEADER_CLIENT_SECRET` / `TEAMLEADER_REDIRECT_URI`.

In dat geval moet je zelf een (gratis) Marketplace-app op je naam registreren. **Niet vereist** voor klanten — die kunnen altijd hun eigen app meebrengen.

## Troubleshooting

| Probleem | Oplossing |
|----------|-----------|
| Portaal: “voer eerst Client ID/Secret in” | Klant heeft nog geen eigen credentials geplakt (sectie Teamleader → Stap 2) |
| OAuth redirect mismatch | Redirect URI in de Teamleader-integratie van de klant = exact onze callback-URL (geen newline/spatie) |
| `invalid_state` | OAuth-flow duurde langer dan 10 min — opnieuw beginnen |
| Token werkt niet | Geen newline/spatie in Client Secret; opnieuw plakken |
| Geen sync | Pipeline gekozen + sync aan + lead niet `bron=demo` |
