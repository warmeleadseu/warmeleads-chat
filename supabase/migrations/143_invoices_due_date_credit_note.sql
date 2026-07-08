-- Facturen: vervaldatum ('te laat'-signalering) + koppeling creditnota → originele factuur.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_note_of uuid REFERENCES invoices(id) ON DELETE SET NULL;

-- Index voor 'te laat'-queries (alleen relevante rijen).
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date) WHERE due_date IS NOT NULL;
-- Index om snel de creditnota bij een factuur te vinden.
CREATE INDEX IF NOT EXISTS idx_invoices_credit_note_of ON invoices(credit_note_of) WHERE credit_note_of IS NOT NULL;

COMMENT ON COLUMN invoices.due_date IS 'Vervaldatum van de factuur (open facturen: te laat wanneer nu > due_date).';
COMMENT ON COLUMN invoices.credit_note_of IS 'Verwijst naar de originele factuur wanneer deze rij een creditnota is.';
