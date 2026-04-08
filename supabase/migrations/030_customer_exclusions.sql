-- Lead exclusions: customers in each other's exclude list never share leads
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS exclude_customers UUID[] DEFAULT '{}';
