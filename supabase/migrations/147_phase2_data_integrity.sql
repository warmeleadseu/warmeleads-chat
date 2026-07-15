-- Phase 2: data-integriteit — indexes, dedup, batch sync trigger, booking uniqueness

-- 1. Performance indexes
CREATE INDEX IF NOT EXISTS idx_customer_batches_active_pipeline
  ON customer_batches (branch, created_at DESC)
  WHERE status = 'active'
    AND batch_kind = 'leads'
    AND is_paid IS NOT FALSE;

CREATE INDEX IF NOT EXISTS idx_lead_assignments_customer_assigned_at
  ON lead_assignments (customer_id, assigned_at DESC);

-- 2. DB-level 30-day dedup via trigger (partial index with now() is not allowed)
CREATE OR REPLACE FUNCTION prevent_lead_assignment_30d_duplicate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM lead_assignments la
    WHERE la.lead_id = NEW.lead_id
      AND la.customer_id = NEW.customer_id
      AND la.assigned_at > (now() - interval '30 days')
      AND la.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Lead al binnen 30 dagen aan deze klant toegewezen'
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_assignments_30d_dedup ON lead_assignments;
CREATE TRIGGER lead_assignments_30d_dedup
  BEFORE INSERT ON lead_assignments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_lead_assignment_30d_duplicate();

-- 3. Distinct lead count per batch (RPC used by batchSync)
CREATE OR REPLACE FUNCTION count_distinct_leads_for_batch(p_batch_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(DISTINCT lead_id)::integer
  FROM lead_assignments
  WHERE batch_id = p_batch_id;
$$;

-- 4. Trigger: keep customer_batches.leads_delivered in sync
CREATE OR REPLACE FUNCTION trg_sync_batch_leads_delivered()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch_id uuid;
  v_external integer;
  v_distinct integer;
BEGIN
  v_batch_id := COALESCE(NEW.batch_id, OLD.batch_id);
  IF v_batch_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(leads_delivered_external, 0)
  INTO v_external
  FROM customer_batches
  WHERE id = v_batch_id;

  SELECT COUNT(DISTINCT lead_id)::integer
  INTO v_distinct
  FROM lead_assignments
  WHERE batch_id = v_batch_id;

  UPDATE customer_batches
  SET leads_delivered = COALESCE(v_distinct, 0) + COALESCE(v_external, 0)
  WHERE id = v_batch_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS lead_assignments_sync_batch_delivered ON lead_assignments;
CREATE TRIGGER lead_assignments_sync_batch_delivered
  AFTER INSERT OR UPDATE OF batch_id, lead_id OR DELETE ON lead_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_batch_leads_delivered();

-- 5. Booking slot uniqueness (one confirmed booking per date+time)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_date_time_unique
  ON bookings (date, time)
  WHERE status IS DISTINCT FROM 'geannuleerd';

-- 6. Bron CHECK aligned with application sources
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_bron_check;
ALTER TABLE leads ADD CONSTRAINT leads_bron_check
  CHECK (bron IS NULL OR bron IN (
    'handmatig', 'excel_import', 'zapier', 'meta', 'demo', 'website', 'partner', 'niche_research'
  ));
