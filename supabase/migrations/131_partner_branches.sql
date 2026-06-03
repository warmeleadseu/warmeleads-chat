-- 131 — Markeer partner-branches zodat ze niet selecteerbaar zijn
-- als leverbare lead-branche bij batch-creatie of klant-branches.
--
-- Partner-branches (thuisbatterij_partners, airco_partners, nei_begun_partners)
-- horen bij de prospects-acquisitie-pijplijn (Meta/Zapier partner-campagnes), niet
-- bij de leadleverpijplijn richting klanten. Tot nu toe staan ze gewoon in de
-- generieke branch-pickers, waardoor accountmanagers per ongeluk batches op
-- partner-branches kunnen aanmaken.

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS is_partner_branch boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.branches.is_partner_branch IS
  'true = prospects-acquisitie-branche (partner-leads → prospects-pijplijn). '
  'Niet selecteerbaar als leverbare lead-branche in batch-creatie / klant-branches.';

UPDATE public.branches
SET is_partner_branch = true
WHERE slug IN ('thuisbatterij_partners', 'airco_partners', 'nei_begun_partners');

CREATE INDEX IF NOT EXISTS idx_branches_is_partner_branch
  ON public.branches (is_partner_branch)
  WHERE is_partner_branch = true;
