'use client';

/**
 * AiLeadFormModal — 4-staps wizard om met AI een Meta Lead Form aan
 * te maken voor branches die nog geen formulier hebben.
 *
 * Stap 1 — Page picker:  kies Facebook-page uit /me/accounts
 * Stap 2 — AI draft:     genereer voorstel met /api/admin/meta-forms/ai-draft
 * Stap 3 — Edit:         inline editen van vragen, opties, context, thank-you
 * Stap 4 — Confirm:      "Maak aan in Meta" → /api/admin/meta-forms/create
 *
 * Na succes geven we de nieuwe form-id mee aan de parent zodat de
 * StudioForm de forms-lijst kan refreshen en de nieuwe form selecteren.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  SparklesIcon,
  ArrowPathIcon,
  PlusIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

// ── Types die ook door StudioForm worden gebruikt ────────────

export interface CreatedFormInfo {
  form_id: string;
  page_id: string;
  name: string;
  questions_count: number;
}

interface MetaPage {
  id: string;
  name: string;
  category: string | null;
  picture_url: string | null;
  tasks: string[];
}

interface CustomQuestion {
  key: string;
  label: string;
  type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
  options?: Array<{ value: string; label: string }>;
  inline_context?: string;
  is_new_branch_field?: boolean;
}

interface FormDraft {
  name: string;
  locale: 'nl_NL' | 'nl_BE' | 'fr_BE' | 'en_US';
  form_type: 'HIGHER_INTENT' | 'MORE_VOLUME';
  custom_questions: CustomQuestion[];
  prefilled_fields: string[];
  context_card?: { title: string; content: string[]; button_text?: string };
  thank_you_page: {
    title: string;
    body: string;
    button_type: 'VIEW_WEBSITE' | 'CALL_BUSINESS' | 'NONE';
    button_text?: string;
    website_url?: string;
    business_phone_number?: string;
  };
  privacy_policy: { url: string; link_text?: string };
  design_rationale?: string;
}

interface AiDraftResponse {
  ok?: boolean;
  draft?: FormDraft;
  existing_branch_field_keys?: string[];
  cost_cents?: number;
  error?: string;
  details?: unknown;
}

// ── Props ────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  branch: string;
  branchName?: string;
  /** Voeren we mee naar de AI-designer voor betere question-relevantie. */
  audienceProblem?: string;
  audienceMotivation?: string;
  ageMin?: number;
  ageMax?: number;
  /** 1=M, 2=V; weglaten = beide. */
  genders?: number[];
  countries?: string[];
  onCreated: (info: CreatedFormInfo) => void;
}

const PREFILLED_LABELS: Record<string, string> = {
  FULL_NAME: 'Volledige naam',
  FIRST_NAME: 'Voornaam',
  LAST_NAME: 'Achternaam',
  EMAIL: 'E-mailadres',
  PHONE: 'Telefoonnummer',
  STREET_ADDRESS: 'Straat + huisnr',
  CITY: 'Plaats',
  STATE: 'Provincie',
  POST_CODE: 'Postcode',
  ZIP: 'ZIP/Postcode',
  COUNTRY: 'Land',
  DATE_OF_BIRTH: 'Geboortedatum',
  GENDER: 'Gender',
};

// ── Helpers ──────────────────────────────────────────────────

function slugifyKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'vraag';
}

// ── Component ────────────────────────────────────────────────

