# WarmeLeads – werkafspraken voor Claude

Leadgeneratie- en CRM-platform (Next.js 14 App Router, TypeScript, Tailwind, Supabase). Live op warmeleads.eu via Vercel-project `warmeleads`. Achtergrond: [ARCHITECTURE.md](ARCHITECTURE.md), [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md).

## Werkwijze per opdracht
1. Lees eerst de bestaande code rond de wijziging en volg de patronen, naamgeving en stijl die er al zijn.
2. Maak de wijziging volledig af: randgevallen, foutafhandeling, laad- en lege toestanden, mobiel.
3. Voeg tests toe of werk ze bij (vitest, `src/**/__tests__`) voor logica die je verandert.
4. Controleer vóór afronden: `npm run type-check` en `npm run test` groen; bij wijzigingen aan pagina's of config ook `npm run build`.
5. Commit met een duidelijke Nederlandse boodschap in de stijl van de bestaande log (gewone zin, wat er voor de gebruiker verandert, geen prefixes), en push.

## Automatisch committen en pushen
Een Stop-hook (`.claude/hooks/auto-commit.ps1`) commit en pusht aan het eind van elke beurt wat nog openstaat. Faalt de typecheck, dan blokkeert de hook en moet je de fouten eerst oplossen. Commit bij voorkeur zelf met een goede boodschap; de hook is het vangnet.

Werk altijd direct op `main` (geen featurebranches). Een push naar `main` gaat direct live op warmeleads.eu, dus controleer extra zorgvuldig vóór afronden.

## Omgeving
- Windows, PowerShell 5.1. `npm run dev` gebruikt bash-syntax; lokaal draaien met `npx next dev`.
- Env-variabelen staan in Vercel; lokaal ophalen met `vercel env pull .env.local --yes`. Nooit secrets committen.
- Supabase-project: `qwfkcpwxoymhpfdthpqv` (Warmeleads.eu Project). Migraties in `supabase/`, `supabase-migrations/` en `migrations/`; database-wijzigingen nooit zonder expliciete bevestiging toepassen.
- Lint heeft bestaande schuld (CI blokkeert er niet op); voeg geen nieuwe lintfouten toe in bestanden die je aanraakt.
