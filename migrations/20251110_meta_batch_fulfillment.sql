-- Meta Batch Fulfillment System Migration
-- Adds tables for Meta/Facebook ads campaign management and intelligent lead qualifying

-- Customer Meta Campaigns Table
-- Stores configuration for each customer's Meta campaign
CREATE TABLE IF NOT EXISTS customer_meta_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_email TEXT NOT NULL,
  meta_campaign_id TEXT UNIQUE NOT NULL, -- Facebook Campaign ID
  meta_form_id TEXT NOT NULL, -- Facebook Form ID

  -- Campaign settings
  campaign_name TEXT,
  branch_id TEXT NOT NULL,

  -- Batch management
  total_batch_size INTEGER NOT NULL DEFAULT 0, -- Total ordered (e.g. 50)
  current_batch_count INTEGER DEFAULT 0, -- Received so far
  is_batch_active BOOLEAN DEFAULT true, -- Still accepting leads?

  -- Geographic filtering
  territory_type TEXT NOT NULL, -- 'radius', 'full_country', 'regions'
  center_postcode TEXT,
  center_lat DECIMAL(10,7),
  center_lng DECIMAL(10,7),
  radius_km INTEGER,
  allowed_regions TEXT[], -- Array of province names

  -- Webhook security
  webhook_token TEXT UNIQUE NOT NULL, -- For webhook verification
  is_webhook_active BOOLEAN DEFAULT true,

  -- Status & timestamps
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_lead_received TIMESTAMP WITH TIME ZONE,
  batch_completed_at TIMESTAMP WITH TIME ZONE,

  -- Foreign key constraint
  CONSTRAINT fk_customer_email
    FOREIGN KEY (customer_email)
    REFERENCES customers(email)
    ON DELETE CASCADE
);

-- Meta Lead Processing Table
-- Logs all incoming Meta leads and their processing results
CREATE TABLE IF NOT EXISTS meta_lead_processing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meta_lead_id TEXT UNIQUE NOT NULL, -- Facebook Lead ID
  meta_campaign_id TEXT NOT NULL, -- Links to customer_meta_campaigns
  customer_email TEXT NOT NULL,

  -- Raw and processed data
  raw_meta_data JSONB NOT NULL, -- Complete webhook payload
  processed_lead_data JSONB, -- Cleaned lead data

  -- Qualification results
  branch_match BOOLEAN DEFAULT false,
  territory_match BOOLEAN DEFAULT false,
  batch_capacity_available BOOLEAN DEFAULT false,
  qualification_score INTEGER DEFAULT 0, -- 0-100

  -- Processing status
  processing_status TEXT DEFAULT 'received', -- received, qualified, distributed, rejected
  rejection_reason TEXT, -- 'wrong_branch', 'outside_territory', 'batch_full', 'duplicate'

  -- Geographic data
  lead_postcode TEXT,
  lead_lat DECIMAL(10,7),
  lead_lng DECIMAL(10,7),
  distance_to_center_km DECIMAL(8,2),

  -- Lead outcome (if qualified)
  created_lead_id TEXT, -- Links to leads table if distributed
  distributed_to_sheet BOOLEAN DEFAULT false,

  -- Timestamps
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  qualified_at TIMESTAMP WITH TIME ZONE,
  distributed_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE
);

-- Extend existing customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS active_meta_campaigns TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS batch_completion_alerts BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS meta_notification_email TEXT; -- Override notification email

-- Extend existing leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS meta_lead_id TEXT,
ADD COLUMN IF NOT EXISTS meta_campaign_id TEXT,
ADD COLUMN IF NOT EXISTS qualification_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS territory_distance_km DECIMAL(8,2);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_meta_campaigns_customer_email
  ON customer_meta_campaigns(customer_email);

CREATE INDEX IF NOT EXISTS idx_customer_meta_campaigns_meta_campaign_id
  ON customer_meta_campaigns(meta_campaign_id);

CREATE INDEX IF NOT EXISTS idx_meta_lead_processing_meta_lead_id
  ON meta_lead_processing(meta_lead_id);

CREATE INDEX IF NOT EXISTS idx_meta_lead_processing_customer_email
  ON meta_lead_processing(customer_email);

CREATE INDEX IF NOT EXISTS idx_meta_lead_processing_status
  ON meta_lead_processing(processing_status);

CREATE INDEX IF NOT EXISTS idx_meta_lead_processing_received_at
  ON meta_lead_processing(received_at DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE customer_meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_lead_processing ENABLE ROW LEVEL SECURITY;

-- Customers can only see their own campaigns
CREATE POLICY "customers_own_campaigns" ON customer_meta_campaigns
  FOR ALL USING (customer_email = auth.email());

-- Customers can only see processing logs for their campaigns
CREATE POLICY "customers_own_processing_logs" ON meta_lead_processing
  FOR SELECT USING (customer_email = auth.email());

-- Admin can see everything (using service role)
CREATE POLICY "admin_all_campaigns" ON customer_meta_campaigns
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_processing_logs" ON meta_lead_processing
  FOR ALL USING (auth.role() = 'service_role');
