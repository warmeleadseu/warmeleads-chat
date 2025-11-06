-- =====================================================
-- BRANCH CONFIGURATION SYSTEM
-- Enterprise-grade multi-branch lead management
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. BRANCH DEFINITIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS branch_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT '📋',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for active branches
CREATE INDEX IF NOT EXISTS idx_branch_definitions_active ON branch_definitions(is_active);

-- =====================================================
-- 2. BRANCH FIELD MAPPINGS TABLE (Core of the system!)
-- =====================================================
CREATE TABLE IF NOT EXISTS branch_field_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branch_definitions(id) ON DELETE CASCADE,
  
  -- Spreadsheet mapping info
  column_letter VARCHAR(5) NOT NULL,
  column_index INTEGER NOT NULL,
  header_name VARCHAR(100) NOT NULL,
  
  -- System field mapping
  field_key VARCHAR(100) NOT NULL,
  field_label VARCHAR(100) NOT NULL,
  field_type VARCHAR(50) DEFAULT 'text' CHECK (field_type IN (
    'text', 'number', 'boolean', 'date', 'email', 'phone', 'currency', 'url', 'custom'
  )),
  
  -- Validation rules
  is_required BOOLEAN DEFAULT false,
  is_unique BOOLEAN DEFAULT false,
  validation_regex VARCHAR(500),
  
  -- Display settings
  show_in_list BOOLEAN DEFAULT true,
  show_in_detail BOOLEAN DEFAULT true,
  include_in_email BOOLEAN DEFAULT false,
  email_priority INTEGER DEFAULT 0,
  
  -- Metadata
  help_text TEXT,
  placeholder VARCHAR(200),
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique column per branch
  UNIQUE(branch_id, column_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_branch_field_mappings_branch ON branch_field_mappings(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_field_mappings_column ON branch_field_mappings(branch_id, column_index);
CREATE INDEX IF NOT EXISTS idx_branch_field_mappings_email ON branch_field_mappings(branch_id, include_in_email) WHERE include_in_email = true;

-- =====================================================
-- 3. BRANCH EMAIL TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS branch_email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branch_definitions(id) ON DELETE CASCADE,
  
  template_type VARCHAR(50) NOT NULL CHECK (template_type IN (
    'new_lead', 'status_change', 'weekly_summary', 'lead_reminder'
  )),
  
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One template per type per branch
  UNIQUE(branch_id, template_type)
);

-- Index for active templates
CREATE INDEX IF NOT EXISTS idx_branch_email_templates_branch ON branch_email_templates(branch_id);

-- =====================================================
-- 4. UPDATE CUSTOMERS TABLE
-- =====================================================
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branch_definitions(id),
ADD COLUMN IF NOT EXISTS branch_config_version INTEGER DEFAULT 1;

-- Index for branch lookup
CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch_id) WHERE branch_id IS NOT NULL;

-- =====================================================
-- 5. SEED DATA: Thuisbatterijen (Existing Branch)
-- =====================================================
DO $$
DECLARE
  thuisbatterijen_id UUID;
