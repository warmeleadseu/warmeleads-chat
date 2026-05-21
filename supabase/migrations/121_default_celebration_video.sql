-- 121_default_celebration_video.sql
--
-- Default celebration-video voor het live dashboard.
--
-- Probleem: bij elke sale toont admin/live een vrolijke YouTube-clip als de
-- bijbehorende accountmanager (admin_users.celebration_video_url) er één
-- heeft ingesteld. AMs zonder eigen URL kregen daardoor alleen confetti +
-- toast bij hun verkopen — dat voelde voor het team alsof hun sales
-- "minder gevierd" werden.
--
-- Oplossing: een centrale fallback in app_settings die geldt voor elke AM
-- die zelf nog geen URL heeft ingevuld. Iedere sale heeft daarmee altijd
-- een feestvideo op het live dashboard.
--
-- De default-URL hieronder is een korte, embeddable clip die we in
-- productie al hebben getest (Bart's "Rick Roll Link" — kort, eindigt
-- vanzelf binnen 30s en is bewezen embeddable). De admin kan deze later
-- aanpassen via /admin/instellingen of de settings-API.

INSERT INTO public.app_settings (key, value)
VALUES
  ('default_celebration_video_url', 'https://youtu.be/Aq5WXmQQooo?si=QLCSQ6a0KfP4sIes'),
  ('default_celebration_video_start', '0'),
  ('default_celebration_video_end', '15')
ON CONFLICT (key) DO NOTHING;