export default function AiLeadFormModal({
  open, onClose, branch, branchName,
  audienceProblem, audienceMotivation,
  ageMin, ageMax, genders, countries,
  onCreated,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Stap 1 — pages
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [pageSearch, setPageSearch] = useState('');
  const [selectedPageId, setSelectedPageId] = useState<string>('');

  // Stap 2/3 — draft
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draft, setDraft] = useState<FormDraft | null>(null);
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [aiCostCents, setAiCostCents] = useState<number>(0);

  // Stap 4 — create
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const resetAll = useCallback(() => {
    setStep(1);
    setPages([]); setPagesLoading(false); setPagesError(null);
    setPageSearch('');
    setSelectedPageId('');
    setDraftLoading(false); setDraftError(null); setDraft(null);
    setExistingKeys(new Set()); setAiCostCents(0);
    setCreateBusy(false); setCreateError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (createBusy || draftLoading) return;
    resetAll();
    onClose();
  }, [createBusy, draftLoading, onClose, resetAll]);

  const loadPages = useCallback(async (opts?: { force?: boolean }) => {
    setPagesLoading(true);
    setPagesError(null);
    const qs = opts?.force ? '?force=1' : '';
    try {
      const res = await adminFetch(`/api/admin/meta-pages${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPagesError(data.error || `Kon pages niet ophalen (${res.status})`);
        setPages([]);
        return;
      }
      const list = (data.pages || []) as MetaPage[];
      setPages(list);
      if (list.length === 1) setSelectedPageId(list[0].id);
    } catch (err) {
      setPagesError(err instanceof Error ? err.message : 'Netwerkfout');
    } finally {
      setPagesLoading(false);
    }
  }, []);

  const filteredPages = useMemo(() => {
    const q = pageSearch.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.id.includes(q) ||
      (p.category || '').toLowerCase().includes(q),
    );
  }, [pages, pageSearch]);

  // ── Pages laden zodra de modal open gaat ──
  useEffect(() => {
    if (!open) return;
    void loadPages();
  }, [open, loadPages]);

  // ── AI Draft genereren ──
  const requestDraft = useCallback(async () => {
    setDraftLoading(true); setDraftError(null);
    try {
      const res = await adminFetch('/api/admin/meta-forms/ai-draft', {
        method: 'POST',
        body: JSON.stringify({
          branch,
          audience_problem: audienceProblem?.trim() || undefined,
          audience_motivation: audienceMotivation?.trim() || undefined,
          age_min: ageMin,
          age_max: ageMax,
          genders,
          countries: countries && countries.length > 0 ? countries : ['NL'],
        }),
      });
      const data = await res.json() as AiDraftResponse;
      if (!res.ok || !data.ok || !data.draft) {
        const detailMsg = typeof data.details === 'string' ? data.details : '';
        setDraftError(detailMsg ? `${data.error || 'AI mislukt'} — ${detailMsg}` : (data.error || 'AI mislukt'));
        return;
      }
      setDraft(data.draft);
      setExistingKeys(new Set(data.existing_branch_field_keys || []));
      setAiCostCents(data.cost_cents || 0);
      setStep(3);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Netwerkfout');
    } finally {
      setDraftLoading(false);
    }
  }, [branch, audienceProblem, audienceMotivation, ageMin, ageMax, genders, countries]);

  // ── Validatie van de huidige draft (Stap 3+4) ──
  const validation = useMemo(() => {
    const errs: string[] = [];
    if (!draft) return { ok: false, errs: ['Geen draft'] };
    if (!draft.name?.trim()) errs.push('Naam ontbreekt');
    if (draft.name?.length > 60) errs.push('Naam te lang (max 60)');
    if (draft.custom_questions.length < 2) errs.push('Minimaal 2 vragen');
    if (draft.custom_questions.length > 4) errs.push('Maximaal 4 vragen');

    const seenKeys = new Set<string>();
    for (let i = 0; i < draft.custom_questions.length; i++) {
      const q = draft.custom_questions[i];
      const idx = i + 1;
      if (!/^[a-z][a-z0-9_]*$/.test(q.key)) errs.push(`Vraag ${idx}: key moet snake_case zijn`);
      if (seenKeys.has(q.key)) errs.push(`Vraag ${idx}: key '${q.key}' is dubbel`);
      seenKeys.add(q.key);
      if (!q.label?.trim() || q.label.length < 4) errs.push(`Vraag ${idx}: label te kort`);
      if (q.type === 'MULTIPLE_CHOICE') {
        if (!q.options || q.options.length < 2) errs.push(`Vraag ${idx}: minimaal 2 opties`);
        if ((q.options?.length || 0) > 6) errs.push(`Vraag ${idx}: maximaal 6 opties`);
        const seenVals = new Set<string>();
        for (const o of q.options || []) {
          if (!o.value || !o.label) errs.push(`Vraag ${idx}: optie zonder waarde/label`);
          if (seenVals.has(o.value)) errs.push(`Vraag ${idx}: optie-value '${o.value}' is dubbel`);
          seenVals.add(o.value);
        }
      }
    }
    if (!draft.prefilled_fields || draft.prefilled_fields.length === 0) {
      errs.push('Minimaal 1 prefilled veld');
    }
    if (!draft.privacy_policy?.url) errs.push('Privacy URL ontbreekt');
    if (!draft.thank_you_page?.title) errs.push('Thank-you titel ontbreekt');
    if (!draft.thank_you_page?.body) errs.push('Thank-you body ontbreekt');
    return { ok: errs.length === 0, errs };
  }, [draft]);

  // ── Draft mutators ──
  const updateDraft = (patch: Partial<FormDraft>) => {
    setDraft(d => (d ? { ...d, ...patch } : d));
  };
  const updateQuestion = (idx: number, patch: Partial<CustomQuestion>) => {
    setDraft(d => {
      if (!d) return d;
      const next = [...d.custom_questions];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, custom_questions: next };
    });
  };
  const updateOption = (qIdx: number, oIdx: number, patch: Partial<{ value: string; label: string }>) => {
    setDraft(d => {
      if (!d) return d;
      const next = [...d.custom_questions];
      const opts = [...(next[qIdx].options || [])];
      opts[oIdx] = { ...opts[oIdx], ...patch };
      next[qIdx] = { ...next[qIdx], options: opts };
      return { ...d, custom_questions: next };
    });
  };
  const addOption = (qIdx: number) => {
    setDraft(d => {
      if (!d) return d;
      const next = [...d.custom_questions];
      const opts = [...(next[qIdx].options || []), { value: `optie_${(next[qIdx].options?.length || 0) + 1}`, label: 'Nieuwe optie' }];
      next[qIdx] = { ...next[qIdx], options: opts };
      return { ...d, custom_questions: next };
    });
  };
  const removeOption = (qIdx: number, oIdx: number) => {
    setDraft(d => {
      if (!d) return d;
      const next = [...d.custom_questions];
      const opts = (next[qIdx].options || []).filter((_, i) => i !== oIdx);
      next[qIdx] = { ...next[qIdx], options: opts };
      return { ...d, custom_questions: next };
    });
  };
  const moveQuestion = (idx: number, dir: -1 | 1) => {
    setDraft(d => {
      if (!d) return d;
      const next = [...d.custom_questions];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return d;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...d, custom_questions: next };
    });
  };
  const removeQuestion = (idx: number) => {
    setDraft(d => {
      if (!d) return d;
      const next = d.custom_questions.filter((_, i) => i !== idx);
      return { ...d, custom_questions: next };
    });
  };
  const addQuestion = () => {
    setDraft(d => {
      if (!d) return d;
      if (d.custom_questions.length >= 4) return d;
      const label = 'Nieuwe vraag';
      const next: CustomQuestion = {
        key: slugifyKey(`${label}_${d.custom_questions.length + 1}`),
        label,
        type: 'MULTIPLE_CHOICE',
        options: [
          { value: 'ja', label: 'Ja' },
          { value: 'nee', label: 'Nee' },
        ],
        is_new_branch_field: true,
      };
      return { ...d, custom_questions: [...d.custom_questions, next] };
    });
  };

  // ── Aanmaken ──
  const submitCreate = async () => {
    if (!draft || !selectedPageId) return;
    if (!validation.ok) return;
    setCreateBusy(true); setCreateError(null);
    try {
      const res = await adminFetch('/api/admin/meta-forms/create', {
        method: 'POST',
        body: JSON.stringify({
          page_id: selectedPageId,
          branch,
          form: {
            name: draft.name,
            locale: draft.locale,
            form_type: draft.form_type,
            custom_questions: draft.custom_questions.map(q => ({
              key: q.key,
              label: q.label,
              type: q.type,
              options: q.options,
              inline_context: q.inline_context,
            })),
            prefilled_fields: draft.prefilled_fields,
            context_card: draft.context_card,
            thank_you_page: draft.thank_you_page,
            privacy_policy: draft.privacy_policy,
          },
          ai_cost_cents: aiCostCents,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const detail = typeof data.details === 'string' ? data.details : '';
        setCreateError(detail ? `${data.error || 'Aanmaken mislukt'} — ${detail}` : (data.error || 'Aanmaken mislukt'));
        return;
      }
      onCreated({
        form_id: data.form_id,
        page_id: data.page_id,
        name: data.name,
        questions_count: data.questions_count,
      });
      resetAll();
      onClose();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Netwerkfout');
    } finally {
      setCreateBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-2 sm:items-center sm:p-4 sm:py-8"
      onClick={handleClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="flex max-h-[min(90dvh,calc(100vh-1rem))] w-full max-w-3xl shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[min(90dvh,calc(100vh-4rem))]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-fuchsia-50 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                Nieuw Meta Lead Form met AI
              </div>
              <div className="truncate text-[11px] text-slate-500">
                Branche: <span className="font-medium text-slate-700">{branchName || branch}</span>
                {' · '}Stap <span className="font-medium text-slate-700">{step}/4</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={createBusy || draftLoading}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/60 hover:text-slate-900 disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Steps progress */}
        <div className="flex gap-1.5 px-4 py-2 sm:px-6">
          {[1, 2, 3, 4].map(n => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= step ? 'bg-purple-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Body — scrollbaar (min-h-0 is nodig zodat flex-child daadwerkelijk kan scrollen) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          <AnimatePresence mode="wait">
            {/* ── STAP 1: Page picker ─────────────────────── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">Kies een Facebook-page</h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Het Lead Form wordt aangemaakt op deze pagina. We tonen alle Facebook-pages die aan jullie Meta-koppeling zijn gekoppeld (met rechten om Lead Forms te beheren).
                    </p>
                  </div>
                  {!pagesLoading && pages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => loadPages({ force: true })}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Vernieuwen
                    </button>
                  )}
                </div>

                {pagesLoading && (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                    <ArrowPathIcon className="h-4 w-4 animate-spin" /> Laden van pages…
                  </div>
                )}

                {pagesError && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-medium">Kon pages niet ophalen</div>
                      <div className="mt-0.5 text-amber-800">{pagesError}</div>
                    </div>
                  </div>
                )}

                {!pagesLoading && !pagesError && pages.length === 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                    Geen Facebook-pages gevonden waar deze token MANAGE-rechten op heeft.
                    Update de Meta-token in <span className="font-mono">/admin/koppelingen</span>.
                  </div>
                )}

                {!pagesLoading && pages.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-semibold text-purple-800">
                        {pages.length} {pages.length === 1 ? 'page' : 'pages'} gekoppeld
                      </span>
                      {pageSearch && (
                        <span className="text-[11px] text-slate-500">
                          {filteredPages.length} resultaat{filteredPages.length === 1 ? '' : 'en'}
                        </span>
                      )}
                    </div>

                    {pages.length >= 4 && (
                      <div className="relative">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          value={pageSearch}
                          onChange={e => setPageSearch(e.target.value)}
                          placeholder="Zoek page op naam of ID…"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-8 pr-3 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:bg-white"
                        />
                      </div>
                    )}

                    <div
                      className="max-h-[min(50dvh,22rem)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-50/30"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                      {filteredPages.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-slate-500">Geen pages gevonden voor &ldquo;{pageSearch}&rdquo;</p>
                      ) : (
                        <div className="divide-y divide-slate-100 p-1">
                          {filteredPages.map(p => (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => setSelectedPageId(p.id)}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                                selectedPageId === p.id
                                  ? 'border border-purple-500 bg-purple-50 ring-1 ring-purple-500'
                                  : 'border border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {p.picture_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.picture_url} alt="" className="h-9 w-9 shrink-0 rounded-full" />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                  <BuildingOffice2Icon className="h-5 w-5" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-slate-900">{p.name}</div>
                                <div className="truncate text-[11px] text-slate-500">
                                  {p.category || 'Page'}
                                  {' · '}{p.tasks.slice(0, 3).join(', ')}{p.tasks.length > 3 ? '…' : ''}
                                </div>
                              </div>
                              <div className="hidden shrink-0 font-mono text-[10px] text-slate-400 sm:block">{p.id}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Mis je een page? Koppel die eerst in Meta Business Manager aan hetzelfde ad account / system user als in Koppelingen, en klik daarna op Vernieuwen.
                    </p>
                  </>
                )}
              </motion.div>
            )}

            {/* ── STAP 2: AI draft genereren ──────────────── */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Laat AI het formulier ontwerpen</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    GPT-4o gebruikt de branche-context, je doelgroep-input en best-practices van Meta om 2-4 kwalificerende vragen + intro + thank-you te schrijven.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
                  <div className="font-medium text-slate-900">Input voor AI:</div>
                  <ul className="mt-1.5 space-y-0.5">
                    <li>· Branche: <span className="font-medium">{branchName || branch}</span></li>
                    <li>· Probleem: <span className="text-slate-600">{audienceProblem?.trim() || '(niet ingevuld)'}</span></li>
                    <li>· Motivatie: <span className="text-slate-600">{audienceMotivation?.trim() || '(niet ingevuld)'}</span></li>
                    <li>· Leeftijd: <span className="font-medium">{ageMin ?? '?'}-{ageMax ?? '?'}</span></li>
                    <li>· Doelgebied: <span className="font-medium">{(countries || ['NL']).join(', ')}</span></li>
                  </ul>
                </div>

                {draftError && (
                  <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-900">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                    <div>{draftError}</div>
                  </div>
                )}

                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={requestDraft}
                    disabled={draftLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-60"
                  >
                    {draftLoading
                      ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> AI ontwerpt formulier…</>
                      : <><SparklesIcon className="h-4 w-4" /> Genereer met AI</>}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STAP 3: Edit ─────────────────────────────── */}
            {step === 3 && draft && (
              <motion.div key="step3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Check + bewerk het formulier</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Pas vragen, opties, intro en thank-you naar wens aan. Klik op een veld om te bewerken.
                  </p>
                </div>

                {/* Naam + form_type + locale */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Naam in Meta Ads Manager</label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={e => updateDraft({ name: e.target.value })}
                      maxLength={60}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Form type</label>
                    <select
                      value={draft.form_type}
                      onChange={e => updateDraft({ form_type: e.target.value as 'HIGHER_INTENT' | 'MORE_VOLUME' })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="HIGHER_INTENT">Higher intent (review-screen)</option>
                      <option value="MORE_VOLUME">More volume (snel)</option>
                    </select>
                  </div>
                </div>

                {/* Context card */}
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-800">Intro-kaart (context card)</h4>
                    <button
                      type="button"
                      onClick={() => updateDraft({ context_card: draft.context_card ? undefined : { title: 'Snel & gratis advies', content: [''], button_text: 'Verder' } })}
                      className="text-[11px] text-purple-600 hover:underline"
                    >
                      {draft.context_card ? 'Verwijder' : 'Toevoegen'}
                    </button>
                  </div>
                  {draft.context_card && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={draft.context_card.title}
                        onChange={e => updateDraft({ context_card: { ...draft.context_card!, title: e.target.value } })}
                        placeholder="Titel"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      <textarea
                        value={draft.context_card.content.join('\n')}
                        onChange={e => updateDraft({ context_card: { ...draft.context_card!, content: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) } })}
                        placeholder="Body (één paragraaf per regel, max 3)"
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        value={draft.context_card.button_text || ''}
                        onChange={e => updateDraft({ context_card: { ...draft.context_card!, button_text: e.target.value } })}
                        placeholder="Knoptekst (bv. 'Verder')"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Custom questions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-800">
                      Kwalificerende vragen
                      <span className="ml-1.5 text-slate-500">({draft.custom_questions.length}/4)</span>
                    </h4>
                    <button
                      type="button"
                      onClick={addQuestion}
                      disabled={draft.custom_questions.length >= 4}
                      className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                    >
                      <PlusIcon className="h-3 w-3" /> Vraag
                    </button>
                  </div>

                  {draft.custom_questions.map((q, qi) => (
                    <div key={qi} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-mono">#{qi + 1}</span>
                          {q.is_new_branch_field && (
                            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                              nieuw veld
                            </span>
                          )}
                          {!q.is_new_branch_field && existingKeys.has(q.key) && (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                              hergebruikt
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button type="button" onClick={() => moveQuestion(qi, -1)} disabled={qi === 0} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                            <ChevronLeftIcon className="h-3.5 w-3.5 rotate-90" />
                          </button>
                          <button type="button" onClick={() => moveQuestion(qi, 1)} disabled={qi === draft.custom_questions.length - 1} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                            <ChevronRightIcon className="h-3.5 w-3.5 rotate-90" />
                          </button>
                          <button type="button" onClick={() => removeQuestion(qi)} disabled={draft.custom_questions.length <= 2} className="rounded p-1 text-rose-500 hover:bg-rose-50 disabled:opacity-30">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <input
                          type="text"
                          value={q.label}
                          onChange={e => updateQuestion(qi, { label: e.target.value })}
                          placeholder="Vraag (label)"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:col-span-2"
                        />
                        <select
                          value={q.type}
                          onChange={e => {
                            const t = e.target.value as 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
                            updateQuestion(qi, {
                              type: t,
                              options: t === 'MULTIPLE_CHOICE' && (!q.options || q.options.length < 2)
                                ? [{ value: 'ja', label: 'Ja' }, { value: 'nee', label: 'Nee' }]
                                : t === 'SHORT_ANSWER' ? undefined : q.options,
                            });
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="MULTIPLE_CHOICE">Multiple choice</option>
                          <option value="SHORT_ANSWER">Vrije tekst</option>
                        </select>
                      </div>

                      <div className="mt-2">
                        <input
                          type="text"
                          value={q.key}
                          onChange={e => updateQuestion(qi, { key: slugifyKey(e.target.value) })}
                          placeholder="key (snake_case)"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
                        />
                      </div>

                      {q.type === 'MULTIPLE_CHOICE' && (
                        <div className="mt-2 space-y-1.5">
                          {(q.options || []).map((o, oi) => (
                            <div key={oi} className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={o.label}
                                onChange={e => updateOption(qi, oi, { label: e.target.value, value: slugifyKey(e.target.value) })}
                                placeholder={`Optie ${oi + 1}`}
                                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(qi, oi)}
                                disabled={(q.options?.length || 0) <= 2}
                                className="rounded p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-30"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addOption(qi)}
                            disabled={(q.options?.length || 0) >= 6}
                            className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                          >
                            <PlusIcon className="h-3 w-3" /> Optie
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Prefilled velden */}
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <h4 className="mb-2 text-xs font-semibold text-slate-800">NAW-velden (prefilled uit Facebook-profiel)</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {['FULL_NAME', 'EMAIL', 'PHONE', 'POST_CODE', 'CITY', 'STREET_ADDRESS'].map(f => {
                      const active = draft.prefilled_fields.includes(f);
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? draft.prefilled_fields.filter(x => x !== f)
                              : [...draft.prefilled_fields, f];
                            updateDraft({ prefilled_fields: next });
                          }}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                            active
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {PREFILLED_LABELS[f] || f}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Thank-you page */}
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <h4 className="mb-2 text-xs font-semibold text-slate-800">Bedank-pagina (na submit)</h4>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={draft.thank_you_page.title}
                      onChange={e => updateDraft({ thank_you_page: { ...draft.thank_you_page, title: e.target.value } })}
                      placeholder="Titel"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <textarea
                      value={draft.thank_you_page.body}
                      onChange={e => updateDraft({ thank_you_page: { ...draft.thank_you_page, body: e.target.value } })}
                      placeholder="Body"
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        value={draft.thank_you_page.button_type}
                        onChange={e => updateDraft({ thank_you_page: { ...draft.thank_you_page, button_type: e.target.value as 'VIEW_WEBSITE' | 'CALL_BUSINESS' | 'NONE' } })}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="VIEW_WEBSITE">Knop → website</option>
                        <option value="CALL_BUSINESS">Knop → bellen</option>
                        <option value="NONE">Geen knop</option>
                      </select>
                      <input
                        type="text"
                        value={draft.thank_you_page.button_text || ''}
                        onChange={e => updateDraft({ thank_you_page: { ...draft.thank_you_page, button_text: e.target.value } })}
                        placeholder="Knoptekst"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    {draft.thank_you_page.button_type === 'VIEW_WEBSITE' && (
                      <input
                        type="text"
                        value={draft.thank_you_page.website_url || ''}
                        onChange={e => updateDraft({ thank_you_page: { ...draft.thank_you_page, website_url: e.target.value } })}
                        placeholder="https://warmeleads.eu"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    )}
                    {draft.thank_you_page.button_type === 'CALL_BUSINESS' && (
                      <input
                        type="text"
                        value={draft.thank_you_page.business_phone_number || ''}
                        onChange={e => updateDraft({ thank_you_page: { ...draft.thank_you_page, business_phone_number: e.target.value } })}
                        placeholder="+31201234567 (E.164)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                </div>

                {/* Privacy URL */}
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <h4 className="mb-2 text-xs font-semibold text-slate-800">Privacy beleid</h4>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={draft.privacy_policy.url}
                      onChange={e => updateDraft({ privacy_policy: { ...draft.privacy_policy, url: e.target.value } })}
                      placeholder="https://warmeleads.eu/privacy"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={draft.privacy_policy.link_text || ''}
                      onChange={e => updateDraft({ privacy_policy: { ...draft.privacy_policy, link_text: e.target.value } })}
                      placeholder="Privacybeleid WarmeLeads"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Validatie-feedback */}
                {!validation.ok && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                    <div className="font-medium">Nog op te lossen voor je verder kan:</div>
                    <ul className="mt-0.5 list-disc pl-4">
                      {validation.errs.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── STAP 4: Confirm + Create ────────────────── */}
            {step === 4 && draft && (
              <motion.div key="step4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Bevestigen + aanmaken in Meta</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Klik op &ldquo;Maak aan in Meta&rdquo; om dit formulier live te zetten op je Facebook-page. Daarna verschijnt het direct in de Lead Form dropdown.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                  <div className="font-medium text-slate-900">{draft.name}</div>
                  <div className="mt-1 text-slate-600">
                    {draft.form_type === 'HIGHER_INTENT' ? 'Higher intent · review-screen aan' : 'More volume · geen review'} · locale {draft.locale}
                  </div>
                  <div className="mt-2 grid gap-1.5">
                    <div><span className="font-medium">Page:</span> {pages.find(p => p.id === selectedPageId)?.name || selectedPageId}</div>
                    <div><span className="font-medium">Vragen:</span> {draft.custom_questions.length} kwalificerend + {draft.prefilled_fields.length} prefilled</div>
                    <div><span className="font-medium">Privacy:</span> <span className="font-mono text-[10px] text-slate-500">{draft.privacy_policy.url}</span></div>
                  </div>
                  <div className="mt-2 border-t border-slate-200 pt-2">
                    <div className="font-medium text-slate-800">Vragen:</div>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                      {draft.custom_questions.map((q, i) => (
                        <li key={i}>
                          {q.label}
                          {q.type === 'MULTIPLE_CHOICE' && (
                            <span className="ml-1 text-slate-500">
                              ({(q.options || []).map(o => o.label).join(', ')})
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                  {draft.design_rationale && (
                    <div className="mt-2 border-t border-slate-200 pt-2 text-slate-600">
                      <span className="font-medium text-slate-800">AI rationale:</span> {draft.design_rationale}
                    </div>
                  )}
                </div>

                {createError && (
                  <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-900">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                    <div>{createError}</div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer met navigatie */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => {
              if (step === 1) handleClose();
              else setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
            }}
            disabled={createBusy || draftLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            {step === 1 ? 'Annuleer' : 'Terug'}
          </button>

          <div className="text-[11px] text-slate-500">
            {step === 3 && validation.ok && <span className="text-emerald-600">Klaar om te bevestigen</span>}
            {aiCostCents > 0 && step >= 3 && <span className="ml-2">AI-kosten: {(aiCostCents / 100).toFixed(2).replace('.', ',')} EUR</span>}
          </div>

          {step === 1 && (
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!selectedPageId}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Volgende <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              onClick={() => draft ? setStep(3) : requestDraft()}
              disabled={draftLoading || (!draft && !branch)}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {draft ? 'Verder met edit' : 'Genereer'} <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              onClick={() => setStep(4)}
              disabled={!validation.ok}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Verder <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          )}
          {step === 4 && (
            <button
              type="button"
              onClick={submitCreate}
              disabled={createBusy || !validation.ok}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:shadow-md disabled:opacity-60"
            >
              {createBusy ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckBadgeIcon className="h-3.5 w-3.5" />}
              {createBusy ? 'Aanmaken…' : 'Maak aan in Meta'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
