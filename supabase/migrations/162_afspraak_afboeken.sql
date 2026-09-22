-- Afspraken afboeken: uitkomst, dealwaarde en een echte verzet-geschiedenis.
--
-- WAAROM
-- ------
-- De agenda kon een afspraak alleen op 'voltooid' of 'niet verschenen' zetten.
-- Wat er tijdens het bezoek gebeurde, of er een deal uitkwam en voor hoeveel,
-- had nergens een plek. In productie stonden dan ook 26 afspraken waarvan er
-- niet één was afgeboekt: met twee knoppen valt er weinig te melden.
--
-- Daarnaast bestond `rescheduled_from_id` al in het schema, maar vulde geen
-- enkele regel code het ooit. Een afspraak verzetten schoof simpelweg de datum
-- op, waardoor je niet kon zien dat een lead drie keer had uitgesteld voordat
-- hij afzegde. Precies dat patroon wil je juist kunnen zien.

-- ── Uitkomst van een bezochte afspraak ────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_reason text,
  ADD COLUMN IF NOT EXISTS outcome_notes text,
  ADD COLUMN IF NOT EXISTS deal_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS outcome_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome_by_portal_user_id uuid REFERENCES portal_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by text;

COMMENT ON COLUMN appointments.outcome IS
  'Uitkomst van een bezochte afspraak: deal, no_deal of follow_up. Alleen gevuld bij status=completed.';
COMMENT ON COLUMN appointments.deal_value IS
  'Afgesproken orderbedrag in euro bij outcome=deal. Kaal bedrag, exclusief btw.';
COMMENT ON COLUMN appointments.cancelled_by IS
  'Wie de afspraak afzegde: lead, customer of admin. Onderscheidt een afzeggende consument van een afzeggende adviseur.';

-- Alleen waarden die de applicatie kent. Zonder deze grens sluipt er via een
-- los script of de Supabase-UI stilletjes een vierde uitkomst in, en dan
-- kloppen de conversiecijfers niet meer.
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_outcome_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('deal', 'no_deal', 'follow_up'));

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_cancelled_by_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_cancelled_by_check
  CHECK (cancelled_by IS NULL OR cancelled_by IN ('lead', 'customer', 'admin'));

-- Een dealbedrag zonder deal is een invoerfout, geen geldige toestand.
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_deal_value_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_deal_value_check
  CHECK (deal_value IS NULL OR (deal_value >= 0 AND outcome = 'deal'));

-- ── Verzetten als echte keten ─────────────────────────────────────────────
-- Het veld bestond al maar werd nooit gevuld. De index erbij, want het
-- opbouwen van de keten vraagt per afspraak om zijn opvolger.
CREATE INDEX IF NOT EXISTS idx_appointments_rescheduled_from
  ON appointments(rescheduled_from_id)
  WHERE rescheduled_from_id IS NOT NULL;

-- ── Indexen voor de agenda-weergaven en de conversiecijfers ───────────────
CREATE INDEX IF NOT EXISTS idx_appointments_customer_starts
  ON appointments(customer_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_appointments_outcome
  ON appointments(customer_id, outcome)
  WHERE outcome IS NOT NULL;
