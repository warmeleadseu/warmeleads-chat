-- 135 — Strict branche-slugs in prospects.branches & customers.branches
--
-- Aanleiding: Excel-imports brachten in prospects.branches ongeldige
-- waarden zoals 'beide', 'anders', 'airco leads', 'airconditioning' en
-- 'kozijnen / glas'. Die zijn nooit gevalideerd tegen de branches-tabel
-- omdat de oude `parseBranches` in /api/admin/prospects/import alleen
-- splitste en lowercased — geen FK-check. Symptoom: het promoten-naar-
-- klant-dialoog gaf "Onbekende branche(s): beide" omdat de prospect die
-- string stiekem in zijn branches-array meedroeg.
--
-- Deze migratie doet 2 dingen:
--   1) Eenmalige cleanup: pas alias-mapping toe op alle bestaande
--      prospects.branches (zelfde regels als src/lib/branchSlugs.ts).
--   2) Strict trigger: voor zowel prospects als customers wordt elke
--      INSERT/UPDATE op de `branches`-kolom gefilterd op alleen actieve
--      branche-slugs. Ongeldige slugs worden silent gedropt + via
--      RAISE NOTICE gelogd. Een DEFENSE-IN-DEPTH vangnet: zelfs als ooit
--      een Zapier-job, script of externe SQL ongeldige slugs probeert
--      te schrijven, wordt het automatisch opgeschoond.

------------------------------------------------------------------------
-- STAP 1: eenmalige cleanup van bestaande prospects.branches
------------------------------------------------------------------------

-- Werkt rij-voor-rij via een functie: pak elke prospect met >=1 ongeldige
-- slug, normaliseer/alias-map de strings, en schrijf het resultaat terug.
-- We slaan voor- en na-arrays op in `migration_log` zodat we kunnen
-- nakijken wat er gebeurd is.

CREATE TABLE IF NOT EXISTS public.migration_log (
  id bigserial PRIMARY KEY,
  migration text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);

DO $$
DECLARE
  valid_slugs text[];
  rec record;
  raw_slug text;
  canonical text;
  new_slugs text[];
  dropped_slugs text[];
  alias_target text[];
  total_cleaned int := 0;
BEGIN
  SELECT array_agg(slug ORDER BY slug)
    INTO valid_slugs
    FROM public.branches
    WHERE is_active = true;

  IF valid_slugs IS NULL THEN
    RAISE NOTICE 'Geen actieve branches gevonden — cleanup overgeslagen.';
    RETURN;
  END IF;

  FOR rec IN
    SELECT id, company_name, branches
    FROM public.prospects
    WHERE branches IS NOT NULL
      AND array_length(branches, 1) IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM unnest(branches) AS s(slug)
        WHERE s.slug <> ALL (valid_slugs)
      )
  LOOP
    new_slugs := ARRAY[]::text[];
    dropped_slugs := ARRAY[]::text[];

    FOREACH raw_slug IN ARRAY rec.branches
    LOOP
      -- canonicaliseer: lowercase + trim + strip ' leads'/' lead' suffix
      canonical := lower(trim(coalesce(raw_slug, '')));
      canonical := regexp_replace(canonical, '\s+(leads?|prospects?|aanvragen|aanvraag)\s*$', '', 'i');
      canonical := trim(canonical);

      -- splits ook op composities die we historisch gebruikt hebben
      -- (kozijnen / glas, airco & warmtepomp, etc.)
      IF canonical = ANY (valid_slugs) THEN
        new_slugs := array_append(new_slugs, canonical);
        CONTINUE;
      END IF;

      alias_target := CASE canonical
        WHEN 'airconditioning' THEN ARRAY['airco']
        WHEN 'klimaattechniek' THEN ARRAY['airco']
        WHEN 'klimaat' THEN ARRAY['airco']
        WHEN 'warmtepompen' THEN ARRAY['warmtepomp']
        WHEN 'zonnepaneel' THEN ARRAY['zonnepanelen']
        WHEN 'solar' THEN ARRAY['zonnepanelen']
        WHEN 'pv' THEN ARRAY['zonnepanelen']
        WHEN 'batterij' THEN ARRAY['thuisbatterij']
        WHEN 'thuisbatterijen' THEN ARRAY['thuisbatterij']
        WHEN 'kozijnen / glas' THEN ARRAY['kozijnen', 'glas']
        WHEN 'kozijnen/glas' THEN ARRAY['kozijnen', 'glas']
        WHEN 'glas / kozijnen' THEN ARRAY['glas', 'kozijnen']
        WHEN 'beide' THEN ARRAY[]::text[]
        WHEN 'anders' THEN ARRAY[]::text[]
        WHEN 'overig' THEN ARRAY[]::text[]
        WHEN 'overige' THEN ARRAY[]::text[]
        WHEN 'onbekend' THEN ARRAY[]::text[]
        WHEN 'divers' THEN ARRAY[]::text[]
        ELSE NULL
      END;

      IF alias_target IS NULL THEN
        -- onbekend → silent drop
        dropped_slugs := array_append(dropped_slugs, raw_slug);
      ELSIF array_length(alias_target, 1) IS NULL THEN
        -- ambigu → drop + rapporteer
        dropped_slugs := array_append(dropped_slugs, raw_slug);
      ELSE
        FOR i IN 1 .. array_length(alias_target, 1) LOOP
          IF alias_target[i] = ANY (valid_slugs) THEN
            new_slugs := array_append(new_slugs, alias_target[i]);
          ELSE
            dropped_slugs := array_append(dropped_slugs, raw_slug);
          END IF;
        END LOOP;
      END IF;
    END LOOP;

    -- dedupliceer
    SELECT array_agg(DISTINCT s ORDER BY s)
      INTO new_slugs
      FROM unnest(new_slugs) AS s;

    IF new_slugs IS NULL THEN
      new_slugs := ARRAY[]::text[];
    END IF;

    UPDATE public.prospects
      SET branches = CASE WHEN array_length(new_slugs, 1) IS NULL THEN NULL ELSE new_slugs END
      WHERE id = rec.id;

    INSERT INTO public.migration_log (migration, payload)
    VALUES (
      '135_strict_branch_slugs',
      jsonb_build_object(
        'prospect_id', rec.id,
        'company_name', rec.company_name,
        'before', to_jsonb(rec.branches),
        'after', to_jsonb(new_slugs),
        'dropped', to_jsonb(dropped_slugs)
      )
    );

    total_cleaned := total_cleaned + 1;
  END LOOP;

  RAISE NOTICE '135: cleanup voltooid voor % prospects', total_cleaned;
