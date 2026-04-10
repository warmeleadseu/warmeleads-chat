-- Store which lead IDs were part of each export (needed for undo)
ALTER TABLE lead_exports
  ADD COLUMN IF NOT EXISTS lead_ids uuid[] DEFAULT '{}';

-- RPC to atomically decrement bulk_export_count (for undo)
CREATE OR REPLACE FUNCTION decrement_bulk_export_count(lead_ids uuid[])
RETURNS void
LANGUAGE sql
AS $$
  UPDATE leads
  SET bulk_export_count = GREATEST(COALESCE(bulk_export_count, 0) - 1, 0)
  WHERE id = ANY(lead_ids);
$$;
