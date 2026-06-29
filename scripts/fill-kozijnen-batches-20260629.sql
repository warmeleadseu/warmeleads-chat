-- Eenmalige operationele vulling (29 jun 2026)
-- Wijs niet-toegewezen kozijnleads toe aan de twee actieve kozijnenbatches,
-- binnen hun targetgebieden. Leads zijn gedeeld (max 3 klanten), dus
-- overlappende Groningen-leads gaan naar beide.
--
--   Kozijnadvies Nederland  klant 720bb4de  batch 7db51507  provincies NL:DR/FL/GR/OV/GE  17 vrij
--   Bouwbedrijf Constantin  klant 8a1eb0a9  batch 7ea64482  radius 35km (53.164, 6.797)    11 vrij
--
-- Verdeling (dekt alle 18 leads): Kozijnadvies = 17 nieuwste passende leads
-- (oudste, Chris Koerts, valt af), Constantin = 11 oudste binnen radius
-- (incl. Chris Koerts). Dag/week-limieten bewust genegeerd (retroactieve
-- vulling). is_assigned/assigned_customer_ids worden via trigger bijgewerkt;
-- leads_delivered zetten we hierna gelijk aan de werkelijke telling.
BEGIN;

WITH cand AS (
  SELECT l.id, l.provincie, l.land, l.postcode, l.lat, l.lng, l.created_at,
    (lower(trim(coalesce(l.provincie,''))) IN ('drenthe','flevoland','groningen','overijssel','gelderland')
      AND (upper(coalesce(l.land,''))='NL' OR l.postcode ~ '^[0-9]{4}\s?[A-Za-z]{2}$')) AS koz,
    (l.lat IS NOT NULL AND l.lng IS NOT NULL AND
      (6371*acos(greatest(-1,least(1,
        cos(radians(53.16410231))*cos(radians(l.lat))*cos(radians(l.lng)-radians(6.79656886))
        + sin(radians(53.16410231))*sin(radians(l.lat)) )))) <= 35) AS con,
    CASE WHEN l.lat IS NOT NULL AND l.lng IS NOT NULL THEN
      round((6371*acos(greatest(-1,least(1,
        cos(radians(53.16410231))*cos(radians(l.lat))*cos(radians(l.lng)-radians(6.79656886))
        + sin(radians(53.16410231))*sin(radians(l.lat)) ))))::numeric,1) END AS dist
  FROM leads l
  WHERE l.branch='kozijnen'
    AND coalesce(l.bron,'') NOT IN ('excel_import','demo')
    AND (l.phone_valid IS DISTINCT FROM false)
    AND NOT EXISTS (SELECT 1 FROM lead_assignments la WHERE la.lead_id=l.id)
),
koz_pick AS (
  SELECT id FROM cand WHERE koz ORDER BY created_at DESC, id LIMIT 17
),
con_pick AS (
  SELECT id, dist FROM cand WHERE con ORDER BY created_at ASC, id LIMIT 11
),
ins_koz AS (
  INSERT INTO lead_assignments (lead_id, customer_id, batch_id, distance_km, source)
  SELECT id, '720bb4de-4af4-4a2b-8ff0-59c2ccaefcef', '7db51507-fcf5-49bc-9a89-39266cb8ff50', 0, 'distribution'
  FROM koz_pick
  RETURNING 1
),
ins_con AS (
  INSERT INTO lead_assignments (lead_id, customer_id, batch_id, distance_km, source)
  SELECT id, '8a1eb0a9-f0df-4ad4-acf5-36e380c95017', '7ea64482-045f-40b1-84dc-216c901f19ae', dist, 'distribution'
  FROM con_pick
  RETURNING 1
)
SELECT (SELECT count(*) FROM ins_koz) AS kozijnadvies_inserted,
       (SELECT count(*) FROM ins_con) AS constantin_inserted;

UPDATE customer_batches
SET leads_delivered = (SELECT count(*) FROM lead_assignments WHERE batch_id='7db51507-fcf5-49bc-9a89-39266cb8ff50')
WHERE id='7db51507-fcf5-49bc-9a89-39266cb8ff50';

UPDATE customer_batches
SET leads_delivered = (SELECT count(*) FROM lead_assignments WHERE batch_id='7ea64482-045f-40b1-84dc-216c901f19ae')
WHERE id='7ea64482-045f-40b1-84dc-216c901f19ae';

COMMIT;
