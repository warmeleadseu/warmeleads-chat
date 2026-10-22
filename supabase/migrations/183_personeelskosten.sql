-- Personeelskosten en het resultaat per periode (winstpagina, alleen superadmin).
--
-- Vaste personeelskosten (alle loonkosten plus extra's) per maand, met een
-- ingangsdatum en eventueel een einddatum. Verandert het bedrag, dan komt er
-- een nieuwe regel bij: oude maanden houden hun oude bedrag. Per dag telt het
-- maandbedrag gedeeld door het aantal dagen van die maand.

CREATE TABLE IF NOT EXISTS personeelskosten (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  omschrijving     text NOT NULL DEFAULT 'Personeel',
  bedrag_per_maand numeric(12, 2) NOT NULL CHECK (bedrag_per_maand >= 0),
  ingang           date NOT NULL,
  einde            date,
  aangemaakt_door  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personeelskosten_einde_na_ingang CHECK (einde IS NULL OR einde >= ingang)
);
ALTER TABLE personeelskosten ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE personeelskosten IS
  'Vaste personeelskosten per maand (alle loonkosten plus extra''s), met geldigheid. Voor het resultaat per periode.';

INSERT INTO personeelskosten (omschrijving, bedrag_per_maand, ingang, aangemaakt_door)
SELECT 'Personeel (alle loonkosten en extra''s)', 8500, date '2026-05-01', 'migratie 183'
WHERE NOT EXISTS (SELECT 1 FROM personeelskosten);

-- Geleverde leads per batch per (Nederlandse) dag. Zelfde telling als
-- batch_winst_kosten: geen spiegel- of demotoewijzingen.
CREATE OR REPLACE FUNCTION winst_leveringen_per_dag(p_batch_ids uuid[])
RETURNS TABLE (batch_id uuid, dag date, aantal integer)
LANGUAGE sql
STABLE
AS $$
  SELECT la.batch_id, (la.assigned_at AT TIME ZONE 'Europe/Amsterdam')::date, count(*)::integer
  FROM lead_assignments la
  WHERE la.batch_id = ANY (p_batch_ids)
    AND coalesce(la.source, '') NOT IN ('mirror', 'demo')
  GROUP BY 1, 2;
$$;

-- Advertentie-uitgaven per dag, met dezelfde afbakening als winst_lekkage
-- (vanaf 1 mei 2026, zonder de campagnes van andere bedrijven).
CREATE OR REPLACE FUNCTION winst_advertentie_per_dag(p_van date, p_tot date)
RETURNS TABLE (dag date, uitgaven numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT date, round(sum(spend), 2)
  FROM meta_ad_spend
  WHERE date BETWEEN greatest(p_van, date '2026-05-01') AND p_tot
    AND coalesce(campaign_name, '') !~* '\m(pakketadvies|energie)\M'
  GROUP BY 1;
$$;
