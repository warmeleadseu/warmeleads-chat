-- Standaard partner-prospect AM-config (Rick, single) — overschrijft geen bestaande key.
INSERT INTO app_settings (key, value, updated_at)
VALUES (
  'partner_prospect_am_config',
  '{"thuisbatterij_partners":{"strategy":"single","assignees":[{"admin_user_id":"64cad239-1eaf-497e-9c2b-d2ea60cb0512","weight":1}]}}',
  now()
)
ON CONFLICT (key) DO NOTHING;
