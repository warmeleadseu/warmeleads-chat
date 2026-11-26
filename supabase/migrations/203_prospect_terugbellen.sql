-- Terugbellen voor accountmanagers (prospectlijst) en de terugbelfunctie voor alle klanten.
--
-- 1. Een terugbelafspraak met een prospect is een belttaak (prospect_tasks, type 'call')
--    met een tijdstip en een seintje vooraf: 5 of 15 minuten. Zonder seintje_min geen
--    pop-up, zodat bestaande taken niets veranderen. herinnerd_op voorkomt dubbele pushmeldingen.
-- 2. Pushmeldingen voor admins, los van die van klanten.
-- 3. De terugbelfunctie in het portaal staat voor alle klanten aan, ook voor nieuwe.

ALTER TABLE prospect_tasks ADD COLUMN IF NOT EXISTS seintje_min smallint;
ALTER TABLE prospect_tasks ADD COLUMN IF NOT EXISTS herinnerd_op timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospect_tasks_seintje_min_check') THEN
    ALTER TABLE prospect_tasks ADD CONSTRAINT prospect_tasks_seintje_min_check CHECK (seintje_min IS NULL OR seintje_min IN (5, 15));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_prospect_tasks_seintje ON prospect_tasks(due_at)
  WHERE completed_at IS NULL AND seintje_min IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_admin ON admin_push_subscriptions(admin_user_id);
ALTER TABLE admin_push_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE customers ALTER COLUMN terugbellen SET DEFAULT true;
UPDATE customers SET terugbellen = true WHERE terugbellen IS DISTINCT FROM true;
