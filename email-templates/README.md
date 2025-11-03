# WarmeLeads Email Templates

Custom branded email templates voor Supabase Auth emails.

## 📧 Templates

### Password Reset Email (`password-reset.html`)
Mooie, branded email voor wachtwoord reset met:
- WarmeLeads gradient branding (purple/pink)
- Orange CTA button
- Duidelijke instructies
- Security waarschuwingen
- 60 minuten expiry notice
- Fallback link (voor als button niet werkt)
- Contact informatie in footer

## 🚀 Installatie in Supabase Dashboard

### Stap 1: Open Supabase Dashboard
1. Ga naar [app.supabase.com](https://app.supabase.com)
2. Selecteer je WarmeLeads project
3. Klik op **Authentication** in het linker menu
4. Klik op **Email Templates**

### Stap 2: Configureer Password Reset Template

1. Selecteer **Reset Password** in de template lijst
2. **Subject:** `Wachtwoord Resetten - WarmeLeads 🔐`
3. Kopieer de volledige HTML code uit `password-reset.html`
4. Plak in het **Message (Body)** veld
5. Klik **Save**

### Stap 3: Test de Template

1. Ga naar je website: `warmeleads.eu`
2. Klik op login
3. Klik "Wachtwoord vergeten?"
4. Vul je email in
5. Check je inbox → De nieuwe branded email zou moeten verschijnen! ✨

## 🎨 Template Features

### Header
- Purple/pink gradient achtergrond
- WarmeLeads logo/naam
- Tagline: "Verse Leads, Warme Resultaten"

### Content
- Duidelijke titel
- Persoonlijke aanhef
- Orange gradient CTA button
- Yellow warning box (60 minuten geldig)
- Fallback link in code block
- Red security notice

### Footer
- Dark gray achtergrond
- Contact links (email + website)
- Copyright notice
- Professionele uitstraling

## 🔧 Aanpassingen

### Colors
- **Primary Purple:** `#667eea` → `#764ba2`
- **Primary Orange:** `#f97316` → `#dc2626`
- **Background:** `#f3f4f6`
- **Text:** `#1f2937` (dark), `#4b5563` (medium), `#6b7280` (light)

### Content Aanpassen
Zoek naar deze secties in de HTML:
- **Subject line:** Pas aan in Supabase dashboard
- **Header titel:** `<h1>🔐 WarmeLeads</h1>`
- **Tagline:** `<p>Verse Leads, Warme Resultaten</p>`
- **Footer links:** `support@warmeleads.eu` en `www.warmeleads.eu`

## 📝 Andere Email Templates

Je kunt ook custom templates maken voor:
- **Confirm Signup** - Bevestig email adres
- **Invite User** - Team uitnodigingen
- **Magic Link** - Passwordless login
- **Email Change** - Email wijzigen

Kopieer de styling van deze template en pas de content aan!

## ⚠️ Belangrijk

- De `{{ .ConfirmationURL }}` variabele wordt **automatisch** door Supabase vervangen
- Test altijd eerst in development voordat je live gaat
- HTML moet inline CSS gebruiken (zoals in deze template)
- Preview in verschillende email clients (Gmail, Outlook, Apple Mail)

## 🎯 Result

**Voor:**
- Basic Supabase default email
- Geen branding
- Lelijk, onprofessioneel

**Na:**
- Mooie WarmeLeads branded email
- On-brand colors en styling
- Professioneel en vertrouwenwekkend
- Duidelijke CTA en instructies

---

**Succes met de implementatie!** 🚀

Vragen? → support@warmeleads.eu

