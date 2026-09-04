-- ============================================================================
-- 160 — Eén lead kan per batch maar één keer geleverd worden
--
-- Achtergrond: op 14 augustus 2026 ontstond door een race een tweede rij voor
-- dezelfde lead in dezelfde batch. Daardoor liepen de twee tellingen van
-- "geleverd" uiteen (rijen versus unieke leads) en lag de verdeling in zes
-- provincies negentien dagen stil. Migratie 157 en 158 haalden de tellingen
-- gelijk; deze migratie haalt de oorzaak zelf weg.
--
-- In de hele tabel gaat het om 18 overtollige rijen, verspreid over april tot
-- juni 2026. Per (lead, batch) blijft de oudste rij staan: die vertegenwoordigt
-- de werkelijke levering. De jongere is per definitie een ongeluk en levert de
-- klant niets extra's; de teller `leads_delivered` telde hem sowieso al niet
-- mee, want die telt unieke leads.
--
-- De trigger `lead_assignments_sync_batch_delivered` (migratie 147) werkt de
-- batchtellers na het verwijderen automatisch bij.
-- ============================================================================

WITH gerangschikt AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lead_id, batch_id
      ORDER BY assigned_at ASC, id ASC
    ) AS rang
  FROM lead_assignments
  WHERE batch_id IS NOT NULL
)
DELETE FROM lead_assignments la
USING gerangschikt g
WHERE la.id = g.id
  AND g.rang > 1;

-- Vanaf nu weigert de database een tweede rij voor dezelfde lead in dezelfde
-- batch. Toewijzingen zonder batch (mirror, bulk) blijven buiten schot.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_assignments_lead_batch_uniek
  ON lead_assignments (lead_id, batch_id)
  WHERE batch_id IS NOT NULL;
