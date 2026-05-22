# Teamleader Focus-integratie (klantportaal)

## Belangrijk: één app, veel klanten

**Jij hoeft geen Client ID per klant te zetten.** Warme Leads registreert **één** OAuth-app op de Teamleader Marketplace. De credentials daarvan bewaar je **één keer** (Admin → Koppelingen, of optioneel in Vercel env).

Elke klant (bijv. Sergio / Next Gen) klikt in het portaal op **Koppel Teamleader**, logt in bij **zijn eigen** Teamleader-account, en geeft toestemming. De access/refresh tokens van **die** klant worden per `customer_id` in `customer_integrations` opgeslagen (encrypted). Daarna syncen alleen **hun** toegewezen leads.

```
Warme Leads (1× Marketplace-app)
    └── Client ID + Secret → Admin Koppelingen of Vercel
    └── Klant A OAuth → tokens van klant A
    └── Klant B OAuth → tokens van klant B
```

## Stap 1 — Marketplace-app (Warme Leads, éénmalig)

1. [Teamleader Marketplace](https://marketplace.focus.teamleader.eu/build) → integratie **Warme Leads**.
2. Redirect URI whitelist (exact, **geen** newline/spatie aan het eind):
   - `https://warmeleads.eu/api/portal/integrations/teamleader/callback`
   - Lokaal: `http://localhost:3000/api/portal/integrations/teamleader/callback`
3. Kopieer **Client ID** en **Client Secret** (één regel, geen regeleinde in de waarde).

## Stap 2 — Credentials opslaan (kies één)

### Optie A — Admin (aanbevolen)

**Admin → Koppelingen → Teamleader Focus** → plak Client ID + Secret → Opslaan.

Geen Vercel nodig zolang dit staat in `app_settings`.

### Optie B — Vercel (alternatief)

Zelfde waarden als env vars (zonder newline aan het eind):

```env
TEAMLEADER_CLIENT_ID=
TEAMLEADER_CLIENT_SECRET=
TEAMLEADER_REDIRECT_URI=https://warmeleads.eu/api/portal/integrations/teamleader/callback
```

Env heeft voorrang boven Admin als beide gezet zijn.

## Stap 3 — Klantflow

1. Portaal → **Account** → **Teamleader Focus**.
2. **Koppel Teamleader** → OAuth → terug naar portaal.
3. Pipeline kiezen, deal-titel eventueel aanpassen, **Sync aan** → Opslaan.
4. Optioneel **Testdeal** om te verifiëren.

Alleen `lead_assignments` met `customer_id` = die klant worden gesynchroniseerd.

## Database

Migratie: `supabase/migrations/122_teamleader_integration.sql`  
Tabellen: `customer_integrations`, `integration_sync_log`.

## Troubleshooting

| Probleem | Oplossing |
|----------|-----------|
| Portaal: “binnenkort beschikbaar” | Client ID/Secret nog niet in Admin of Vercel |
| OAuth redirect mismatch | Redirect URI in Marketplace = exact de callback-URL |
| Token/secret werkt niet | Geen newline in geplakte waarde; opnieuw opslaan via Admin |
| Geen sync | Pipeline gekozen + sync aan + lead niet `bron=demo` |