BEGIN
  -- Insert Thuisbatterijen branch
  INSERT INTO branch_definitions (name, display_name, description, icon, is_active)
  VALUES (
    'thuisbatterijen',
    'Thuisbatterijen',
    'Lead tracking voor thuisbatterij installaties',
    '🔋',
    true
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    updated_at = NOW()
  RETURNING id INTO thuisbatterijen_id;
  
  -- Delete existing mappings to avoid duplicates
  DELETE FROM branch_field_mappings WHERE branch_id = thuisbatterijen_id;
  
  -- Insert field mappings for Thuisbatterijen (18 columns A-R)
  INSERT INTO branch_field_mappings (
    branch_id, column_letter, column_index, header_name, field_key, field_label, 
    field_type, is_required, show_in_list, show_in_detail, include_in_email, email_priority, sort_order
  ) VALUES
    (thuisbatterijen_id, 'A', 0, 'Naam Klant', 'customerName', 'Naam klant', 'text', true, true, true, true, 10, 1),
    (thuisbatterijen_id, 'B', 1, 'Datum Interesse Klant', 'datumInteresse', 'Datum interesse', 'date', false, true, true, true, 9, 2),
    (thuisbatterijen_id, 'C', 2, 'Postcode', 'postcode', 'Postcode', 'text', false, true, true, false, 0, 3),
    (thuisbatterijen_id, 'D', 3, 'Huisnummer', 'huisnummer', 'Huisnummer', 'text', false, false, true, false, 0, 4),
    (thuisbatterijen_id, 'E', 4, 'Plaatsnaam', 'city', 'Plaats', 'text', false, true, true, false, 0, 5),
    (thuisbatterijen_id, 'F', 5, 'Telefoonnummer', 'phone', 'Telefoonnummer', 'phone', true, true, true, true, 8, 6),
    (thuisbatterijen_id, 'G', 6, 'E-mail', 'email', 'E-mail', 'email', true, true, true, true, 7, 7),
    (thuisbatterijen_id, 'H', 7, 'Zonnepanelen', 'zonnepanelen', 'Heeft zonnepanelen?', 'boolean', false, true, true, true, 6, 8),
    (thuisbatterijen_id, 'I', 8, 'Dynamisch contract', 'dynamischContract', 'Dynamisch contract', 'boolean', false, true, true, true, 5, 9),
    (thuisbatterijen_id, 'J', 9, 'Stroomverbruik', 'stroomverbruik', 'Stroomverbruik', 'text', false, true, true, true, 4, 10),
    (thuisbatterijen_id, 'K', 10, 'Budget', 'budget', 'Budget', 'currency', false, false, true, false, 0, 11),
    (thuisbatterijen_id, 'L', 11, 'Nieuwsbrief', 'nieuwsbrief', 'Nieuwsbrief inschrijving', 'boolean', false, false, true, false, 0, 12),
    (thuisbatterijen_id, 'M', 12, 'Reden Thuisbatterij', 'redenThuisbatterij', 'Reden interesse', 'text', false, false, true, true, 3, 13),
    (thuisbatterijen_id, 'N', 13, 'Koopintentie?', 'koopintentie', 'Koopintentie', 'text', false, true, true, true, 2, 14),
    (thuisbatterijen_id, 'O', 14, 'Resultaat gesprek', 'notes', 'Notities/Resultaat', 'text', false, false, true, false, 0, 15),
    (thuisbatterijen_id, 'P', 15, 'Status', 'status', 'Status', 'text', false, true, true, true, 1, 16),
    (thuisbatterijen_id, 'Q', 16, 'DealValue', 'dealValue', 'Deal waarde', 'currency', false, false, true, false, 0, 17),
    (thuisbatterijen_id, 'R', 17, 'Profit', 'profit', 'Winst', 'currency', false, false, true, false, 0, 18);
  
  -- Insert default email template for Thuisbatterijen
  INSERT INTO branch_email_templates (branch_id, template_type, subject_template, body_template, is_active)
  VALUES (
    thuisbatterijen_id,
    'new_lead',
    '🔋 Nieuwe Thuisbatterij Lead: {{leadName}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .field { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
    .field-label { font-weight: bold; color: #667eea; }
    .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔋 Nieuwe Lead Ontvangen!</h1>
    </div>
    <div class="content">
      <p>Hallo <strong>{{customerName}}</strong>,</p>
      <p>Je hebt een nieuwe thuisbatterij lead ontvangen! 🎉</p>
      
      <h3>📋 Lead Details:</h3>
      {{#each notificationFields}}
      <div class="field">
        <span class="field-label">{{label}}:</span> {{value}}
      </div>
      {{/each}}
      
      <p style="margin-top: 20px;">
        <a href="{{portalLink}}" class="button">👉 Bekijk in Portal</a>
      </p>
      
      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        Je hebt nu <strong>{{totalLeads}}</strong> leads in totaal.
      </p>
    </div>
  </div>
</body>
</html>',
    true
  )
  ON CONFLICT (branch_id, template_type) DO UPDATE SET
    subject_template = EXCLUDED.subject_template,
    body_template = EXCLUDED.body_template,
    updated_at = NOW();
  
  RAISE NOTICE 'Thuisbatterijen branch seeded with ID: %', thuisbatterijen_id;
END $$;

-- =====================================================
-- 6. UPDATE EXISTING CUSTOMERS (Assign to Thuisbatterijen)
-- =====================================================
DO $$
DECLARE
  thuisbatterijen_id UUID;
BEGIN
  SELECT id INTO thuisbatterijen_id 
  FROM branch_definitions 
  WHERE name = 'thuisbatterijen';
  
  -- Update customers with Google Sheets to Thuisbatterijen branch
  UPDATE customers
  SET branch_id = thuisbatterijen_id,
      branch_config_version = 1
  WHERE google_sheet_id IS NOT NULL 
    AND branch_id IS NULL;
  
  RAISE NOTICE 'Updated existing customers with branch assignment';
END $$;

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE branch_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_email_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read branch definitions
CREATE POLICY "Branch definitions are viewable by everyone"
  ON branch_definitions FOR SELECT
  USING (true);

-- Policy: Only admins can modify branch definitions
CREATE POLICY "Only admins can modify branch definitions"
  ON branch_definitions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.email = auth.jwt() ->> 'email'
      AND users.role = 'owner'
    )
  );

-- Policy: Anyone can read field mappings
CREATE POLICY "Field mappings are viewable by everyone"
  ON branch_field_mappings FOR SELECT
  USING (true);

-- Policy: Only admins can modify field mappings
CREATE POLICY "Only admins can modify field mappings"
  ON branch_field_mappings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.email = auth.jwt() ->> 'email'
      AND users.role = 'owner'
    )
  );

