'use client';

/**
 * SearchableSelect — single-select dropdown met ingebouwde zoekbalk.
 *
 * Waarom dit component bestaat:
 *   Native `<select>` elementen tonen op macOS (Safari/Chrome) een
 *   browser-controlled picker die bij lange lijsten (50+ items) afknipt
 *   onderaan de viewport zonder dat de gebruiker kan scrollen. In modals
 *   en off-canvas drawers is dat onbruikbaar — admins kunnen klanten
 *   verderop in de lijst niet meer kiezen.
 *
 *   Deze component vervangt native selects op kritieke plekken
 *   (klantkiezers in Bulk Export, Nieuwe batch, Nieuwe factuur etc.) met
 *   een:
 *     - vaste max-height + interne `overflow-y-auto` (altijd scrollbaar)
 *     - search-input die direct focus krijgt bij openen (≥6 opties)
 *     - keyboard navigation (↑/↓/Enter/Esc + Home/End)
 *     - click-outside om te sluiten
 *     - WAI-ARIA combobox role + listbox + aria-activedescendant
 *
 * UX-detail: de dropdown opent standaard naar BENEDEN, maar flipt naar
 * BOVEN wanneer er onderaan minder ruimte is dan de panel-hoogte. Dat
 * voorkomt dat de dropdown in een drawer alsnog onderaan afknipt.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon, CheckIcon } from '@heroicons/react/24/outline';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Optionele subtekst rechts naast label (bv. e-mail bij klant). */
  sub?: string;
  /** Optionele groep-key — gebruikt om visueel te clusteren. */
  group?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  /** Tekst voor de trigger wanneer er nog geen waarde is. */
  placeholder?: string;
  /**
   * Tekst voor de explicit empty-option in de lijst (bv. "Geen specifieke
   * klant"). Wordt bovenaan getoond, en bij click zet hij value op ''.
   * Laat weg om de empty-keuze te verbergen — dan moet er altijd iets
   * geselecteerd worden.
   */
  emptyOptionLabel?: string;
  /** Zoek-input zichtbaar maken. Default: true zodra opties.length ≥ 6. */
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** Tailwind classes voor de trigger-knop (bv. h-9 voor compacte filters). */
  className?: string;
  /** Tailwind classes voor de dropdown-panel (bv. w-[min(...)] override). */
  panelClassName?: string;
  /** Voor aria-labelledby koppeling met een externe `<label>`. */
  id?: string;
  /** ARIA label wanneer er geen visuele label bovenaan staat. */
  ariaLabel?: string;
}

