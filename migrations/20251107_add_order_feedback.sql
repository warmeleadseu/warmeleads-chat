-- Voeg feedbackvelden toe aan orders tabel

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS feedback_rating INTEGER,
  ADD COLUMN IF NOT EXISTS feedback_notes TEXT,
  ADD COLUMN IF NOT EXISTS feedback_submitted_at TIMESTAMPTZ;

COMMIT;
