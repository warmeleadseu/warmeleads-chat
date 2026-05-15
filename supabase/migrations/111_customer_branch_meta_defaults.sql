-- Standaard Meta-campagne(s) per klant + branche: nieuwe leads-batches (portaal/admin)
-- kunnen deze overnemen wanneer geen expliciete koppeling op de order staat.

CREATE TABLE IF NOT EXISTS public.customer_branch_meta_defaults (
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  branch text NOT NULL REFERENCES public.branches(slug) ON UPDATE CASCADE,
  meta_campaign_ids text[] NOT NULL DEFAULT '{}'::text[],
  meta_campaign_sync_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  PRIMARY KEY (customer_id, branch)
);

CREATE INDEX IF NOT EXISTS idx_cb_meta_defaults_customer ON public.customer_branch_meta_defaults(customer_id);

COMMENT ON TABLE public.customer_branch_meta_defaults IS
  'Optionele default Meta-campagne-ID(s) per klant per branche; gebruikt bij nieuwe leads-batches zonder expliciete koppeling.';

ALTER TABLE public.customer_branch_meta_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on customer_branch_meta_defaults"
  ON public.customer_branch_meta_defaults FOR ALL USING (true) WITH CHECK (true);
