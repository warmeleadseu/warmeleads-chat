# 🔧 Stripe Webhook Configuratie - WarmeLeads

Deze instructies helpen je om de Stripe webhooks correct te configureren zodat betalingen automatisch worden verwerkt.

## ⚠️ **BELANGRIJK: Zonder webhooks worden bestellingen NIET opgeslagen!**

De webhook zorgt ervoor dat:
- ✅ Bestellingen worden opgeslagen in Blob Storage
- ✅ Klanten een bevestigingsmail ontvangen
- ✅ Facturen worden gegenereerd en opgeslagen
- ✅ Orders zichtbaar zijn in het Customer Portal

---

## 📋 **Stap 1: Stripe Dashboard Inloggen**

1. Ga naar [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Log in met je Stripe account
3. **BELANGRIJK**: Zorg dat je in **LIVE MODE** bent (niet Test Mode) voor productie

---

## 📋 **Stap 2: Webhook Endpoint Toevoegen**

1. **Navigeer naar Webhooks**:
   - Klik op **Developers** in het menu
   - Klik op **Webhooks**
   - Klik op **+ Add endpoint**

2. **Vul de Webhook URL in**:
   ```
   https://www.warmeleads.eu/api/webhooks/stripe
   ```
   
3. **Selecteer Events om te luisteren**:
   
   Klik op **Select events** en selecteer de volgende events:
   
   - ✅ `checkout.session.completed` **(VERPLICHT)**
   - ✅ `payment_intent.succeeded` (Aanbevolen)
   - ✅ `payment_intent.payment_failed` (Optioneel, voor error handling)
   - ✅ `customer.created` (Optioneel, voor CRM sync)

4. **Klik op Add endpoint**

---

## 📋 **Stap 3: Webhook Secret Ophalen**

1. **Na het toevoegen van de webhook**:
   - Je ziet nu je webhook endpoint in de lijst
   - Klik op de webhook om details te zien

2. **Kopieer de Signing Secret**:
   - Je ziet een sectie "Signing secret"
   - Klik op **Reveal** om de secret te tonen
   - Kopieer de hele string (begint met `whsec_...`)

3. **Voorbeeld**:
   ```
   whsec_1234567890abcdefghijklmnopqrstuvwxyz
   ```

---

## 📋 **Stap 4: Webhook Secret Toevoegen aan Vercel**

1. **Ga naar Vercel Dashboard**:
   - [https://vercel.com/dashboard](https://vercel.com/dashboard)
   - Selecteer je **warmeleads-chat** project

2. **Ga naar Settings**:
   - Klik op **Settings** tab
   - Klik op **Environment Variables** in het linker menu

3. **Voeg nieuwe Environment Variable toe**:
   - **Key**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: Plak de signing secret die je hebt gekopieerd (bijv. `whsec_123...`)
   - **Environments**: Selecteer **Production** (en optioneel Preview/Development)
   - Klik op **Save**

---

## 📋 **Stap 5: Redeploy de Applicatie**

**BELANGRIJK**: Environment variables worden alleen actief na een nieuwe deployment!

### Optie A: Via Vercel Dashboard
1. Ga naar je project in Vercel
2. Klik op **Deployments** tab
3. Klik op de drie puntjes (...) bij de laatste deployment
4. Klik op **Redeploy**

### Optie B: Via Terminal
```bash
cd /Users/rickschlimback/Desktop/WL1sep\ -\ nieuww/warmeleads-chat
npx vercel --prod --yes
```

---

## 🧪 **Stap 6: Test de Webhook**

### Via Stripe Dashboard:
1. Ga naar **Developers** → **Webhooks**
2. Klik op je webhook endpoint
3. Klik op **Send test webhook**
4. Selecteer `checkout.session.completed`
5. Klik op **Send test webhook**

Je zou nu in de Vercel logs moeten zien:
```
✅ Checkout session completed: cs_test_...
📋 Saving order from session to Blob Storage: WL-2025-...
✅ Order from session saved successfully
```

### Via Echte Betaling (Test Branch):
1. Ga naar [https://www.warmeleads.eu/portal](https://www.warmeleads.eu/portal)
2. Klik op **Nieuwe bestelling**
3. Selecteer **Test** branche
4. Kies **Exclusieve Test Leads** (€0,01)
5. Vul aantal in (bijv. 1)
6. Klik op **Doorgaan naar betalen**
7. Gebruik iDEAL test bank of test creditcard:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits

8. Na succesvolle betaling:
   - ✅ Je wordt doorgestuurd naar portal met success modal
   - ✅ Order verschijnt in "Recente bestellingen"
   - ✅ Check Vercel logs voor webhook verwerking

---

## 🔍 **Troubleshooting**

### Probleem: Webhook wordt niet getriggerd
**Oplossing**:
1. Check of de webhook URL correct is: `https://www.warmeleads.eu/api/webhooks/stripe`
2. Check of `checkout.session.completed` event is geselecteerd
3. Kijk in Stripe Dashboard → Webhooks → [je endpoint] → **Recent deliveries** voor errors

### Probleem: "Webhook signature verification failed"
**Oplossing**:
1. Check of `STRIPE_WEBHOOK_SECRET` correct is ingesteld in Vercel
2. Zorg dat de secret begint met `whsec_`
3. Redeploy de applicatie na het toevoegen van de environment variable

### Probleem: Orders worden niet opgeslagen
**Oplossing**:
1. Check Vercel logs: `npx vercel logs warmeleads-chat --prod`
2. Zoek naar errors in de webhook handler
3. Controleer of Blob Storage correct werkt

### Probleem: Emails worden niet verstuurd
**Status**: Email service is voorlopig in development mode en logt alleen naar console.

**Om echte emails te versturen**:
1. Integreer een email service (bijv. Resend, SendGrid)
2. Update `src/lib/emailService.ts` met de email provider API
3. Voeg API key toe als environment variable

---

## 📊 **Monitoring**

### Vercel Logs Bekijken:
```bash
npx vercel logs warmeleads-chat --prod
```

### Stripe Webhook Logs:
1. Ga naar Stripe Dashboard
2. **Developers** → **Webhooks**
3. Klik op je endpoint
4. Check **Recent deliveries** voor successes/failures

---

## ✅ **Checklist**

- [ ] Webhook endpoint toegevoegd in Stripe Dashboard
- [ ] `checkout.session.completed` event geselecteerd
- [ ] Signing secret gekopieerd
- [ ] `STRIPE_WEBHOOK_SECRET` toegevoegd aan Vercel Environment Variables
- [ ] Applicatie opnieuw gedeployed
- [ ] Test webhook verstuurd via Stripe Dashboard
- [ ] Echte test betaling gedaan met Test branche (€0,01)
- [ ] Order zichtbaar in Customer Portal
- [ ] Webhook logs gecheckt in Vercel

---

## 🎉 **Klaar!**

Je Stripe webhooks zijn nu correct geconfigureerd. Alle betalingen worden automatisch verwerkt en orders worden opgeslagen in Blob Storage!

Voor vragen of problemen, check de Vercel logs of Stripe webhook delivery logs.

