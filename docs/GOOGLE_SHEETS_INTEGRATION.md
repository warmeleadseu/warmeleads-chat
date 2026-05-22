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
GOOGLE_INTEGRATION_CLIENT_ID=
GOOGLE_INTEGRATION_CLIENT_SECRET=
INTEGRATION_TOKEN_ENCRYPTION_KEY=   # aanbevolen
NEXT_PUBLIC_APP_URL=https://warmeleads.eu
```

Google Cloud Console:

- OAuth consent screen (productie: verified indien extern)
- OAuth client type: **Web application**
- Redirect URI: `{NEXT_PUBLIC_APP_URL}/api/portal/integrations/google-sheets/callback`
- API: Google Sheets API ingeschakeld

## Technisch

- Tokens: `customer_integrations` (`provider = google_sheets`)
- Sync-log: `integration_sync_log` (`provider = google_sheets`)
- Trigger: `onLeadAssignedToCustomer` → `syncAssignmentToGoogleSheets`
