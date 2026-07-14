# 🔧 VERCEL ENVIRONMENT VARIABLES - TOEVOEGEN

**Probleem**: Login faalt omdat Supabase credentials ontbreken in Vercel productie.

## ✅ STAPPEN OM TE FIXEN:

### 1. Ga naar Vercel Dashboard
https://vercel.com/warmeleads-projects/warmeleads-chat/settings/environment-variables

### 2. Voeg deze Environment Variables toe:

#### **Supabase (REQUIRED voor login)**

> ⚠️ Zet de echte waarden NOOIT in dit bestand. Haal ze uit het Supabase-
> dashboard (Project Settings → API) en zet ze in Vercel én in je lokale
> `.env.local` (die staat in `.gitignore`).

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

#### **Stripe (optioneel, maar voorkomt warnings)**
```
STRIPE_SECRET_KEY=sk_test_... (jouw Stripe secret key)
```

### 3. Belangrijk: Environment voor ALLE environments
- ✅ Production
- ✅ Preview  
- ✅ Development

### 4. Redeploy
Na het toevoegen:
- Klik "Redeploy" in Vercel
- OF push een kleine change naar GitHub

---

## 🚀 QUICK FIX VIA CLI (Optioneel)

Of gebruik Vercel CLI om ze snel toe te voegen:

```bash
cd /Users/rickschlimback/Desktop/WarmeLeads

# Supabase vars
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Dan redeploy
vercel --prod
```

---

## ✅ NA HET TOEVOEGEN:

1. Wacht tot nieuwe deployment klaar is (2-3 min)
2. Test login opnieuw op warmeleads.eu
3. Login zou moeten werken! 🎉

