CREATE TABLE IF NOT EXISTS bookings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  time text NOT NULL,
  name text NOT NULL,
  company text,
  email text NOT NULL,
  phone text NOT NULL,
  branch text,
  message text,
  status text DEFAULT 'bevestigd',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_blocked (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  time text,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_blocked ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on bookings"
  ON bookings FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on booking_blocked"
  ON booking_blocked FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Anon can insert bookings"
  ON bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon can read bookings"
  ON bookings FOR SELECT
  USING (true);

CREATE POLICY "Anon can read booking_blocked"
  ON booking_blocked FOR SELECT
  USING (true);