-- Policy: Anyone can read email templates
CREATE POLICY "Email templates are viewable by everyone"
  ON branch_email_templates FOR SELECT
  USING (true);

-- Policy: Only admins can modify email templates
CREATE POLICY "Only admins can modify email templates"
  ON branch_email_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.email = auth.jwt() ->> 'email'
      AND users.role = 'owner'
    )
  );

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to get branch mappings as JSON
CREATE OR REPLACE FUNCTION get_branch_mappings(p_branch_id UUID)
RETURNS JSON AS $$
  SELECT json_agg(
    json_build_object(
      'id', id,
      'columnLetter', column_letter,
      'columnIndex', column_index,
      'headerName', header_name,
      'fieldKey', field_key,
      'fieldLabel', field_label,
      'fieldType', field_type,
      'isRequired', is_required,
      'showInList', show_in_list,
      'showInDetail', show_in_detail,
      'includeInEmail', include_in_email,
      'emailPriority', email_priority
    )
    ORDER BY column_index
  )
  FROM branch_field_mappings
  WHERE branch_id = p_branch_id;
$$ LANGUAGE SQL STABLE;

-- Function to get notification fields for a branch
CREATE OR REPLACE FUNCTION get_notification_fields(p_branch_id UUID)
RETURNS JSON AS $$
  SELECT json_agg(
    json_build_object(
      'fieldKey', field_key,
      'fieldLabel', field_label,
      'fieldType', field_type,
      'emailPriority', email_priority
    )
    ORDER BY email_priority DESC
  )
  FROM branch_field_mappings
  WHERE branch_id = p_branch_id
    AND include_in_email = true
    AND email_priority > 0;
$$ LANGUAGE SQL STABLE;

-- =====================================================
-- 9. TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_branch_definitions_updated_at
  BEFORE UPDATE ON branch_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branch_email_templates_updated_at
  BEFORE UPDATE ON branch_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
COMMENT ON TABLE branch_definitions IS 'Defines available branches for lead management';
COMMENT ON TABLE branch_field_mappings IS 'Maps spreadsheet columns to system fields per branch';
COMMENT ON TABLE branch_email_templates IS 'Email templates per branch for notifications';

