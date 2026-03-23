-- ============================================================
-- Meta Ads cost tracking
-- Stores ad metadata per lead + daily spend data for CPL calculation
-- ============================================================

-- 1. Add Meta ad identifiers to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_campaign_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_adset_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_ad_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_cost numeric(10, 2);

CREATE INDEX IF NOT EXISTS idx_leads_meta_ad_id ON leads(meta_ad_id) WHERE meta_ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_meta_campaign_id ON leads(meta_campaign_id) WHERE meta_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_lead_cost ON leads(lead_cost) WHERE lead_cost IS NOT NULL;

-- 2. Daily ad spend cache (synced from Meta Marketing API)
CREATE TABLE IF NOT EXISTS meta_ad_spend (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_account_id text NOT NULL,
  campaign_id text NOT NULL,
  campaign_name text,
  adset_id text NOT NULL,
  adset_name text,
  ad_id text NOT NULL,
  ad_name text,
  date date NOT NULL,
  spend numeric(10, 2) NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  leads_count integer NOT NULL DEFAULT 0,
  cpl numeric(10, 2),
  synced_at timestamptz DEFAULT now(),
  UNIQUE(ad_id, date)
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_ad_id ON meta_ad_spend(ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_campaign_id ON meta_ad_spend(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_date ON meta_ad_spend(date);

-- 3. App settings (key-value store for Meta API credentials etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
