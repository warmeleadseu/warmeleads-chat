# 🔧 Supabase Configuratie voor Password Reset

## ⚠️ BELANGRIJK: Redirect URLs Configureren

De password reset link wijst nu naar `localhost:3000` omdat de redirect URL nog niet is geconfigureerd in Supabase. Volg deze stappen:

---

## Stap 1: Whitelist Redirect URLs in Supabase

### 1. Open Supabase Dashboard
- Ga naar [app.supabase.com](https://app.supabase.com)
- Selecteer je **WarmeLeads** project

### 2. Configureer Redirect URLs
1. Klik op **Authentication** in het linker menu
2. Klik op **URL Configuration**
3. Scroll naar **Redirect URLs**

### 3. Voeg Deze URLs Toe:
```
https://www.warmeleads.eu/reset-password
https://warmeleads.eu/reset-password
```

**Optioneel (voor development):**
```
http://localhost:3000/reset-password
```

### 4. Site URL Instellen
Zorg dat **Site URL** is ingesteld op:
```
https://www.warmeleads.eu
```

### 5. Klik op **Save**

---

## Stap 1.5: Email Auth Flow Type Checken ⚡ **BELANGRIJK**

### **DIT IS CRUCIAAL VOOR PASSWORD RESET!**

1. Ga naar **Authentication** → **URL Configuration**
2. Scroll naar beneden naar **Email Auth**
3. **Controleer de Flow Type:**
   - Er zijn twee opties: `Magic Link` of `PKCE`
   - **Voor password reset moet dit PKCE zijn!**
4. Als het op `Magic Link` staat:
   - Verander naar **PKCE**
   - Klik op **Save**

**Waarom?** PKCE is veiliger en werkt beter met moderne browsers en password reset flows.

---

## Stap 2: Email Afzender Configureren 📧

### 1. Ga naar Project Settings
1. Klik op **Settings** (tandwiel icoon linksonder)
2. Klik op **Authentication**

### 2. Configureer Email Sender
Scroll naar **SMTP Settings** of **Email** sectie:

**Sender Name:**
```
WarmeLeads
```

**Sender Email:**
```
noreply@warmeleads.eu
```

**OF (als je een eigen email wilt):**
```
support@warmeleads.eu
```

### 3. Custom SMTP (Optioneel - Aanbevolen voor productie)

Voor nog betere deliverability, configureer je eigen SMTP:

**Provider opties:**
- **SendGrid** (gratis tier: 100 emails/dag)
- **Mailgun** (gratis tier: 100 emails/dag)
- **Amazon SES** (zeer goedkoop, hoge deliverability)

**SMTP Configuratie in Supabase:**
1. Enable **Custom SMTP**
2. Vul in:
   - **Host:** `smtp.sendgrid.net` (of je provider)
   - **Port:** `587`
   - **Username:** Je API username
   - **Password:** Je API key
   - **Sender Email:** `noreply@warmeleads.eu`
   - **Sender Name:** `WarmeLeads`

### 4. Klik op **Save**

---

## Stap 3: Email Template Configureren

### 1. Ga naar Email Templates
1. Klik op **Authentication** → **Email Templates**
2. Selecteer **Reset Password**

### 2. Configureer de Template

**Subject:**
```
Wachtwoord Resetten - WarmeLeads 🔐
```

**Message (Body):**
Kopieer de volledige HTML uit `email-templates/password-reset.html`

### 3. Klik op **Save**

---

## Stap 3: Test de Flow

### Test Scenario:
1. Ga naar `warmeleads.eu`
2. Klik op **Login**
3. Klik op **Wachtwoord vergeten?**
4. Vul je email in
5. Klik op **Verstuur link**
6. Check je inbox
7. Klik op **Reset Mijn Wachtwoord** in de email
8. Je wordt doorgestuurd naar `https://www.warmeleads.eu/reset-password`
9. Vul nieuw wachtwoord in (2x)
10. Klik op **Wachtwoord Wijzigen**
11. Success! → Redirect naar login

---

## ✅ Checklist

- [ ] Redirect URLs toegevoegd aan Supabase (stap 1)
- [ ] Site URL ingesteld op `warmeleads.eu` (stap 1)
- [ ] **Email afzender naam aangepast naar "WarmeLeads"** (stap 2) ⭐ **NIEUW**
- [ ] Email template geüpdatet met branded HTML (stap 3)
- [ ] Getest: Password reset flow werkt van A tot Z (stap 4)
- [ ] Code gedeployed naar production (Vercel)

---

## 🔍 Troubleshooting

### Probleem: Link wijst nog naar localhost
**Oorzaak:** Redirect URLs niet gewhitelist in Supabase
**Oplossing:** Voeg URLs toe in stap 1

### Probleem: "Invalid redirect URL" error
**Oorzaak:** URL niet exact hetzelfde in Supabase en code
**Oplossing:** Check dat URL **exact** overeenkomt (met/zonder www, met/zonder trailing slash)

### Probleem: Email ziet er niet branded uit
**Oorzaak:** Email template niet geüpdatet
**Oplossing:** Volg stap 2

### Probleem: Reset werkt niet
**Oorzaak:** `/reset-password` pagina bestaat niet
**Oplossing:** Deploy de nieuwe `src/app/reset-password/page.tsx`

---

## 📝 Wat Hebben We Gebouwd?

### 1. API Route
`/api/auth/reset-password`
- Stuurt Supabase reset email
- Gebruikt correcte redirect URL (`warmeleads.eu/reset-password`)

### 2. Reset Password Pagina
`/reset-password`
- Mooie branded UI
- Password strength indicator
- Validatie (min 6 chars, passwords match)
- Success state met auto-redirect
- Mobile-friendly

### 3. Email Template
`email-templates/password-reset.html`
- WarmeLeads branding
- Purple/pink gradient header
- Orange CTA button
- Security notices
- Contact info in footer

---

## 🚀 Deployment

```bash
# Commit en push
git add -A
git commit -m "🔐 Password reset met custom branded email & redirect"
git push

# Deploy naar production
vercel --prod
```

---

## 🎯 Result

**Voor:**
- Reset link wijst naar localhost ❌
- Lelijke Supabase default email ❌
- Geen branded flow ❌

**Na:**
- Reset link wijst naar `warmeleads.eu/reset-password` ✅
- Mooie WarmeLeads branded email ✅
- Complete flow met password strength indicator ✅
- Mobile-friendly & professional ✅

---

**Questions?** → support@warmeleads.eu

