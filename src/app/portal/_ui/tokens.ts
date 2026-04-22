/**
 * Portal stylegids tokens
 *
 * Benoemde class-strings die alle primitives delen. Geen runtime-kosten,
 * enkel re-usable constants zodat Tailwind-utilities consistent blijven.
 *
 * Zie ./README.md voor de volledige stylegids.
 */

export const T = {
  // Surfaces
  card: 'rounded-2xl border border-slate-200 bg-white shadow-sm',
  cardPadding: 'p-4 sm:p-5',
  cardMuted: 'rounded-2xl border border-slate-100 bg-slate-50/60',

  // Typography
  pageTitle: 'text-xl font-bold text-slate-900 sm:text-2xl',
  pageSubtitle: 'mt-0.5 text-sm text-slate-500',
  eyebrow: 'text-[11px] font-bold uppercase tracking-widest text-brand-purple',
  sectionHeading: 'text-sm font-semibold text-slate-900',
  sectionDescription: 'mt-0.5 text-xs text-slate-500',
  bodyMuted: 'text-sm text-slate-500',
  helper: 'text-[11px] text-slate-400',

  // Interactive
  tileBase: 'relative rounded-2xl border-2 p-3 text-left transition',
  tileIdle: 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
  tileActive: 'border-brand-purple bg-brand-purple/5 shadow-sm',
  tileDashed: 'border-dashed border-slate-200',

  // Pill / tab container
  pillGroup: 'inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1',
  pillItem: 'flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition',
  pillActive: 'bg-white text-slate-900 shadow-sm',
  pillIdle: 'text-slate-500 hover:text-slate-700',

  // Forms
  input: 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20',
  textarea: 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20',
  focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2',

  // Buttons
  btnPrimary: 'flex min-h-11 items-center justify-center gap-2 rounded-xl bg-button-gradient px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition active:scale-[0.99] disabled:opacity-50 disabled:shadow-none',
  btnPrimaryLg: 'flex w-full min-h-11 items-center justify-center gap-2.5 rounded-xl bg-button-gradient px-6 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-xl active:scale-[0.99] disabled:opacity-50 disabled:shadow-none',
  btnSecondary: 'flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60',
  btnGhost: 'flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700',
  btnDanger: 'flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60',
  btnIconSquare: 'flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50',

  // Badges
  badgeBase: 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',

  // Sticky & safe-area helpers
  stickyBar: 'fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.55)] backdrop-blur sm:hidden',
  pagePaddingForSticky: 'pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pb-0',
} as const;

export const LAYOUT = {
  pageStack: 'space-y-6',
  pageStackLoose: 'space-y-8',
} as const;

export const MOTION = {
  springSheet: { type: 'spring' as const, damping: 28, stiffness: 280 },
  fast: { duration: 0.2 },
} as const;
