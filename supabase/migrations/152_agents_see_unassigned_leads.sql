-- Portaal: agents mogen optioneel de niet-toegewezen lead-pool niet zien.
-- Default TRUE = bestaand gedrag (eigen + niet-toegewezen).
-- FALSE = alleen expliciet aan de agent toegewezen leads (o.a. Bespaarr).

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS agents_see_unassigned_leads boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN customers.agents_see_unassigned_leads IS
  'Portaal: als false zien agents zonder leads.view_all alleen leads die aan hen zijn toegewezen, niet de open (niet-toegewezen) pool.';

-- Bespaarr: strikte agent-scope (geen historische batch-pool voor nieuwe agents)
UPDATE customers
SET agents_see_unassigned_leads = false
WHERE lower(name) IN ('bespaarr', 'bespaar')
   OR lower(name) LIKE 'bespaarr%';
