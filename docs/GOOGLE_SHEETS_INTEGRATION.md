# Google Spreadsheets-integratie (portaal)

Klanten koppelen een Google Spreadsheet via **Account → Integraties** zonder in te loggen bij Google.

## Flow

1. Kies **Google Spreadsheets** in stap 1.
2. Deel de spreadsheet in Google met het Warme Leads service account als **bewerker**.
3. Plak de spreadsheet-URL → kolommen uit rij 1 van het **laatste tabblad** (of het tabblad uit `#gid=` in de URL).
4. Map portaalvelden per branche aan spreadsheet-kolommen.
5. Nieuwe leadtoewijzingen → rij onderaan het gekozen werkblad.

## Server-configuratie

```env
GOOGLE_SHEETS_API_KEY=                    # verplicht — Google Cloud API key
GOOGLE_SERVICE_ACCOUNT_EMAIL=             # optioneel — default: warmeleads-sheets@...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=       # verplicht — PEM (\\n in Vercel env)
INTEGRATION_TOKEN_ENCRYPTION_KEY=         # aanbevolen
NEXT_PUBLIC_APP_URL=https://warmeleads.eu
```

Optioneel (legacy klant-OAuth):

```env
GOOGLE_INTEGRATION_CLIENT_ID=
GOOGLE_INTEGRATION_CLIENT_SECRET=
```

Google Cloud Console (project **Google Sheets Webapp**):

- **Google Sheets API** ingeschakeld
- **API key** → `GOOGLE_SHEETS_API_KEY`
- **Service account** met Sheets-rechten; private key in `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- Klanten delen hun spreadsheet met het service account-e-mailadres (zichtbaar in het portaal)

## Technisch

- Instellingen: `customer_integrations` (`provider = google_sheets`, `connection_mode`: `service_account` | `oauth`)
- Sync-log: `integration_sync_log` (`provider = google_sheets`)
- Trigger: `onLeadAssignedToCustomer` → `syncAssignmentToGoogleSheets`
- API-aanroepen: Bearer token service account (of klant-OAuth indien nog gekoppeld)
