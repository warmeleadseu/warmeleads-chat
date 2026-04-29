-- Voegt een gederiveerde kolom `assigned_customer_ids` toe aan leads, plus een
-- gederiveerde boolean `is_assigned`. Hiermee kunnen we in 1 query op klant- of
-- toewijzingsstatus filteren zonder dure joins of grote IN-lijsten over de URL.
--
-- Bron van waarheid blijft `lead_assignments`. De kolom wordt onderhouden via
-- een trigger op die tabel en is geinitialiseerd via een backfill hieronder.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS assigned_customer_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Generated column: TRUE zodra er minimaal 1 toewijzing is.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS is_assigned boolean
  GENERATED ALWAYS AS (cardinality(assigned_customer_ids) > 0) STORED;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_customer_ids
  ON leads USING gin (assigned_customer_ids);

CREATE INDEX IF NOT EXISTS idx_leads_is_assigned
  ON leads(is_assigned);

-- Idempotente backfill: zorg dat elke leads.customer_id ook een lead_assignments
-- rij heeft (zelfde herstellogica als migratie 033 voor de zekerheid).
INSERT INTO lead_assignments (lead_id, customer_id)
SELECT id, customer_id
FROM leads
WHERE customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM lead_assignments la
    WHERE la.lead_id = leads.id AND la.customer_id = leads.customer_id
  );

-- Backfill assigned_customer_ids vanuit lead_assignments.
UPDATE leads l
SET assigned_customer_ids = COALESCE(sub.ids, '{}'::uuid[])
FROM (
  SELECT lead_id, array_agg(DISTINCT customer_id ORDER BY customer_id) AS ids
  FROM lead_assignments
  GROUP BY lead_id
) sub
WHERE l.id = sub.lead_id
  AND l.assigned_customer_ids IS DISTINCT FROM sub.ids;

-- Trigger functie houdt assigned_customer_ids in sync.
CREATE OR REPLACE FUNCTION refresh_lead_assigned_customers()
RETURNS trigger AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_lead_id := OLD.lead_id;
  ELSE
    v_lead_id := NEW.lead_id;
  END IF;

  UPDATE leads l
  SET assigned_customer_ids = COALESCE(
    (SELECT array_agg(DISTINCT la.customer_id ORDER BY la.customer_id)
     FROM lead_assignments la WHERE la.lead_id = v_lead_id),
    '{}'::uuid[]
  )
  WHERE l.id = v_lead_id;

  -- Edge case: lead_id is verplaatst naar een andere lead (zelden, maar zo
  -- behouden we consistentie).
  IF TG_OP = 'UPDATE' AND NEW.lead_id IS DISTINCT FROM OLD.lead_id THEN
    UPDATE leads l
    SET assigned_customer_ids = COALESCE(
      (SELECT array_agg(DISTINCT la.customer_id ORDER BY la.customer_id)
       FROM lead_assignments la WHERE la.lead_id = OLD.lead_id),
      '{}'::uuid[]
    )
    WHERE l.id = OLD.lead_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_assignments_refresh_customers ON lead_assignments;
CREATE TRIGGER trg_lead_assignments_refresh_customers
  AFTER INSERT OR UPDATE OR DELETE ON lead_assignments
  FOR EACH ROW EXECUTE FUNCTION refresh_lead_assigned_customers();
