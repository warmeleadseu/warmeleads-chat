-- Batch krijgt alleen leads uit zijn eigen gekoppelde Meta-campagnes (12 nov 2026).
-- Aanvulling op "altijd exclusief", dat alleen de andere kant op werkt: dan
-- gaan leads uit de campagne naar niemand anders, maar de batch kreeg nog wel
-- leads uit andere campagnes in zijn regio. Met deze stand ook dat niet meer,
-- en ook geen leads zonder campagne. Standaard uit: niets verandert.
alter table public.customer_batches
  add column if not exists alleen_eigen_campagne boolean not null default false;

comment on column public.customer_batches.alleen_eigen_campagne is
  'Batch krijgt uitsluitend leads uit zijn eigen gekoppelde Meta-campagnes (meta_campaign_ids). Zie src/lib/campagneExclusiviteit.ts.';
