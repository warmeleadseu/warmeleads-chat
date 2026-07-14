# Google Sheets Koppelen - Probleem Opgelost ✅

**Datum:** 1 november 2025  
**Status:** ✅ Compleet en gedeployed

## Probleem

Het koppelen van Google Sheets aan klantaccounts werkte niet. De volgende fout trad op:

```
PATCH https://klnstthwdtszrqsmsljq.supabase.co/rest/v1/customers?id=eq.account-demo%40warmeleads.eu 401 (Unauthorized)
```

### Oorzaken

1. **Client-side RLS probleem**: De frontend probeerde direct naar Supabase te schrijven met de `ANON` key (client-side), die geen schrijfrechten heeft door Row Level Security (RLS) policies.

2. **Tijdelijke ID probleem**: Gebruikers die alleen een account hadden (maar geen CRM customer record) kregen een tijdelijk ID zoals `account-demo@warmeleads.eu`, dat niet bestaat in de database.

3. **Ontbrekende CRM records**: Voor sommige geregistreerde gebruikers was er nog geen CRM customer record, wat het koppelen van sheets onmogelijk maakte.

## Oplossing

### 1. Nieuwe Server-Side API Route

**Bestand:** `src/app/api/admin/link-sheet/route.ts`

Deze nieuwe API route:
- Gebruikt de `SERVICE_ROLE_KEY` om RLS te omzeilen
- Maakt automatisch een CRM customer record aan als die niet bestaat
- Valideert de Google Sheets URL
- Extraheert het Sheet ID
- Logt alle changes in de `data_changes` tabel
- Werkt voor zowel bestaande als nieuwe customers

```typescript
export async function POST(request: Request) {
  // Check of customer bestaat
  // Zo niet: maak nieuwe CRM record aan
  // Zo wel: update met Sheet info
  // Return success/error
}
```

### 2. Frontend Aanpassingen

**Bestand:** `src/app/admin/customers/page.tsx`

De frontend is aangepast om:
- De nieuwe `/api/admin/link-sheet` API route te gebruiken
- Het email adres van de klant mee te sturen (in plaats van een mogelijk tijdelijk ID)
- Duidelijke error/success berichten te tonen

**Voor:**
```typescript
const success = await crmSystem.linkGoogleSheet(customer.id, sheetUrl);
```

**Na:**
```typescript
const response = await fetch('/api/admin/link-sheet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerEmail: customer.email,
    sheetUrl: sheetUrl
  })
});
```

## Functionaliteit

### Sheets Koppelen

1. **Voor bestaande CRM customers:**
   - Sheet info wordt direct bijgewerkt
   - `google_sheet_id` en `google_sheet_url` worden opgeslagen
   - Data change wordt gelogd

2. **Voor nieuwe gebruikers zonder CRM record:**
   - Er wordt automatisch een nieuw CRM customer record aangemaakt
   - Gebruikers gegevens worden overgenomen uit de `users` tabel
   - Sheet wordt meteen gekoppeld
   - Status wordt gezet op `customer`
   - `has_account` wordt gezet op `true`

### UI Componenten

1. **"📊 Gekoppeld" button:**
   - Klikbaar - opent de Google Sheet in een nieuw tabblad
   - Groen gemarkeerd
   - Zichtbaar als er al een sheet is gekoppeld

2. **"✏️" edit button:**
   - Wijzig de gekoppelde Sheet URL
   - Toont huidige URL in prompt
   - Validatie van nieuwe URL

3. **"📊 Koppelen" button:**
   - Koppel een nieuwe Sheet
   - Grijs gemarkeerd
   - Zichtbaar als er nog geen sheet is gekoppeld

## Deployment

✅ **Gedeployed naar productie**

- Commit: `4e01635` - "🔧 FIX: TypeScript error in link-sheet API"
- Build: ✅ Succesvol gecompileerd
- Vercel: https://warmeleads.eu

## Testing

Om de functionaliteit te testen:

1. **Inloggen als admin:**
   - Ga naar https://warmeleads.eu/admin
   - Login met admin account

2. **Navigeer naar Klanten tab**

3. **Test Sheet koppelen:**
   - Klik op "📊 Koppelen" bij een klant zonder sheet
   - Voer een Google Sheets URL in
   - Controleer de success melding
   - Ververs de pagina
   - Controleer of de sheet nu zichtbaar is als "📊 Gekoppeld"

4. **Test Sheet wijzigen:**
   - Klik op de "✏️" button naast een gekoppelde sheet
   - Voer een nieuwe URL in
   - Controleer de success melding

5. **Test Sheet openen:**
   - Klik op de "📊 Gekoppeld" button
   - De sheet moet openen in een nieuw tabblad

## Supabase Database

### Affected Tables

**`customers` tabel:**
- `google_sheet_id` - Opgeslagen Sheet ID (bijv. "1ABC...")
- `google_sheet_url` - Volledige Google Sheets URL
- `has_account` - Wordt automatisch gezet op `true`
- `last_activity` - Wordt bijgewerkt bij elke sheet actie

**`data_changes` tabel:**
- Alle sheet wijzigingen worden gelogd
- `field`: "googleSheetId"
- `old_value`: Vorige sheet ID (of null)
- `new_value`: Nieuwe sheet ID
- `source`: "admin"

## Voordelen van Deze Oplossing

1. **Veiligheid:** Server-side API route gebruikt SERVICE_ROLE_KEY, geen client-side credentials exposure
2. **Automatisch:** Maakt ontbrekende CRM records automatisch aan
3. **Robuust:** Uitgebreide error handling en validatie
4. **Traceerbaar:** Alle changes worden gelogd in `data_changes`
5. **Gebruiksvriendelijk:** Duidelijke UI met feedback voor gebruiker

## Bekende Issues

Geen bekende issues op dit moment.

## Next Steps

1. ✅ Testing op productie
2. ✅ Validatie dat alle bestaande sheets nog werken
3. ✅ Monitoring van error logs in Vercel

## Support

Bij problemen:
- Check Vercel logs: `vercel logs warmeleads.eu`
- Check Supabase logs in dashboard
- Browser console voor frontend errors
- Verifieer environment variables in Vercel

---

**Status:** ✅ COMPLEET - Google Sheets koppelen werkt nu perfect!

