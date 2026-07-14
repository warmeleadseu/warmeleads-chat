# 🌐 WarmeLeads Live Zetten op www.warmeleads.eu via MijnDomein

## 📦 **JE HEBT NU KLAAR:**
✅ **Production build**: Geoptimaliseerd en getest
✅ **Deployment ZIP**: `warmeleads-production.zip` (klaar voor upload)
✅ **Alle functionaliteiten**: Chat, ROI calculator, contact opties
✅ **Contactgegevens**: Alle emails/telefoons bijgewerkt

## 🚀 **STAP-VOOR-STAP MIJNDOMEIN DEPLOYMENT:**

### **STAP 1: Login bij MijnDomein**
1. Ga naar [mijndomein.nl](https://www.mijndomein.nl)
2. Login met je account
3. Ga naar "Mijn Producten" → "Hosting"

### **STAP 2: Hosting Configureren**
1. **Selecteer** je warmeleads.eu hosting pakket
2. **Ga naar** "Bestanden" of "File Manager"
3. **Navigeer** naar de root directory (meestal `public_html` of `httpdocs`)

### **STAP 3: Upload Website**
1. **Upload** `warmeleads-production.zip`
2. **Extract/Unzip** de bestanden in de root directory
3. **Verwijder** de ZIP na extractie

### **STAP 4: Node.js Activeren**
1. **Ga naar** "Instellingen" → "Node.js" (of "Applicaties")
2. **Enable** Node.js (versie 18+ selecteren)
3. **Set startup file**: `server.js` of laat leeg voor auto-detect
4. **Set startup command**: `npm start`

### **STAP 5: Environment Variables**
1. **Ga naar** "Environment Variables" sectie
2. **Voeg toe**:
```
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://www.warmeleads.eu
```

### **STAP 6: Domain Instellen**
1. **Ga naar** "Domeinen" beheer
2. **Zorg** dat www.warmeleads.eu wijst naar je hosting
3. **Enable** SSL certificaat (gratis Let's Encrypt)
4. **Force** HTTPS redirect

### **STAP 7: Dependencies Installeren**
MijnDomein zal automatisch uitvoeren:
```bash
npm install --production
npm run build
npm start
```

## ✅ **VERIFICATIE CHECKLIST**

### **Test deze URLs na deployment:**
- [ ] `https://www.warmeleads.eu` - Homepage laadt
- [ ] **Direct leads bestellen** - Express checkout werkt
- [ ] **ROI Calculator** - Bereken winst werkt
- [ ] **Contact opties** - Telefoon/email/WhatsApp werken
- [ ] **Chat flows** - Alle gesprekken werken
- [ ] **Mobile** - Responsive design werkt

### **Test contactgegevens:**
- [ ] 📞 **+31 85 047 7067** - Telefoon werkt
- [ ] 📧 **info@warmeleads.eu** - Email werkt  
- [ ] 💬 **+31 6 1392 7338** - WhatsApp werkt

## 🔧 **TROUBLESHOOTING**

### **Als website niet laadt:**
1. Check Node.js is enabled
2. Verify startup command: `npm start`
3. Check error logs in MijnDomein panel
4. Ensure all files are uploaded

### **Als functies niet werken:**
1. Check environment variables zijn ingesteld
2. Verify SSL certificaat is actief
3. Test in incognito mode (cache issues)

### **Voor Stripe betalingen (later):**
1. Krijg live Stripe keys
2. Update environment variables
3. Configure webhook: `https://www.warmeleads.eu/api/webhooks/stripe`

## 🎉 **RESULTAAT**

Na deze stappen heb je:
- ✅ **Live website** op www.warmeleads.eu
- ✅ **Alle functionaliteiten** werkend
- ✅ **Professional uitstraling**
- ✅ **Mobile responsive**
- ✅ **SEO geoptimaliseerd**
- ✅ **Contact integratie**

**SUCCESS! WarmeLeads is live! 🚀**

## 📞 **Support**

**MijnDomein problemen?** Contacteer hun support
**Website problemen?** Neem contact op via:
- 📞 +31 85 047 7067
- 📧 info@warmeleads.eu






