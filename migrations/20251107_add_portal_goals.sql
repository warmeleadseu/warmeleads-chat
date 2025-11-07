-- Voeg portal doelvelden toe aan customers

BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS portal_lead_goal INTEGER DEFAULT 500,
  ADD COLUMN IF NOT EXISTS portal_goal_frequency TEXT DEFAULT 'maand',
  ADD COLUMN IF NOT EXISTS portal_goal_updated_at TIMESTAMPTZ;

-- Zorg dat bestaande klanten een standaardwaarde krijgen
UPDATE public.customers
SET
  portal_lead_goal = COALESCE(portal_lead_goal, 500),
  portal_goal_frequency = COALESCE(portal_goal_frequency, 'maand')
WHERE portal_lead_goal IS NULL
   OR portal_goal_frequency IS NULL;

COMMIT;
