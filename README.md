# WarmeLeads Chat Website

## 🚀 Snelle Start

### Optie 1: Normale server (kan crashen)
```bash
npm run dev
```

### Optie 2: Stabiele server met auto-restart ⭐
```bash
npm run dev:stable
```

## 📚 Documentatie

- **Architectuur:** zie [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Overhaul status:** fases 0–9 (fundament, security, data-integriteit, distributie, API-platform, admin UX, CRM, portal, SEO, engineering)
- **Migraties:** `supabase/migrations/` — pas nieuwe migraties toe vóór deploy

## 🧪 Tests & CI

```bash
npm run type-check
npm run test
npm run lint
```

GitHub Actions draait op elke push naar `main`.

## 📍 Website URL
- **Lokale ontwikkeling:** http://localhost:3000
- **Productie:** https://warmeleads.eu

## 🔧 Server Problemen Oplossen

### Als je "connection refused" krijgt:

1. **Stop alle servers:**
   ```bash
   pkill -f "next dev"
   ```

2. **Start stabiele server:**
   ```bash
   npm run dev:stable
   ```

3. **Of start handmatig:**
   ```bash
   npm run dev
   ```

### Server logs bekijken:
```bash
tail -f server.log
```

## 🎯 Demo Account
- **Email:** demo@warmeleads.nl
- **Wachtwoord:** demo123

## 🛠️ Technische Details
- **Framework:** Next.js 14.2.32
- **Styling:** Tailwind CSS 3.4.17
- **State Management:** Zustand
- **Authentication:** Custom auth store
- **Payment:** Stripe integration

## 📁 Belangrijke Bestanden
- `src/app/page.tsx` - Hoofdpagina
- `src/components/ChatInterface.tsx` - Chat interface
- `src/lib/auth.ts` - Authenticatie store
- `start-server.sh` - Auto-restart script

## 🚨 Troubleshooting

### Server crasht steeds:
1. Gebruik `npm run dev:stable` in plaats van `npm run dev`
2. Check `server.log` voor errors
3. Herstart met `./start-server.sh`

### TypeScript errors:
1. Run `npm run build` om errors te vinden
2. Fix alle type errors
3. Start server opnieuw

### Port 3000 is bezet:
1. Stop alle servers: `pkill -f "next dev"`
2. Start opnieuw: `npm run dev:stable`# Force rebuild to load new env vars
