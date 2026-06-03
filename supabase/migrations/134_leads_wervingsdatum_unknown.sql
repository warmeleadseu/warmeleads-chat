-- Markeer leads waarvan de wervingsdatum onbekend/onbetrouwbaar is.
-- Aanleiding: spreadsheet-import op 2 april 2026 zette de wervingsdatum
-- valselijk op de import-dag (2026-04-02) wanneer de cel leeg of onleesbaar
-- was, omdat de oude `parseDateValue` als fallback `new Date()` returnde.
-- Nieuwe parser returnt nu `null`; deze kolom maakt expliciet welke leads
-- "geen wervingsdatum" hebben zodat exports en filters daar slim mee om
-- kunnen gaan (toggle "leads zonder bekende wervingsdatum meenemen").

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS wervingsdatum_unknown boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.wervingsdatum_unknown IS
  'true = wervingsdatum onbekend (was leeg/onleesbaar bij import). Wordt gebruikt voor exports en filters.';

CREATE INDEX IF NOT EXISTS idx_leads_wervingsdatum_unknown
  ON public.leads (wervingsdatum_unknown)
  WHERE wervingsdatum_unknown = true;

-- Cleanup: alle thuisbatterij excel_import-leads die op 2 april 2026 zijn
-- aangemaakt EN wervingsdatum=2026-04-02 hebben (= bewezen fallback van de
-- bug). Hun wervingsdatum wordt op NULL gezet en gemarkeerd als unknown.
-- (7138 andere leads in dezelfde import met een echte, parseerbare datum
-- worden NIET aangeraakt.)
UPDATE public.leads
SET
  wervingsdatum = NULL,
  wervingsdatum_unknown = true
WHERE branch = 'thuisbatterij'
  AND bron = 'excel_import'
  AND wervingsdatum = '2026-04-02'
  AND created_at >= '2026-04-02 00:00:00+00'::timestamptz
  AND created_at < '2026-04-03 00:00:00+00'::timestamptz;
