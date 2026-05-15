-- TRD: de vervolg-elektricienbatch na migratie 108 (proportioneel ~€590) is operationeel voor
-- distributie, maar geen aparte AM-leaderboard-verkoop naast de €1.000 onderzoeksbatch.

INSERT INTO public.am_leaderboard_batch_exclusions (year_month, customer_batch_id, reason)
SELECT
  to_char(cb.created_at AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM'),
  cb.id,
  'Migratie 110: vervolgbatch na omzetting naar onderzoeksbatch (€1000); telt niet mee als extra leaderboard-omzet.'
FROM public.customer_batches cb
WHERE cb.notes LIKE '%Automatisch (migratie 108): resterende elektricien-leads%'
  AND cb.batch_kind = 'leads'
  AND cb.branch = 'elektricien'
ON CONFLICT (customer_batch_id, year_month) DO NOTHING;
