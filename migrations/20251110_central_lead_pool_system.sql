-- Central Lead Pool & Intelligent Distribution System Migration
-- Complete refactor for unlimited lead distribution with smart geographic matching

-- ============================================================================
-- META LEAD FORMS TABLE
-- Configuration for Meta/Facebook lead forms per branch
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta_lead_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Meta form info
  form_id TEXT UNIQUE NOT NULL, -- Meta/Facebook Form ID
  form_name TEXT NOT NULL,
  
  -- Branch assignment
  branch_id TEXT NOT NULL, -- thuisbatterijen, zonnepanelen, kozijnen, airco, etc.
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Stats
  total_leads_received INTEGER DEFAULT 0,
  last_lead_received_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  notes TEXT
);

-- ============================================================================
-- CUSTOMER BATCHES TABLE
-- Tracks which customers have active batches and their capacity
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_email TEXT NOT NULL,
  
  -- Batch configuration
  batch_number TEXT NOT NULL, -- e.g. "BATCH-2025-001"
  branch_id TEXT NOT NULL, -- thuisbatterijen, zonnepanelen, etc.
  total_batch_size INTEGER NOT NULL, -- Totaal besteld (bijv. 50)
  current_batch_count INTEGER DEFAULT 0, -- Hoeveel al ontvangen
  
  -- Google Sheets integration
  spreadsheet_url TEXT NOT NULL, -- Google Sheets URL voor deze batch
  sheet_name TEXT DEFAULT 'Leads', -- Tab naam in spreadsheet
  
  -- Geographic filtering
  territory_type TEXT NOT NULL, -- 'radius', 'full_country', 'regions'
  center_postcode TEXT,
  center_lat DECIMAL(10,7),
  center_lng DECIMAL(10,7),
  radius_km INTEGER,
  allowed_regions TEXT[], -- Array of province names
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_completed BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_lead_received_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  order_id TEXT, -- Link to original order
  notes TEXT,
  
  -- Foreign key
  CONSTRAINT fk_customer_email
    FOREIGN KEY (customer_email)
    REFERENCES customers(email)
    ON DELETE CASCADE
);

-- ============================================================================
-- LEAD DISTRIBUTIONS TABLE
-- Complete history of every lead distribution to every customer
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_distributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id TEXT NOT NULL, -- FK to leads table
  customer_email TEXT NOT NULL,
  batch_id UUID NOT NULL,
  
  -- Distribution details
  distributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  distribution_type TEXT NOT NULL, -- 'fresh', 'returning_new_customer', 'reuse_30d'
  
  -- Geographic matching info
  distance_km DECIMAL(8,2), -- Distance from customer's center point
  territory_match_type TEXT, -- 'radius', 'full_country', 'region'
  priority_score INTEGER, -- Lower = higher priority (smaller radius)
  
  -- Lead state at time of distribution
  days_since_first_seen INTEGER,
  days_since_last_seen INTEGER,
  previous_distribution_count INTEGER, -- How many times lead was distributed before this
  
  -- Spreadsheet sync
  added_to_sheet BOOLEAN DEFAULT false,
  sheet_row_number INTEGER,
  sheet_sync_error TEXT,
  synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Flags
  is_returning_lead BOOLEAN DEFAULT false, -- Lead filled form multiple times
  is_reuse_distribution BOOLEAN DEFAULT false, -- 30+ day re-distribution
  counts_towards_batch BOOLEAN DEFAULT true, -- False for bonus/reuse leads
  
  -- Foreign keys
  CONSTRAINT fk_lead_id
    FOREIGN KEY (lead_id)
    REFERENCES leads(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_customer_email_dist
    FOREIGN KEY (customer_email)
    REFERENCES customers(email)
    ON DELETE CASCADE,
  CONSTRAINT fk_batch_id
    FOREIGN KEY (batch_id)
    REFERENCES customer_batches(id)
    ON DELETE CASCADE
);

-- ============================================================================
-- EXTEND LEADS TABLE
-- Add tracking for central lead pool system
-- ============================================================================
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS total_distribution_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unique_customers_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS form_submission_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_available_for_distribution BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS distribution_notes TEXT;

-- Make email unique for duplicate detection
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email_unique ON leads(email);

-- ============================================================================
-- EXTEND CUSTOMERS TABLE
-- Add batch management fields
-- ============================================================================
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS total_batches_ordered INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_leads_received INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_batch_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_lead_types TEXT[] DEFAULT '{}';

-- ============================================================================
-- META LEAD PROCESSING TABLE (update from previous migration)
-- ============================================================================
-- Drop old table if exists and recreate with new structure
DROP TABLE IF EXISTS meta_lead_processing CASCADE;

