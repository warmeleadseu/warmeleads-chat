-- 120_ai_lead_forms.sql
--
-- AI Lead Form Creator: audit-trail van AI-gegenereerde Meta Lead Forms.
--
-- Achtergrond:
--   Tot nu toe konden admins in de AI Campaign Studio alleen kiezen uit
--   bestaande Meta Lead Forms (gedetecteerd uit historische CRM-leads of
--   actieve campagnes). Voor branches zonder vorige Meta-activiteit gaf de
--   UI "Geen formulieren gevonden" zonder uitweg.
--
--   We voegen nu een AI-flow toe die een nieuw Lead Form on-demand in Meta
--   creeert. Per gegenereerd formulier loggen we hier de bron-context
--   (branche, geselecteerde page, exacte vragen-payload + AI-kostprijs) voor
--   audit, debug en eventuele rebuild later.
--
-- Geen wijziging aan branch_fields: nieuwe question-keys worden door de
-- create-route at runtime in branch_fields opgeslagen via een INSERT ...
-- ON CONFLICT DO NOTHING, zodat de webhook-intake de antwoorden niet meer
-- silent dropt.

CREATE TABLE IF NOT EXISTS public.ai_lead_forms_created (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id text NOT NULL,
  page_id text NOT NULL,
  branch text NOT NULL REFERENCES public.branches(slug) ON UPDATE CASCADE,
  form_name text NOT NULL,
  locale text NOT NULL DEFAULT 'nl_NL',
  form_type text NOT NULL DEFAULT 'HIGHER_INTENT'
    CHECK (form_type IN ('MORE_VOLUME', 'HIGHER_INTENT')),
  questions_count integer NOT NULL DEFAULT 0,
  questions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_card_json jsonb,
  thank_you_page_json jsonb,
  privacy_policy_url text,
  ai_cost_cents integer NOT NULL DEFAULT 0,
  ai_model text,
  created_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_lead_forms_branch_created
  ON public.ai_lead_forms_created(branch, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_lead_forms_form_id
  ON public.ai_lead_forms_created(form_id);

COMMENT ON TABLE public.ai_lead_forms_created IS
  'Audit-log van Meta Lead Forms die via de AI Lead Form Creator in onze CRM zijn aangemaakt. Eén rij per succesvolle Meta API create.';
COMMENT ON COLUMN public.ai_lead_forms_created.form_id IS
  'Het Meta leadgen_form_id zoals teruggegeven door POST /{page_id}/leadgen_forms.';
COMMENT ON COLUMN public.ai_lead_forms_created.questions_json IS
  'De volledige questions-payload die we naar Meta hebben gestuurd. Behouden voor rebuild/clone.';
COMMENT ON COLUMN public.ai_lead_forms_created.ai_cost_cents IS
  'OpenAI-kosten in centen van de drafting-call (gpt-4o). Voor mtd-budget tracking.';

ALTER TABLE public.ai_lead_forms_created ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access ai_lead_forms_created"
  ON public.ai_lead_forms_created FOR ALL USING (true) WITH CHECK (true);
