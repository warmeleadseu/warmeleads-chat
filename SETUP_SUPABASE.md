# 🚀 Supabase Setup Instructies - WarmeLeads

## ✅ Wat is al gedaan

### Gemigreerde API Routes (nu Supabase):
- ✅ `/api/auth/register` - Registratie
- ✅ `/api/auth/login` - Login
- ✅ `/api/auth/get-profile` - Profiel ophalen
- ✅ `/api/auth/update-profile` - Profiel updaten
- ✅ `/api/auth/change-password` - Wachtwoord wijzigen
- ✅ `/api/customer-data` - Customer CRM data
- ✅ `/api/orders` - Order management
- ✅ `/api/user-preferences` - User preferences
- ✅ `/api/reclaim-lead` - Lead reclamations
- ✅ `/api/pricing` - Pricing configuration

### Nog NIET gemigreerd (gebruiken nog Blob Storage):
- ⚠️ `/api/auth/company` - Company management
- ⚠️ `/api/auth/invite-employee` - Employee invites
- ⚠️ `/api/auth/activate-employee` - Employee activation
- ⚠️ `/api/auth/manage-account` - Account management
- ⚠️ `/api/auth/list-accounts` - Account listing
- ⚠️ `/api/auth/force-delete-employee` - Delete employees
- ⚠️ `/api/customer-sheets` - Google Sheets mapping
- ⚠️ `/api/webhooks/stripe` - Stripe webhooks (orders opslaan)

## 📋 STAP 1: Supabase Project Setup

### A. Supabase Project Aanmaken (als je dit nog niet hebt)
1. Ga naar https://supabase.com
2. Login met je GitHub account (dat je al gekoppeld hebt)
3. Klik op "New Project"
4. Kies een naam (bijv. "warmeleads")
5. Kies een database password (bewaar deze goed!)
6. Kies een regio (Amsterdam/EU-West voor snelheid)
7. Klik "Create new project"

### B. Database Schema Installeren
1. Ga naar je Supabase project dashboard
2. Klik in de linker sidebar op **"SQL Editor"**
3. Klik op **"New query"**
4. Open het bestand `supabase-schema-complete.sql` in deze repository
5. Kopieer de HELE inhoud (alle SQL code)
6. Plak het in de SQL Editor in Supabase
7. Klik rechtsboven op **"Run"** of druk Ctrl+Enter
8. Wacht tot het klaar is (groen vinkje = success)

✅ Na deze stap heb je alle tabellen aangemaakt!

## 📋 STAP 2: Environment Variables Instellen

### A. Haal je Supabase keys op
1. Ga naar je Supabase project
2. Klik in de sidebar op **"Project Settings"** (tandwiel icoon)
3. Klik op **"API"**
4. Je ziet nu 3 belangrijke keys:

**Project URL:**
```
https://your-project-ref.supabase.co
```

**anon/public key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**service_role key:** (geheim!)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### B. Voeg toe aan .env.local
Maak een `.env.local` bestand in de root van je project (naast `package.json`):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Overige environment variables (blijven hetzelfde)
STRIPE_SECRET_KEY=sk_test_...
# etc...
```

### C. Vercel Environment Variables
Als je deployed hebt op Vercel:
1. Ga naar Vercel dashboard → je project
2. Ga naar **Settings** → **Environment Variables**
3. Voeg de 3 Supabase variables toe:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Klik op **Save**
5. **Redeploy je project** (Deployments → ⋮ → Redeploy)

## 📋 STAP 3: Testen

### Lokaal testen:
```bash
# Stop huidige server
pkill -f "next dev"

# Start opnieuw (om nieuwe env vars te laden)
npm run dev
```

### Test flow:
1. **Registratie testen:**
   - Ga naar je website
   - Maak een nieuw account aan
   - Check in Supabase: Table Editor → `users` → moet je account zien

2. **Login testen:**
   - Log in met je nieuwe account
   - Moet succesvol zijn

3. **Order testen:**
   - Bestel testleads
   - Check in Supabase: Table Editor → `orders` → moet je order zien

4. **Customer data testen:**
   - Check in Supabase: Table Editor → `customers` → moet je customer record zien

## 🔍 Supabase Database Bekijken

### Table Editor (visueel):
1. Ga naar je Supabase project
2. Klik op **"Table Editor"** in sidebar
3. Selecteer een tabel (bijv. `users`, `customers`, `orders`)
4. Zie alle data visueel

### SQL Editor (queries):
```sql
-- Alle users bekijken
SELECT * FROM users;

-- Alle customers bekijken
SELECT * FROM customers;

-- Alle orders bekijken
SELECT * FROM orders ORDER BY created_at DESC;

-- Customer met orders en leads
SELECT 
  c.*,
  COUNT(DISTINCT o.id) as total_orders,
  COUNT(DISTINCT l.id) as total_leads
FROM customers c
LEFT JOIN orders o ON o.customer_email = c.email
LEFT JOIN leads l ON l.customer_id = c.id
GROUP BY c.id;
```

## ⚠️ Troubleshooting

### Foutmelding: "Missing Supabase environment variables"
- Check of `.env.local` correct is
- Restart je dev server
- Check of keys niet extra spaties hebben

### Foutmelding: "relation does not exist"
- Je hebt het SQL schema nog niet uitgevoerd
- Ga terug naar STAP 1B en run het schema

### Foutmelding: "JWT expired"
- Je `service_role` key is verlopen of onjuist
- Haal een nieuwe key op uit Supabase dashboard

### Data wordt niet opgeslagen
- Check browser console voor errors
- Check Supabase dashboard → Logs voor errors
- Zorg dat RLS policies correct zijn (schema doet dit automatisch)

## 📊 Data Migratie (optioneel)

Als je al bestaande accounts/orders hebt in Blob Storage:

1. **Exporteer oude data** (via admin panel of API calls)
2. **Importeer in Supabase:**
   ```sql
   -- Voorbeeld: User importeren
   INSERT INTO users (email, password_hash, name, company, phone, role, created_at)
   VALUES 
   ('user@example.com', 'existing_hash', 'Name', 'Company', '+31...', 'owner', '2024-01-01');
   ```

Maar voor een verse start hoef je dit niet te doen!

## ✅ Checklist

- [ ] Supabase project aangemaakt
- [ ] Database schema uitgevoerd in SQL Editor
- [ ] Environment variables ingesteld (.env.local)
- [ ] Dev server herstart
- [ ] Test registratie succesvol
- [ ] Test login succesvol
- [ ] Test order succesvol
- [ ] Data zichtbaar in Supabase Table Editor
- [ ] Vercel environment variables ingesteld (als deployed)
- [ ] Vercel redeploy gedaan (als deployed)

## 🎉 Klaar!

Je systeem draait nu volledig op Supabase PostgreSQL in plaats van Blob Storage JSON files.

**Voordelen:**
- ⚡ Snellere queries
- 🔒 Betere security (RLS)
- 📊 Relationele data (foreign keys)
- 💾 Automatische backups
- 🔄 Real-time mogelijk (toekomst)
- 📈 Schaalbaarder