-- BRANCH CONFIGURATION SYSTEM
-- Enterprise-grade multi-branch lead management
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. BRANCH DEFINITIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS branch_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT '📋',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for active branches
CREATE INDEX IF NOT EXISTS idx_branch_definitions_active ON branch_definitions(is_active);

-- =====================================================
-- 2. BRANCH FIELD MAPPINGS TABLE (Core of the system!)
-- =====================================================
CREATE TABLE IF NOT EXISTS branch_field_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branch_definitions(id) ON DELETE CASCADE,
  
  -- Spreadsheet mapping info
  column_letter VARCHAR(5) NOT NULL,
  column_index INTEGER NOT NULL,
  header_name VARCHAR(100) NOT NULL,
  
  -- System field mapping
  field_key VARCHAR(100) NOT NULL,
  field_label VARCHAR(100) NOT NULL,
  field_type VARCHAR(50) DEFAULT 'text' CHECK (field_type IN (
    'text', 'number', 'boolean', 'date', 'email', 'phone', 'currency', 'url', 'custom'
  )),
  
  -- Validation rules
  is_required BOOLEAN DEFAULT false,
  is_unique BOOLEAN DEFAULT false,
  validation_regex VARCHAR(500),
  
  -- Display settings
  show_in_list BOOLEAN DEFAULT true,
  show_in_detail BOOLEAN DEFAULT true,
  include_in_email BOOLEAN DEFAULT false,
  email_priority INTEGER DEFAULT 0,
  
  -- Metadata
  help_text TEXT,
  placeholder VARCHAR(200),
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique column per branch
  UNIQUE(branch_id, column_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_branch_field_mappings_branch ON branch_field_mappings(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_field_mappings_column ON branch_field_mappings(branch_id, column_index);
CREATE INDEX IF NOT EXISTS idx_branch_field_mappings_email ON branch_field_mappings(branch_id, include_in_email) WHERE include_in_email = true;

-- =====================================================
-- 3. BRANCH EMAIL TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS branch_email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branch_definitions(id) ON DELETE CASCADE,
  
  template_type VARCHAR(50) NOT NULL CHECK (template_type IN (
    'new_lead', 'status_change', 'weekly_summary', 'lead_reminder'
  )),
  
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One template per type per branch
  UNIQUE(branch_id, template_type)
);

-- Index for active templates
CREATE INDEX IF NOT EXISTS idx_branch_email_templates_branch ON branch_email_templates(branch_id);

-- =====================================================
-- 4. UPDATE CUSTOMERS TABLE
-- =====================================================
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branch_definitions(id),
ADD COLUMN IF NOT EXISTS branch_config_version INTEGER DEFAULT 1;

-- Index for branch lookup
CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch_id) WHERE branch_id IS NOT NULL;

-- =====================================================
-- 5. SEED DATA: Thuisbatterijen (Existing Branch)
-- =====================================================
DO $$
DECLARE
  thuisbatterijen_id UUID;