END $$;

------------------------------------------------------------------------
-- STAP 2: defensieve trigger op prospects.branches en customers.branches
--
-- Filtert silent ongeldige slugs eruit zodat zelfs een buggy script of
-- directe SQL nooit meer 'beide' o.i.d. in de array kan zetten. App-laag
-- (src/lib/branchSlugs.ts) doet dit ook al; deze trigger is de DB-laag
-- vangnet.
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.filter_invalid_branch_slugs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  filtered text[];
  dropped text[];
BEGIN
  IF NEW.branches IS NULL OR array_length(NEW.branches, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Splits input in geldige (= in branches.slug) en ongeldige slugs.
  SELECT
    array_agg(s ORDER BY s) FILTER (WHERE EXISTS (SELECT 1 FROM public.branches b WHERE b.slug = s)),
    array_agg(s ORDER BY s) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.slug = s))
    INTO filtered, dropped
  FROM (
    SELECT DISTINCT s
    FROM unnest(NEW.branches) AS s
    WHERE s IS NOT NULL AND s <> ''
  ) AS x;

  IF dropped IS NOT NULL AND array_length(dropped, 1) IS NOT NULL THEN
    RAISE NOTICE '[branch-slug-trigger] % rij %, ongeldige slugs gestript: %',
      TG_TABLE_NAME, NEW.id, dropped;
  END IF;

  NEW.branches := CASE
    WHEN filtered IS NULL OR array_length(filtered, 1) IS NULL THEN NULL
    ELSE filtered
  END;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.filter_invalid_branch_slugs() IS
  'BEFORE INSERT/UPDATE-trigger: filtert silent ongeldige branche-slugs '
  'uit branches[]-kolom. Vangnet voor app-laag validatie in '
  'src/lib/branchSlugs.ts. Aangemaakt in migratie 135.';

DROP TRIGGER IF EXISTS prospects_filter_branch_slugs ON public.prospects;
CREATE TRIGGER prospects_filter_branch_slugs
  BEFORE INSERT OR UPDATE OF branches ON public.prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.filter_invalid_branch_slugs();

DROP TRIGGER IF EXISTS customers_filter_branch_slugs ON public.customers;
CREATE TRIGGER customers_filter_branch_slugs
  BEFORE INSERT OR UPDATE OF branches ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.filter_invalid_branch_slugs();
