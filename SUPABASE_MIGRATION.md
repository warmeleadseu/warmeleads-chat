# Supabase Migratie - Van Vercel Blob Storage naar Supabase

De authenticatie en accountgegevens zijn gemigreerd van Vercel Blob Storage naar Supabase PostgreSQL database.

## ✅ Wat is gemigreerd

### Auth API Routes (100% gemigreerd)
- ✅ `/api/auth/register` - Account registratie
- ✅ `/api/auth/login` - Login
- ✅ `/api/auth/get-profile` - Profiel ophalen
- ✅ `/api/auth/update-profile` - Profiel updaten
- ✅ `/api/auth/change-password` - Wachtwoord wijzigen

### Database Schema
- ✅ `users` table - Alle gebruikers accounts
- ✅ `companies` table - Bedrijfsinformatie
- ✅ `employees` table - Employee accounts (voorbereid)

## 📋 Setup Instructies

### 1. Supabase Project Aanmaken

1. Ga naar [supabase.com](https://supabase.com)
2. Maak een nieuw project aan
3. Noteer je project URL en API keys

### 2. Database Schema Installeren

1. Ga naar je Supabase project dashboard
2. Klik op "SQL Editor"
3. Open het bestand `supabase-schema.sql` in deze repository
4. Kopieer en plak de hele SQL code
5. Klik op "Run" om het schema aan te maken

### 3. Environment Variables Instellen

Voeg de volgende environment variables toe aan je `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Waar vind je deze keys:
- `NEXT_PUBLIC_SUPABASE_URL`: Project Settings → API → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project Settings → API → anon/public key
- `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API → service_role key (geheim!)

### 4. Vercel Deployment

Voor Vercel deployment:
1. Ga naar je project settings in Vercel
2. Voeg de 3 Supabase environment variables toe
3. Redeploy je project

## 🎯 Voordelen van Supabase

1. **PostgreSQL Database** - Relationele database in plaats van JSON files
2. **Betere Performance** - Sneller queries en beter schaalbaar
3. **Data Integriteit** - Foreign keys en constraints
4. **Security** - Row Level Security (RLS) policies
5. **Real-time** - Mogelijkheid voor real-time subscriptions (toekomst)
6. **SQL Queries** - Complexe queries mogelijk
7. **Backups** - Automatische backups van Supabase

## 📝 Nog te migreren (optioneel)

De volgende routes gebruiken nog Blob Storage:
- `/api/auth/company` - Company management
- `/api/auth/invite-employee` - Employee invitations
- `/api/auth/activate-employee` - Employee activation
- `/api/auth/list-accounts` - Account listing

Deze kunnen later gemigreerd worden naar Supabase voor volledige migratie.

## 🔄 Data Migratie

**Belangrijk**: Bestaande accounts in Blob Storage zijn NIET automatisch gemigreerd. 

Als je bestaande accounts hebt:
1. Exporteer data uit Blob Storage (via admin panel of API)
2. Importeer data in Supabase via SQL INSERT statements
3. Zorg dat wachtwoord hashes behouden blijven

## 🧪 Testen

Na de migratie:
1. Test account registratie
2. Test login functionaliteit
3. Test profiel updates
4. Test wachtwoord wijziging

## 📚 Documentatie

- [Supabase Docs](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