CREATE TABLE meta_lead_processing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meta_lead_id TEXT UNIQUE NOT NULL,
  
  -- Raw data
  raw_meta_data JSONB NOT NULL,
  
  -- Extracted lead info
  email TEXT,
  phone TEXT,
  name TEXT,
  branch_id TEXT,
  postcode TEXT,
  
  -- Processing results
  processing_status TEXT DEFAULT 'received', -- received, duplicate_found, distributed, no_eligible_customers
  is_duplicate BOOLEAN DEFAULT false,
  existing_lead_id TEXT, -- If duplicate, link to existing lead
  
  -- Distribution results
  distributions_made INTEGER DEFAULT 0,
  distributed_to_customers TEXT[], -- Array of customer emails
  
  -- Timestamps
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Meta lead forms
CREATE INDEX IF NOT EXISTS idx_meta_lead_forms_branch
  ON meta_lead_forms(branch_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_meta_lead_forms_form_id
  ON meta_lead_forms(form_id);

-- Customer batches
CREATE INDEX IF NOT EXISTS idx_customer_batches_customer_email
  ON customer_batches(customer_email);
CREATE INDEX IF NOT EXISTS idx_customer_batches_branch_active
  ON customer_batches(branch_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_customer_batches_is_active
  ON customer_batches(is_active);

-- Lead distributions
CREATE INDEX IF NOT EXISTS idx_lead_distributions_lead_id
  ON lead_distributions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_distributions_customer_email
  ON lead_distributions(customer_email);
CREATE INDEX IF NOT EXISTS idx_lead_distributions_batch_id
  ON lead_distributions(batch_id);
CREATE INDEX IF NOT EXISTS idx_lead_distributions_distributed_at
  ON lead_distributions(distributed_at DESC);

-- Leads (additional)
CREATE INDEX IF NOT EXISTS idx_leads_branch_available
  ON leads(branch, is_available_for_distribution) 
  WHERE is_available_for_distribution = true;
CREATE INDEX IF NOT EXISTS idx_leads_last_seen_at
  ON leads(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone
  ON leads(phone);

-- Meta lead processing
CREATE INDEX IF NOT EXISTS idx_meta_lead_processing_email
  ON meta_lead_processing(email);
CREATE INDEX IF NOT EXISTS idx_meta_lead_processing_status
  ON meta_lead_processing(processing_status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE meta_lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_lead_processing ENABLE ROW LEVEL SECURITY;

-- Meta lead forms: admin only
CREATE POLICY "admin_meta_forms" ON meta_lead_forms
  FOR ALL USING (auth.role() = 'service_role');

-- Customer batches: customers see only their own
CREATE POLICY "customers_own_batches" ON customer_batches
  FOR SELECT USING (customer_email = auth.email());

-- Lead distributions: customers see only their own distributions
CREATE POLICY "customers_own_distributions" ON lead_distributions
  FOR SELECT USING (customer_email = auth.email());

-- Meta lead processing: admin only
CREATE POLICY "admin_meta_processing" ON meta_lead_processing
  FOR ALL USING (auth.role() = 'service_role');

-- Admin can see everything
CREATE POLICY "admin_all_batches" ON customer_batches
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_distributions" ON lead_distributions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get available distribution slots for a lead
CREATE OR REPLACE FUNCTION get_available_customers_for_lead(
  p_lead_id TEXT,
  p_branch_id TEXT
)
RETURNS TABLE(
  customer_email TEXT,
  batch_id UUID,
  priority_score INTEGER,
  territory_type TEXT,
  center_lat DECIMAL,
  center_lng DECIMAL,
  radius_km INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cb.customer_email,
    cb.id as batch_id,
    CASE 
      WHEN cb.territory_type = 'radius' THEN cb.radius_km
      WHEN cb.territory_type = 'regions' THEN 500
      WHEN cb.territory_type = 'full_country' THEN 1000
      ELSE 9999
    END as priority_score,
    cb.territory_type,
    cb.center_lat,
    cb.center_lng,
    cb.radius_km
  FROM customer_batches cb
  WHERE cb.branch_id = p_branch_id
    AND cb.is_active = true
    AND cb.current_batch_count < cb.total_batch_size
    AND cb.customer_email NOT IN (
      SELECT ld.customer_email
      FROM lead_distributions ld
      WHERE ld.lead_id = p_lead_id
    )
  ORDER BY priority_score ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get customers eligible for 30+ day reuse
CREATE OR REPLACE FUNCTION get_reuse_eligible_customers(
  p_lead_id TEXT
)
RETURNS TABLE(
  customer_email TEXT,
  batch_id UUID,
  days_since_last_distribution INTEGER,
  last_distributed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ld.customer_email,
    ld.batch_id,
    EXTRACT(DAY FROM NOW() - ld.distributed_at)::INTEGER as days_since_last_distribution,
    ld.distributed_at as last_distributed_at
  FROM lead_distributions ld
  JOIN customer_batches cb ON ld.batch_id = cb.id
  WHERE ld.lead_id = p_lead_id
    AND cb.is_active = true
    AND EXTRACT(DAY FROM NOW() - ld.distributed_at) >= 30
  ORDER BY ld.distributed_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meta_lead_forms') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_batches') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_distributions') THEN
    RAISE NOTICE '✅ Migration successful: Central Lead Pool System ready!';
  ELSE
    RAISE EXCEPTION '❌ Migration failed: Tables not created';
  END IF;
END $$;

