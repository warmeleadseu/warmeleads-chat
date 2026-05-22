# Meta App Review screencasts

## Welke video uploaden?

| Situatie | Wat uploaden |
|----------|----------------|
| **Eén gecombineerde App Review-aanvraag** (jouw situatie) | Mag: **één** video (`warmeleads-meta-app-review.mp4`) bij **elke** permissie, **of** per permissie het bijbehorende bestand hieronder |
| **Meta vraagt expliciet per permissie een eigen screencast** | Gebruik de `meta-review-<permissie>.mp4` bestanden |

## Per permissie (aanbevolen bij aparte upload-velden)

| Permissie | Bestand |
|-----------|---------|
| `business_management` | `meta-review-business_management.mp4` |
| `pages_show_list` | `meta-review-pages_show_list.mp4` |
| `pages_read_engagement` | `meta-review-pages_read_engagement.mp4` |
| `pages_manage_ads` | `meta-review-pages_manage_ads.mp4` |
| `leads_retrieval` | `meta-review-leads_retrieval.mp4` |
| `ads_management` | `meta-review-ads_management.mp4` |

## Alles-in-één

`warmeleads-meta-app-review.mp4` — volledige flow (~1:21). Geschikt om overal dezelfde te plakken.

## Wat de video laat zien

1. Intro — Warme Leads internal admin CRM  
2. **Koppelingen** — Meta-token, ad account, verbinding + sync  
3. **AI campagnes** — Lead Form wizard  
4. **Facebook-pages** (scroll + zoeken) — `pages_show_list`, `pages_read_engagement`  
5. **AI draft** — `leads_retrieval` context  
6. **Maak aan in Meta** — `pages_manage_ads` (eventueel fout #3 tot App Review klaar is)  
7. Studio / brief — `ads_management`

Opname draait tegen **localhost** met **productie-database** (zelfde data als warmeleads.eu).

## Opnieuw opnemen

```bash
# Terminal 1 — dev server
set -a && source .env.vercel.prod.full && set +a
npm run dev -- --port 3010

# Terminal 2 — alle permissies apart
set -a && source .env.vercel.prod.full && set +a
export SCREENCAST_BASE_URL=http://localhost:3010
export SCREENCAST_ADMIN_EMAIL=info@warmeleads.eu
npm install playwright @ffmpeg-installer/ffmpeg --no-save
npx playwright install chromium
node scripts/record-meta-app-review-by-permission.mjs

# Of alleen één permissie:
SCREENCAST_ONLY=pages_manage_ads node scripts/record-meta-app-review-by-permission.mjs

# Of de gecombineerde video:
node scripts/record-meta-app-review.mjs
```
