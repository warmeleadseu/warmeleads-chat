-- Session invalidation bump on password reset (checked in portal JWT verify).

CREATE TABLE IF NOT EXISTS portal_session_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  portal_user_id uuid REFERENCES portal_users(id) ON DELETE CASCADE,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT portal_session_versions_owner_xor CHECK (
    (customer_id IS NOT NULL AND portal_user_id IS NULL)
    OR (customer_id IS NULL AND portal_user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_session_versions_customer
  ON portal_session_versions (customer_id)
  WHERE portal_user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_session_versions_portal_user
  ON portal_session_versions (portal_user_id)
  WHERE portal_user_id IS NOT NULL;

ALTER TABLE portal_session_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on portal_session_versions"
  ON portal_session_versions FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION bump_portal_session_version(
  p_customer_id uuid DEFAULT NULL,
  p_portal_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v bigint := EXTRACT(EPOCH FROM now())::bigint;
BEGIN
  IF p_portal_user_id IS NOT NULL THEN
    UPDATE portal_session_versions
    SET version = v, updated_at = now()
    WHERE portal_user_id = p_portal_user_id;
    IF NOT FOUND THEN
      INSERT INTO portal_session_versions (portal_user_id, version, updated_at)
      VALUES (p_portal_user_id, v, now());
    END IF;
  ELSIF p_customer_id IS NOT NULL THEN
    UPDATE portal_session_versions
    SET version = v, updated_at = now()
    WHERE customer_id = p_customer_id AND portal_user_id IS NULL;
    IF NOT FOUND THEN
      INSERT INTO portal_session_versions (customer_id, version, updated_at)
      VALUES (p_customer_id, v, now());
    END IF;
  END IF;
END;
$$;