const PANEL_MAX_HEIGHT = 288; // ≈ 18rem ≈ ~6-7 zichtbare items
const SEARCH_AUTO_THRESHOLD = 6;

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecteer…',
  emptyOptionLabel,
  searchable,
  searchPlaceholder = 'Zoeken…',
  disabled = false,
  className = '',
  panelClassName = '',
  id,
  ariaLabel,
}: SearchableSelectProps) {
  const generatedId = useId();
  const triggerId = id || generatedId;
  const listboxId = `${triggerId}-listbox`;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [flipUp, setFlipUp] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const showSearch = searchable ?? options.length >= SEARCH_AUTO_THRESHOLD;

  // Filter + groep-flatten met optionele "empty"-rij vooraan.
  const filteredItems = useMemo<Array<{ kind: 'empty' } | { kind: 'option'; option: SearchableSelectOption }>>(() => {
    const q = search.trim().toLowerCase();
    const filteredOptions = q
      ? options.filter(o =>
          o.label.toLowerCase().includes(q) ||
          (o.sub ? o.sub.toLowerCase().includes(q) : false),
        )
      : options;

    const out: Array<{ kind: 'empty' } | { kind: 'option'; option: SearchableSelectOption }> = [];
    // Empty-optie alleen tonen bij lege zoekquery: anders verstoort hij filtering.
    if (emptyOptionLabel && !q) out.push({ kind: 'empty' });
    for (const opt of filteredOptions) out.push({ kind: 'option', option: opt });
    return out;
  }, [options, search, emptyOptionLabel]);

  const totalItems = filteredItems.length;

  const selectedOption = useMemo(() => options.find(o => o.value === value) || null, [options, value]);

  const triggerLabel = useMemo(() => {
    if (selectedOption) return selectedOption.label;
    if (value === '' && emptyOptionLabel) return emptyOptionLabel;
    return placeholder;
  }, [selectedOption, value, emptyOptionLabel, placeholder]);

  /* ── Click outside ─────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  /* ── Flip-up bepalen + search auto-focus bij openen ───── */
  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // We flippen alleen wanneer er onder DUIDELIJK te weinig ruimte is
      // (< panel) én er BOVEN meer ruimte is. Dit voorkomt dat we per
      // ongeluk omhoog openen terwijl er net genoeg ruimte is onder.
      setFlipUp(spaceBelow < PANEL_MAX_HEIGHT + 24 && spaceAbove > spaceBelow);
    }
    if (showSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open, showSearch]);

  /* ── Bij heropenen: zet activeIndex op huidige waarde of 0 ── */
  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    // Bepaal index van currently selected; anders 0 (of empty-rij).
    const idx = filteredItems.findIndex(it => it.kind === 'option' && it.option.value === value);
    setActiveIndex(idx >= 0 ? idx : (filteredItems[0] ? 0 : -1));
    // We willen activeIndex alleen recomputen bij open-event, niet bij elke
    // search-keystroke (die handleSearchChange beheert hieronder).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ── activeIndex zichtbaar houden bij keyboard nav ────── */
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = itemRefs.current.get(activeIndex);
    if (el && listRef.current) {
      const list = listRef.current;
      const elTop = el.offsetTop;
      const elBottom = elTop + el.offsetHeight;
      if (elTop < list.scrollTop) list.scrollTop = elTop;
      else if (elBottom > list.scrollTop + list.clientHeight) list.scrollTop = elBottom - list.clientHeight;
    }
  }, [activeIndex, open]);

  /* ── Selectie ─────────────────────────────────────────── */
  const commitIndex = useCallback((idx: number) => {
    const item = filteredItems[idx];
    if (!item) return;
    if (item.kind === 'empty') {
      onChange('');
    } else {
      if (item.option.disabled) return;
      onChange(item.option.value);
    }
    setOpen(false);
    setSearch('');
    // Focus terug naar trigger zodat tab-volgorde logisch blijft.
    setTimeout(() => triggerRef.current?.focus(), 0);
  }, [filteredItems, onChange]);

  /* ── Keyboard handlers op zowel trigger als zoek-input ── */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setSearch('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => {
        let next = i + 1;
        // Sla disabled opties over.
        while (next < totalItems) {
          const it = filteredItems[next];
          if (it.kind === 'option' && it.option.disabled) next++;
          else break;
        }
        return next < totalItems ? next : i;
      });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => {
        let next = i - 1;
        while (next >= 0) {
          const it = filteredItems[next];
          if (it.kind === 'option' && it.option.disabled) next--;
          else break;
        }
        return next >= 0 ? next : i;
      });
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(totalItems > 0 ? 0 : -1);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(totalItems > 0 ? totalItems - 1 : -1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) commitIndex(activeIndex);
      return;
    }
  };

  const handleSearchChange = (raw: string) => {
    setSearch(raw);
    // Reset active naar de eerste niet-disabled match.
    setActiveIndex(0);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-disabled={disabled || undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
      >
        <span className={`truncate ${selectedOption ? '' : 'text-slate-500'}`}>{triggerLabel}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute left-0 z-[100] w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ${
            flipUp ? 'bottom-full mb-1' : 'top-full mt-1'
          } ${panelClassName}`}
        >
          {showSearch && (
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => handleSearchChange(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-1.5 pl-8 pr-3 text-sm text-slate-700 outline-none focus:border-brand-purple/50 focus:bg-white"
                />
              </div>
            </div>
          )}

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={triggerId}
            className="overflow-y-auto py-1"
            style={{ maxHeight: PANEL_MAX_HEIGHT }}
          >
            {totalItems === 0 && (
              <p className="px-3 py-4 text-center text-xs text-slate-400">
                {search ? 'Geen resultaten' : 'Geen opties beschikbaar'}
              </p>
            )}

            {filteredItems.map((item, idx) => {
              const active = idx === activeIndex;
              if (item.kind === 'empty') {
                const isSelected = value === '';
                return (
                  <button
                    key="__empty__"
                    ref={el => {
                      if (el) itemRefs.current.set(idx, el);
                      else itemRefs.current.delete(idx);
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => commitIndex(idx)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                      active ? 'bg-brand-purple/5' : ''
                    } ${isSelected ? 'font-medium text-brand-purple' : 'text-slate-500'}`}
                  >
                    <CheckIcon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-brand-purple' : 'text-transparent'}`} />
                    <span className="flex-1 truncate italic">{emptyOptionLabel}</span>
                  </button>
                );
              }
              const opt = item.option;
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  ref={el => {
                    if (el) itemRefs.current.set(idx, el);
                    else itemRefs.current.delete(idx);
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled || undefined}
                  disabled={opt.disabled}
                  onMouseEnter={() => !opt.disabled && setActiveIndex(idx)}
                  onClick={() => commitIndex(idx)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                    active ? 'bg-brand-purple/5' : ''
                  } ${isSelected ? 'font-medium text-brand-purple' : 'text-slate-700'} ${opt.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  <CheckIcon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-brand-purple' : 'text-transparent'}`} />
                  <span className="flex-1 truncate">{opt.label}</span>
                  {opt.sub && (
                    <span className="ml-auto truncate text-xs text-slate-400">{opt.sub}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
