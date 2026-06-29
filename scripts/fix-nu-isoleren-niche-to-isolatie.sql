-- Eenmalige data-correctie (29 jun 2026)
-- Klant: nu-isoleren.be (947d124a-cba9-4060-9ae9-1e383e503f3c)
--
-- De niche-onderzoeksbatch (57719d7d, isolatie) had 56 toewijzingen gekregen,
-- terwijl die na 29 leads uitgezet had moeten worden. De isolatieleads die
-- daarna binnenkwamen hadden in de nieuwe isolatiebatch (ba8d062f, 33 x EUR 30)
-- moeten landen. We houden de eerste 29 (op assigned_at) op de niche-batch en
-- verplaatsen de overige 27 (allemaal vanaf 24 jun, ná het aanmaken van de
-- isolatiebatch op 22 jun) naar de isolatiebatch. Daarna corrigeren we de
-- leads_delivered-tellers. Idempotent: na uitvoeren verplaatst een herhaling 0 rijen.
BEGIN;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY assigned_at) AS rn
  FROM lead_assignments
  WHERE batch_id = '57719d7d-512b-4b28-b398-c32c3187cad9'
)
UPDATE lead_assignments la
SET batch_id = 'ba8d062f-ffb0-47c1-8afa-81f24e06cf1f'
FROM ranked
WHERE la.id = ranked.id
  AND ranked.rn > 29;

UPDATE customer_batches
SET leads_delivered = (
  SELECT count(*) FROM lead_assignments WHERE batch_id = '57719d7d-512b-4b28-b398-c32c3187cad9'
)
WHERE id = '57719d7d-512b-4b28-b398-c32c3187cad9';

UPDATE customer_batches
SET leads_delivered = (
  SELECT count(*) FROM lead_assignments WHERE batch_id = 'ba8d062f-ffb0-47c1-8afa-81f24e06cf1f'
)
WHERE id = 'ba8d062f-ffb0-47c1-8afa-81f24e06cf1f';

COMMIT;
