-- ============================================================
-- Dynamic branches system
-- ============================================================

-- 1. Create branches table
CREATE TABLE branches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_branches_slug ON branches(slug);
CREATE INDEX idx_branches_is_active ON branches(is_active);

-- 2. Create branch_fields table
CREATE TABLE branch_fields (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'select', 'number', 'boolean', 'textarea')),
  options text[] DEFAULT '{}',
  is_required boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(branch_id, key)
);

CREATE INDEX idx_branch_fields_branch_id ON branch_fields(branch_id);

-- 3. Add custom_fields JSONB column to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}';
CREATE INDEX idx_leads_custom_fields ON leads USING GIN (custom_fields);

-- 4. Seed: insert thuisbatterij and airco branches
INSERT INTO branches (slug, name, color, description, sort_order) VALUES
  ('thuisbatterij', 'Thuisbatterij', 'emerald', 'Leads voor thuisbatterij installaties', 0),
  ('airco', 'Airco', 'sky', 'Leads voor airconditioning installaties', 1);

-- 5. Seed: insert branch fields for thuisbatterij
INSERT INTO branch_fields (branch_id, key, label, field_type, is_required, sort_order)
SELECT b.id, v.key, v.label, v.field_type, v.is_required, v.sort_order
FROM branches b,
(VALUES
  ('zonnepanelen', 'Zonnepanelen', 'text', false, 0),
  ('dynamisch_contract', 'Dynamisch contract', 'text', false, 1),
  ('stroomverbruik', 'Stroomverbruik', 'text', false, 2),
  ('budget', 'Budget', 'text', false, 3),
  ('reden_thuisbatterij', 'Reden thuisbatterij', 'text', false, 4)
) AS v(key, label, field_type, is_required, sort_order)
WHERE b.slug = 'thuisbatterij';

-- 6. Seed: insert branch fields for airco
INSERT INTO branch_fields (branch_id, key, label, field_type, is_required, sort_order)
SELECT b.id, v.key, v.label, v.field_type, v.is_required, v.sort_order
FROM branches b,
(VALUES
  ('type_airco', 'Type airco', 'text', false, 0),
  ('koelen_verwarmen', 'Koelen/verwarmen', 'text', false, 1),
  ('hoeveel_ruimtes', 'Hoeveel ruimtes', 'text', false, 2),
  ('zakelijk', 'Zakelijk', 'text', false, 3),
  ('koop_of_huur', 'Koop of huur', 'text', false, 4),
  ('boorwerkzaamheden_toegestaan', 'Boorwerkzaamheden toegestaan', 'text', false, 5)
) AS v(key, label, field_type, is_required, sort_order)
WHERE b.slug = 'airco';

-- 7. Migrate existing lead data into custom_fields JSONB
UPDATE leads SET custom_fields = jsonb_strip_nulls(jsonb_build_object(
  'zonnepanelen', zonnepanelen,
  'dynamisch_contract', dynamisch_contract,
  'stroomverbruik', stroomverbruik,
  'budget', budget,
  'reden_thuisbatterij', reden_thuisbatterij
)) WHERE branch = 'thuisbatterij';

UPDATE leads SET custom_fields = jsonb_strip_nulls(jsonb_build_object(
  'type_airco', type_airco,
  'koelen_verwarmen', koelen_verwarmen,
  'hoeveel_ruimtes', hoeveel_ruimtes,
  'zakelijk', zakelijk,
  'koop_of_huur', koop_of_huur,
  'boorwerkzaamheden_toegestaan', boorwerkzaamheden_toegestaan
)) WHERE branch = 'airco';

-- 8. Remove CHECK constraints and add FK to branches
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_branch_check;
ALTER TABLE webhook_keys DROP CONSTRAINT IF EXISTS webhook_keys_branch_check;

ALTER TABLE leads ADD CONSTRAINT leads_branch_fk
  FOREIGN KEY (branch) REFERENCES branches(slug) ON UPDATE CASCADE;

ALTER TABLE webhook_keys ADD CONSTRAINT webhook_keys_branch_fk
  FOREIGN KEY (branch) REFERENCES branches(slug) ON UPDATE CASCADE;

-- 9. Add updated_at trigger for branches
CREATE TRIGGER set_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
