# Portal stylegids

Deze map bevat de gedeelde UI-primitives en design-tokens voor het WarmeLeads-klantportaal. Iedere pagina onder `src/app/portal/**` bouwt op deze componenten zodat typografie, spacing, kleur en interactiepatronen consistent blijven en matchen met de branding van [warmeleads.eu](https://warmeleads.eu).

## Kernprincipes

1. **Eén bron van waarheid** — class-strings staan in [`tokens.ts`](./tokens.ts), status-kleuren in [`status.ts`](./status.ts), rekensommen in [`math.ts`](./math.ts). Geen ad-hoc kopieën per pagina.
2. **Dunne abstractie** — componenten zijn thin wrappers rond Tailwind-utilities. Geen styling-prop API; wel `className` extension waar handig.
3. **Mobile first** — elke knop heeft `min-h-11`, sticky CTA's respecteren `env(safe-area-inset-bottom)`, sheets vallen onderaan in en centeren op desktop.
4. **Brand-consistent** — `brand-purple` voor primaire interactie, `bg-button-gradient` (orange→red) voor CTAs, `bg-warmeleads-gradient` als accent-strip.

## Kleurrollen

| Rol | Token | Gebruik |
| --- | --- | --- |
| Primary / actief | `brand-purple` (#3B2F75) | Selected state, eyebrows, focus-ring, primaire link |
| CTA | `bg-button-gradient` | Primaire knop op elke pagina (Afrekenen, Opslaan, Activeren) |
| Accent-strip | `bg-warmeleads-gradient` | 3px lijn boven modals/hero elements |
| Surface | `bg-white` + `border-slate-200` + `shadow-sm` | Kaarten, inputs |
| Page background | `bg-slate-50` | Geregeld in `portal/layout.tsx` |
| Body-tekst | `text-slate-700` | Paragrafen |
| Heading | `text-slate-900` | Titels |
| Secondary | `text-slate-500` | Subtitels, helper |
| Dimmed | `text-slate-400` | Placeholders, tertiair |
| Succes | `emerald-{50,500,700}` | Betaald, voltooid |
| Waarschuwing | `amber-{50,500,700}` | Pending, "bijna vol" |
| Fout | `red-{50,500,600}` | Mislukt, foutmelding |
| Informatie | `indigo-{50,500,700}` | Ingepland, aangekondigd |

## Typografie

| Stijl | Klassen |
| --- | --- |
| Page title | `text-xl sm:text-2xl font-bold text-slate-900` |
| Page subtitle | `text-sm text-slate-500` |
| Section eyebrow | `text-[11px] font-bold uppercase tracking-widest text-brand-purple` |
| Section heading | `text-sm font-semibold text-slate-900` |
| Section description | `text-xs text-slate-500` |
| Body inline | `text-sm text-slate-700` |
| Helper | `text-[11px] text-slate-400` |

## Vormgeving

- **Cards/containers**: `rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm`
- **ChoiceTile** (keuze-tile in grid): `rounded-2xl border-2`; idle `border-slate-200 bg-white hover:border-slate-300`, active `border-brand-purple bg-brand-purple/5 shadow-sm` + `CheckCircleSolid` rechtsboven
- **Pills / ToggleGroup**: `rounded-xl bg-slate-100 p-1` container; items `rounded-lg px-3.5 py-2 text-sm font-semibold`; active `bg-white shadow-sm text-slate-900`
- **Status badges**: `rounded-full px-2.5 py-1 text-[11px] font-semibold` + 1.5×1.5 kleur-dot
- **Inputs**: `rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20`
- **Primary CTA (mobile sticky)**: `T.btnPrimary` — min-h-11, button-gradient, shadow-brand-orange/20
- **Primary CTA (card)**: `T.btnPrimaryLg` — iets ruimer, 15px font, hover shadow-xl
- **Secondary CTA**: `T.btnSecondary` — slate-outline, hover bg-slate-50
- **Minimum touch target**: 44px (`min-h-11`)

## Layout

- Pagina-padding wordt in `portal/layout.tsx` afgehandeld (`px-4 py-6 sm:px-6 lg:px-8`). Pagina's geven alleen `space-y-6` (of `space-y-8` voor luchtige pagina's).
- Sticky mobile checkout bar: `T.stickyBar` + pagina-padding `T.pagePaddingForSticky` zodat content niet onder de bar verdwijnt.

## Motion

- Modals / sheets: spring `damping: 28, stiffness: 280` (via `MOTION.springSheet`).
- Inline transitions: `duration: 0.2` (via `MOTION.fast`).
- Toasts: slide-up `y: 50 → 0`, auto-dismiss na 4s.

## Primitives

| Component | Doel |
| --- | --- |
| `PageHeader` | Pagina-titel + subtitel + optionele rechts-actie |
| `PortalSection` | Gestandaardiseerde card-sectie met eyebrow/title/description |
| `ChoiceTile` / `ChoicePill` | Klikbare kaart/pill met active state |
| `ToggleGroup` | Pill-row voor product-tabs, sub-nav, view-switch |
| `NumberStepper` | Dashed prompt → active stepper met live preview |
| `PricingTierLegend` | Staffelprijzen-pills met active highlighting |
| `OrderSummaryCard` | Prijsopsomming met BTW-breakdown + desktop-CTA |
| `StickyCheckoutBar` | Sticky mobile CTA-bar |
| `StatusBadge` | Universele statusbadge (scope: order/appointment/lead) |
| `EmptyState` | Lege-state visual met icoon, titel, body, CTA |
| `Skeleton` | Loading placeholders (Bar, List, Cards, Page) |
| `SheetModal` | Bottom-sheet mobile / centered modal desktop |
| `AnnouncementBar` | Topbar (demo / admin / info) met uniforme hoogte |
| `ToastProvider` / `useToast` | Eén toast-host voor het hele portaal |

## Copy

- "Lead" / "Leads" voor leads-product, "Afspraak" / "Afspraken" voor het afspraken-product. Nooit mengen binnen één zin.
- Getallen in valuta via `formatCurrency` uit [`src/lib/portalFormat.ts`](../../../../lib/portalFormat.ts).
- Datumweergave via `formatDateNl`.

## Uitbreiden

Nieuwe patronen die 2+ keer voorkomen horen hier thuis. Kleine single-use UI kan in de pagina zelf blijven, mits gebaseerd op de tokens hierboven.
