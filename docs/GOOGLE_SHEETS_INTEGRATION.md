# Google Spreadsheets-integratie (portaal)

Klanten koppelen hun eigen Google-account en spreadsheet via **Account → Integraties**.

## Flow

1. Kies **Google Spreadsheets** in stap 1.
2. Autoriseer Google (OAuth).
3. Plak spreadsheet-URL, lees kolommen uit (rij 1 = koppen), kies werkblad.
4. Map portaalvelden per branche aan spreadsheet-kolommen.
5. Nieuwe leadtoewijzingen → rij onderaan het gekozen werkblad.

## Server-configuratie

```env
GOOGLE_SHEETS_API_KEY=              # verplicht — API key uit Google Cloud (geen trailing newline)
GOOGLE_INTEGRATION_CLIENT_ID=       # verplicht voor OAuth-koppeling
GOOGLE_INTEGRATION_CLIENT_SECRET=
INTEGRATION_TOKEN_ENCRYPTION_KEY=   # aanbevolen
NEXT_PUBLIC_APP_URL=https://warmeleads.eu
```

Google Cloud Console (project **Google Sheets Webapp**):

- **Google Sheets API** ingeschakeld
- **API key** (`API key 1`) → `GOOGLE_SHEETS_API_KEY`
- **OAuth client** `CRM WarmeLeads OAuth` (Web application) → `GOOGLE_INTEGRATION_CLIENT_ID` + `GOOGLE_INTEGRATION_CLIENT_SECRET`
- Redirect URI: `{NEXT_PUBLIC_APP_URL}/api/portal/integrations/google-sheets/callback`
- Service account `warmeleads-sheets@light-footing-452919-u7.iam.gserviceaccount.com` (optioneel via `GOOGLE_SERVICE_ACCOUNT_EMAIL`)

De API key alleen is niet genoeg om te schrijven: klanten autoriseren nog steeds hun eigen Google-account via OAuth. De key koppelt API-aanroepen aan jullie Cloud-project (quota/facturering).

## Technisch

- Tokens: `customer_integrations` (`provider = google_sheets`)
- Sync-log: `integration_sync_log` (`provider = google_sheets`)
- Trigger: `onLeadAssignedToCustomer` → `syncAssignmentToGoogleSheets`