BEGIN
  -- Insert Thuisbatterijen branch
  INSERT INTO branch_definitions (name, display_name, description, icon, is_active)
  VALUES (
    'thuisbatterijen',
    'Thuisbatterijen',
    'Lead tracking voor thuisbatterij installaties',
    '🔋',
    true
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    updated_at = NOW()
  RETURNING id INTO thuisbatterijen_id;
  
  -- Delete existing mappings to avoid duplicates
  DELETE FROM branch_field_mappings WHERE branch_id = thuisbatterijen_id;
  
  -- Insert field mappings for Thuisbatterijen (18 columns A-R)
  INSERT INTO branch_field_mappings (
    branch_id, column_letter, column_index, header_name, field_key, field_label, 
    field_type, is_required, show_in_list, show_in_detail, include_in_email, email_priority, sort_order
  ) VALUES
    (thuisbatterijen_id, 'A', 0, 'Naam Klant', 'customerName', 'Naam klant', 'text', true, true, true, true, 10, 1),
    (thuisbatterijen_id, 'B', 1, 'Datum Interesse Klant', 'datumInteresse', 'Datum interesse', 'date', false, true, true, true, 9, 2),
    (thuisbatterijen_id, 'C', 2, 'Postcode', 'postcode', 'Postcode', 'text', false, true, true, false, 0, 3),
    (thuisbatterijen_id, 'D', 3, 'Huisnummer', 'huisnummer', 'Huisnummer', 'text', false, false, true, false, 0, 4),
    (thuisbatterijen_id, 'E', 4, 'Plaatsnaam', 'city', 'Plaats', 'text', false, true, true, false, 0, 5),
    (thuisbatterijen_id, 'F', 5, 'Telefoonnummer', 'phone', 'Telefoonnummer', 'phone', true, true, true, true, 8, 6),
    (thuisbatterijen_id, 'G', 6, 'E-mail', 'email', 'E-mail', 'email', true, true, true, true, 7, 7),
    (thuisbatterijen_id, 'H', 7, 'Zonnepanelen', 'zonnepanelen', 'Heeft zonnepanelen?', 'boolean', false, true, true, true, 6, 8),
    (thuisbatterijen_id, 'I', 8, 'Dynamisch contract', 'dynamischContract', 'Dynamisch contract', 'boolean', false, true, true, true, 5, 9),
    (thuisbatterijen_id, 'J', 9, 'Stroomverbruik', 'stroomverbruik', 'Stroomverbruik', 'text', false, true, true, true, 4, 10),
    (thuisbatterijen_id, 'K', 10, 'Budget', 'budget', 'Budget', 'currency', false, false, true, false, 0, 11),
    (thuisbatterijen_id, 'L', 11, 'Nieuwsbrief', 'nieuwsbrief', 'Nieuwsbrief inschrijving', 'boolean', false, false, true, false, 0, 12),
    (thuisbatterijen_id, 'M', 12, 'Reden Thuisbatterij', 'redenThuisbatterij', 'Reden interesse', 'text', false, false, true, true, 3, 13),
    (thuisbatterijen_id, 'N', 13, 'Koopintentie?', 'koopintentie', 'Koopintentie', 'text', false, true, true, true, 2, 14),
    (thuisbatterijen_id, 'O', 14, 'Resultaat gesprek', 'notes', 'Notities/Resultaat', 'text', false, false, true, false, 0, 15),
    (thuisbatterijen_id, 'P', 15, 'Status', 'status', 'Status', 'text', false, true, true, true, 1, 16),
    (thuisbatterijen_id, 'Q', 16, 'DealValue', 'dealValue', 'Deal waarde', 'currency', false, false, true, false, 0, 17),
    (thuisbatterijen_id, 'R', 17, 'Profit', 'profit', 'Winst', 'currency', false, false, true, false, 0, 18);
  
  -- Insert default email template for Thuisbatterijen
  INSERT INTO branch_email_templates (branch_id, template_type, subject_template, body_template, is_active)
  VALUES (
    thuisbatterijen_id,
    'new_lead',
    '🔋 Nieuwe Thuisbatterij Lead: {{leadName}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .field { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
    .field-label { font-weight: bold; color: #667eea; }
    .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔋 Nieuwe Lead Ontvangen!</h1>
    </div>
    <div class="content">
      <p>Hallo <strong>{{customerName}}</strong>,</p>
      <p>Je hebt een nieuwe thuisbatterij lead ontvangen! 🎉</p>
      
      <h3>📋 Lead Details:</h3>
      {{#each notificationFields}}
      <div class="field">
        <span class="field-label">{{label}}:</span> {{value}}
      </div>
      {{/each}}
      
      <p style="margin-top: 20px;">
        <a href="{{portalLink}}" class="button">👉 Bekijk in Portal</a>
      </p>
      
      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        Je hebt nu <strong>{{totalLeads}}</strong> leads in totaal.
      </p>
    </div>
  </div>
</body>
</html>',
    true
  )
  ON CONFLICT (branch_id, template_type) DO UPDATE SET
    subject_template = EXCLUDED.subject_template,
    body_template = EXCLUDED.body_template,
    updated_at = NOW();
  
  RAISE NOTICE 'Thuisbatterijen branch seeded with ID: %', thuisbatterijen_id;
END $$;

-- =====================================================
-- 6. UPDATE EXISTING CUSTOMERS (Assign to Thuisbatterijen)
-- =====================================================
DO $$
DECLARE
  thuisbatterijen_id UUID;
BEGIN
  SELECT id INTO thuisbatterijen_id 
  FROM branch_definitions 
  WHERE name = 'thuisbatterijen';
  
  -- Update customers with Google Sheets to Thuisbatterijen branch
  UPDATE customers
  SET branch_id = thuisbatterijen_id,
      branch_config_version = 1
  WHERE google_sheet_id IS NOT NULL 
    AND branch_id IS NULL;
  
  RAISE NOTICE 'Updated existing customers with branch assignment';
END $$;

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE branch_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_email_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read branch definitions
CREATE POLICY "Branch definitions are viewable by everyone"
  ON branch_definitions FOR SELECT
  USING (true);

-- Policy: Only admins can modify branch definitions
CREATE POLICY "Only admins can modify branch definitions"
  ON branch_definitions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.email = auth.jwt() ->> 'email'
      AND users.role = 'owner'
    )
  );

-- Policy: Anyone can read field mappings
CREATE POLICY "Field mappings are viewable by everyone"
  ON branch_field_mappings FOR SELECT
  USING (true);

-- Policy: Only admins can modify field mappings
CREATE POLICY "Only admins can modify field mappings"
  ON branch_field_mappings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.email = auth.jwt() ->> 'email'
      AND users.role = 'owner'
    )
  );

