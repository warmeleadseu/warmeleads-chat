-- 119_ai_image_provider.sql
--
-- Multi-provider AI Ad Image Engine v1: voegt provider/model-tracking toe
-- aan creative-varianten en een preferred provider op brief-niveau.
--
-- Achtergrond: tot nu toe gebruikten we exclusief gpt-image-1 voor alle
-- creatives. Dat leidde tot "AI-achtige" beelden met slechte conversie.
-- We introduceren nu een abstracte image-provider laag:
--   - Replicate (Flux 1.1 Pro Ultra, Ideogram v3 Turbo, Recraft V3, Imagen 4 Ultra)
--   - OpenAI gpt-image-1 (behouden als fallback)
--   - Pexels + sharp overlay (hybride 'echte foto + lokale typografie')
--
-- Per variant slaan we exact op welke provider+model het beeld heeft
-- gemaakt zodat de optimizer later kan groeperen op CPL per provider.
-- Per brief kan de admin een preferred_image_provider zetten ('auto'
-- = smart routing op style + overlay.enabled).
--
-- Backwards-compat: bestaande rijen krijgen NULL voor provider/model
-- en blijven gewoon werken in de UI (badge toont 'legacy' bij NULL).

ALTER TABLE public.ai_campaign_variants
  ADD COLUMN IF NOT EXISTS image_provider text,
  ADD COLUMN IF NOT EXISTS image_model text;

ALTER TABLE public.ai_campaign_briefs
  ADD COLUMN IF NOT EXISTS preferred_image_provider text DEFAULT 'auto';

COMMENT ON COLUMN public.ai_campaign_variants.image_provider IS
  'Provider die dit beeld heeft gegenereerd: openai / replicate / pexels. NULL voor pre-v3 varianten.';
COMMENT ON COLUMN public.ai_campaign_variants.image_model IS
  'Exact model dat is gebruikt, bv. gpt-image-1 / black-forest-labs/flux-1.1-pro-ultra / ideogram-ai/ideogram-v3-turbo / recraft-ai/recraft-v3 / google/imagen-4-ultra / pexels_overlay.';
COMMENT ON COLUMN public.ai_campaign_briefs.preferred_image_provider IS
  'Door admin gekozen image-engine bij genereren: auto (default, smart routing op visueel DNA) / flux / ideogram / recraft / imagen / pexels_overlay / gpt.';

-- Index zodat de optimizer en het live dashboard snel per provider
-- kunnen groeperen om de CPL-prestatie per image-engine te aggregeren.
CREATE INDEX IF NOT EXISTS idx_ai_variants_image_provider
  ON public.ai_campaign_variants(image_provider)
  WHERE image_provider IS NOT NULL;
