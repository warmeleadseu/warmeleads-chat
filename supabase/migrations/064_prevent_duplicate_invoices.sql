-- Remove duplicate invoices: keep earliest per batch_id, delete later ones
-- (only non-credit-note invoices; credit notes are legitimate secondary records)
DELETE FROM invoices
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY batch_id ORDER BY created_at ASC) AS rn
    FROM invoices
    WHERE batch_id IS NOT NULL
      AND status != 'credit_note'
  ) sub
  WHERE rn > 1
);

-- Prevent future duplicates at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_batch
  ON invoices(batch_id)
  WHERE batch_id IS NOT NULL AND status != 'credit_note';
