-- Geplande mailingen ook naar prospects (Mails > Geplande mailingen > Ontvangers,
-- tabblad Prospects). Klanten blijven in `ontvangers`; prospects komen hier.
ALTER TABLE geplande_mailingen
  ADD COLUMN IF NOT EXISTS prospect_ontvangers uuid[] NOT NULL DEFAULT '{}'::uuid[];
