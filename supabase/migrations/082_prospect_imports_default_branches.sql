-- Audit-trail voor de optionele "branche(s)-voor-deze-import" keuze in de
-- prospect-import wizard. Slugs verwijzen naar branches.slug.

ALTER TABLE prospect_imports
  ADD COLUMN IF NOT EXISTS default_branches text[];

COMMENT ON COLUMN prospect_imports.default_branches IS
  'Branches die in de wizard zijn aangevinkt als overrul/aanvulling op de bestandsdata. Wordt per rij samengevoegd met de prospects.branches uit het bestand.';
