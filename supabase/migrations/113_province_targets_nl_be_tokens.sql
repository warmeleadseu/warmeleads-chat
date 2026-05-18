-- Provincie-targets: unieke tokens NL: / BE: (Limburg NL vs BE scheiden)

UPDATE customer_targets ct
SET provinces = sub.new_provinces
FROM (
  SELECT
    ct.id,
    array_agg(
      CASE
        WHEN prov = 'Limburg (BE)' THEN 'BE:Limburg'
        WHEN prov = 'Limburg (NL)' THEN 'NL:Limburg'
        WHEN prov = 'Limburg' THEN
          CASE WHEN COALESCE(NULLIF(trim(c.country), ''), 'NL') = 'BE' THEN 'BE:Limburg' ELSE 'NL:Limburg' END
        WHEN prov ~ '^(NL|BE):' THEN prov
        WHEN prov IN (
          'Antwerpen', 'Brussels', 'Henegouwen', 'Luik', 'Luxemburg', 'Namen',
          'Oost-Vlaanderen', 'Vlaams-Brabant', 'Waals-Brabant', 'West-Vlaanderen'
        ) THEN 'BE:' || prov
        WHEN prov IN (
          'Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen',
          'Noord-Brabant', 'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland'
        ) THEN 'NL:' || prov
        ELSE prov
      END
      ORDER BY ord
    ) AS new_provinces
  FROM customer_targets ct
  JOIN customers c ON c.id = ct.customer_id
  CROSS JOIN LATERAL unnest(COALESCE(ct.provinces, ARRAY[]::text[])) WITH ORDINALITY AS u(prov, ord)
  WHERE ct.target_type = 'province'
    AND ct.provinces IS NOT NULL
    AND cardinality(ct.provinces) > 0
  GROUP BY ct.id
) sub
WHERE ct.id = sub.id
  AND ct.target_type = 'province';
