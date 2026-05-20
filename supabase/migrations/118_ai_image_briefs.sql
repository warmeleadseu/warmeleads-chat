-- 118_ai_image_briefs.sql
--
-- AI Ad Image Studio v3: voeg image_brief-data toe aan de creative-pijplijn.
--
-- ai_campaign_briefs krijgt visual_dna_json (door admin via StudioForm
-- gekozen chips, must-includes, overlay-frequentie). De strategist
-- gebruikt dit als input om per creative een complete image_brief te
-- plannen.
--
-- ai_campaign_variants krijgt vier nieuwe kolommen:
--  - image_brief_json: het complete plan dat de strategist heeft
--    bedacht (concept, subject, scene, composition, lighting, mood,
--    color_focus, style, overlay-object, copy_alignment)
--  - overlay_used: of er daadwerkelijk een tekst-overlay in het beeld
--    zit (boolean, voor latere optimizer-analyse per CPL).
--  - overlay_text: de exacte overlay-string die in beeld staat
--    (handig voor moderation + handmatige inspectie).
--  - aspect_ratio: '1024x1536' (mobile-feed 4:5 default) of
--    '1024x1024' (universele 1:1). Toekomstige formaten gewoon
--    erbij — we storen als tekst, geen enum.
--  - image_regeneration_count: hoe vaak deze variant opnieuw is
--    gerenderd ('change only X' iteraties). Voor audit + rate-limit.

ALTER TABLE public.ai_campaign_briefs
  ADD COLUMN IF NOT EXISTS visual_dna_json jsonb;

COMMENT ON COLUMN public.ai_campaign_briefs.visual_dna_json IS
  'Visueel DNA gekozen door admin in StudioForm: chips voor audience_looks/settings/moods/color_focuses/styles_enabled + overlay_frequency + must_include/must_avoid + brand_identity + example_overlays. Zie src/lib/aiVisualDNA.ts.';

ALTER TABLE public.ai_campaign_variants
  ADD COLUMN IF NOT EXISTS image_brief_json jsonb,
  ADD COLUMN IF NOT EXISTS overlay_used boolean,
  ADD COLUMN IF NOT EXISTS overlay_text text,
  ADD COLUMN IF NOT EXISTS aspect_ratio text DEFAULT '1024x1536',
  ADD COLUMN IF NOT EXISTS image_regeneration_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ai_campaign_variants.image_brief_json IS
  'Door strategist gepland visueel concept (concept/subject/scene/composition/lighting/mood/color_focus/style/overlay/copy_alignment). Driver van de uiteindelijke image-prompt.';
COMMENT ON COLUMN public.ai_campaign_variants.overlay_used IS
  'Of dit beeld een tekst-overlay heeft. Apart van image_brief_json zodat optimizer dit makkelijk kan groeperen per CPL-prestatie.';
COMMENT ON COLUMN public.ai_campaign_variants.overlay_text IS
  'Letterlijke overlay-string in het beeld (NULL bij overlay_used=false). Voor moderation en audit.';
COMMENT ON COLUMN public.ai_campaign_variants.aspect_ratio IS
  'Image-formaat: 1024x1536 (4:5 mobile-feed, default) of 1024x1024 (1:1 universeel).';
COMMENT ON COLUMN public.ai_campaign_variants.image_regeneration_count IS
  'Hoe vaak deze variant via change-only-X is geregenereerd. Voor audit + rate-limit op OpenAI-spend.';

-- Index zodat we per overlay-keuze de CPL-prestatie snel kunnen
-- aggregeren in de optimizer en het live dashboard.
CREATE INDEX IF NOT EXISTS idx_ai_variants_overlay_used
  ON public.ai_campaign_variants(overlay_used)
  WHERE overlay_used IS NOT NULL;
