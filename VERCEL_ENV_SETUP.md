# 🔧 VERCEL ENVIRONMENT VARIABLES - TOEVOEGEN

**Probleem**: Login faalt omdat Supabase credentials ontbreken in Vercel productie.

## ✅ STAPPEN OM TE FIXEN:

### 1. Ga naar Vercel Dashboard
https://vercel.com/warmeleads-projects/warmeleads-chat/settings/environment-variables

### 2. Voeg deze Environment Variables toe:

#### **Supabase (REQUIRED voor login)**
```
NEXT_PUBLIC_SUPABASE_URL=https://klnstthwdtszrqsmsljq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsbnN0dGh3ZHRzenJxc21zbGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMDA5NDMsImV4cCI6MjA3NzU3Njk0M30.seqTPNeEjJMsWV2lSOsLJ8uTaZkWNUBlB1vaSNZ2PPA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsbnN0dGh3ZHRzenJxc21zbGpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAwMDk0MywiZXhwIjoyMDc3NTc2OTQzfQ.4ypmx6ko942VSu-__ZtaRl8psGZfKIBmpQSVivg9Mys
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