-- Policy: Anyone can read email templates
CREATE POLICY "Email templates are viewable by everyone"
  ON branch_email_templates FOR SELECT
  USING (true);

-- Policy: Only admins can modify email templates
CREATE POLICY "Only admins can modify email templates"
  ON branch_email_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.email = auth.jwt() ->> 'email'
      AND users.role = 'owner'
    )
  );

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to get branch mappings as JSON
CREATE OR REPLACE FUNCTION get_branch_mappings(p_branch_id UUID)
RETURNS JSON AS $$
  SELECT json_agg(
    json_build_object(
      'id', id,
      'columnLetter', column_letter,
      'columnIndex', column_index,
      'headerName', header_name,
      'fieldKey', field_key,
      'fieldLabel', field_label,
      'fieldType', field_type,
      'isRequired', is_required,
      'showInList', show_in_list,
      'showInDetail', show_in_detail,
      'includeInEmail', include_in_email,
      'emailPriority', email_priority
    )
    ORDER BY column_index
  )
  FROM branch_field_mappings
  WHERE branch_id = p_branch_id;
$$ LANGUAGE SQL STABLE;

-- Function to get notification fields for a branch
CREATE OR REPLACE FUNCTION get_notification_fields(p_branch_id UUID)
RETURNS JSON AS $$
  SELECT json_agg(
    json_build_object(
      'fieldKey', field_key,
      'fieldLabel', field_label,
      'fieldType', field_type,
      'emailPriority', email_priority
    )
    ORDER BY email_priority DESC
  )
  FROM branch_field_mappings
  WHERE branch_id = p_branch_id
    AND include_in_email = true
    AND email_priority > 0;
$$ LANGUAGE SQL STABLE;

-- =====================================================
-- 9. TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_branch_definitions_updated_at
  BEFORE UPDATE ON branch_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branch_email_templates_updated_at
  BEFORE UPDATE ON branch_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
COMMENT ON TABLE branch_definitions IS 'Defines available branches for lead management';
COMMENT ON TABLE branch_field_mappings IS 'Maps spreadsheet columns to system fields per branch';
COMMENT ON TABLE branch_email_templates IS 'Email templates per branch for notifications';

