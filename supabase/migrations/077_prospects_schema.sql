-- 077_prospects_schema.sql
-- AM Prospects CRM: sales-pipeline voor account managers om installateur-bedrijven
-- (potentiele klanten van WarmeLeads zelf) te beheren, importeren, opvolgen en
-- promoveren tot een betalende customer.

-- pg_trgm zorgt voor snelle fuzzy-search op company_name.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- prospects: kern-entiteit (installateur-bedrijf in sales-pipeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Bedrijf
  company_name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  website text,
  kvk_nummer text,
  vat_id text,

  -- Adres
  address text,
  postcode text,
  city text,
  country text DEFAULT 'NL',

  -- Business
  branches text[] DEFAULT '{}'::text[],
  company_size text,
  notes text,

  -- Pipeline
  status text NOT NULL DEFAULT 'nieuw'
    CHECK (status IN ('nieuw','contact','gekwalificeerd','voorstel','gewonnen','verloren','niet_relevant')),
  status_changed_at timestamptz DEFAULT now(),
  lost_reason text,

  -- Bron
  source text DEFAULT 'manual'
    CHECK (source IN ('manual','csv_import','xlsx_import','website','referral','other')),
  source_metadata jsonb,

  -- Account manager
  account_manager_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  assigned_at timestamptz,

  -- Conversie
  converted_to_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  converted_at timestamptz,

  -- Lifecycle helpers (voor snelle dashboards)
  next_action_at timestamptz,
  last_contacted_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_prospects_am ON prospects(account_manager_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_next_action ON prospects(next_action_at) WHERE next_action_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_kvk ON prospects(kvk_nummer) WHERE kvk_nummer IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_company_trgm ON prospects USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_prospects_created_at ON prospects(created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_prospects_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at = now();
  END IF;
  IF NEW.account_manager_id IS DISTINCT FROM OLD.account_manager_id AND NEW.account_manager_id IS NOT NULL THEN
    NEW.assigned_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prospects_updated_at ON prospects;
CREATE TRIGGER trg_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION set_prospects_updated_at();

-- ============================================================================
-- prospect_activities: append-only timeline
-- ============================================================================
CREATE TABLE IF NOT EXISTS prospect_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN
    ('note','call','email','meeting','status_change','assignment','import','conversion','task_created','task_completed','created','updated')),
  title text NOT NULL,
  body text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_activities_prospect ON prospect_activities(prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospect_activities_admin ON prospect_activities(admin_user_id, created_at DESC);

-- ============================================================================
-- prospect_tasks: reminders/todos per prospect
-- ============================================================================
CREATE TABLE IF NOT EXISTS prospect_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  assigned_to_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  type text DEFAULT 'todo' CHECK (type IN ('todo','call','email','meeting','followup')),
  title text NOT NULL,
  description text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_tasks_open ON prospect_tasks(assigned_to_admin_id, due_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prospect_tasks_prospect ON prospect_tasks(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_tasks_due ON prospect_tasks(due_at) WHERE completed_at IS NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_prospect_tasks_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prospect_tasks_updated_at ON prospect_tasks;
CREATE TRIGGER trg_prospect_tasks_updated_at
  BEFORE UPDATE ON prospect_tasks
  FOR EACH ROW EXECUTE FUNCTION set_prospect_tasks_updated_at();

-- next_action_at op de prospect bijwerken op basis van openstaande taken
CREATE OR REPLACE FUNCTION refresh_prospect_next_action(p_prospect_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE prospects
  SET next_action_at = (
    SELECT MIN(due_at) FROM prospect_tasks
    WHERE prospect_id = p_prospect_id AND completed_at IS NULL AND due_at IS NOT NULL
  )
  WHERE id = p_prospect_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_prospect_tasks_next_action()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_prospect_next_action(OLD.prospect_id);
    RETURN OLD;
  ELSE
    PERFORM refresh_prospect_next_action(NEW.prospect_id);
    IF TG_OP = 'UPDATE' AND NEW.prospect_id IS DISTINCT FROM OLD.prospect_id THEN
      PERFORM refresh_prospect_next_action(OLD.prospect_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prospect_tasks_next_action_ins ON prospect_tasks;
CREATE TRIGGER trg_prospect_tasks_next_action_ins
  AFTER INSERT OR UPDATE OR DELETE ON prospect_tasks
  FOR EACH ROW EXECUTE FUNCTION trg_prospect_tasks_next_action();

-- ============================================================================
-- prospect_imports: audit per upload-batch
-- ============================================================================
CREATE TABLE IF NOT EXISTS prospect_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  filename text,
  format text CHECK (format IN ('csv','xlsx')),
  total_rows int DEFAULT 0,
  imported_rows int DEFAULT 0,
  skipped_rows int DEFAULT 0,
  duplicate_rows int DEFAULT 0,
  error_rows int DEFAULT 0,
  column_mapping jsonb,
  assignment_strategy text CHECK (assignment_strategy IN ('manual','specific_am','round_robin')),
  assignment_admin_ids uuid[],
  errors jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_imports_admin ON prospect_imports(admin_id, created_at DESC);

-- ============================================================================
-- Documentatie
-- ============================================================================
COMMENT ON TABLE prospects IS 'Sales-pipeline: installateur-bedrijven die WarmeLeads als klant wil winnen. Niet te verwarren met `leads` (consumer-leads die we leveren aan customers).';
COMMENT ON COLUMN prospects.converted_to_customer_id IS 'Gevuld zodra de prospect promoveert tot een paying customer.';
COMMENT ON COLUMN prospects.next_action_at IS 'Earliest due_at van een open prospect_tasks-rij. Bijgewerkt via trigger.';
COMMENT ON TABLE prospect_activities IS 'Append-only timeline per prospect (notes, calls, emails, status changes, assignments, imports).';
COMMENT ON TABLE prospect_tasks IS 'Open todos/reminders gekoppeld aan een prospect en een AM.';
COMMENT ON TABLE prospect_imports IS 'Audit-trail voor elke Excel/CSV-import-batch.';
