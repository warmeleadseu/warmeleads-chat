-- Repair demo portal: only customers with demo_mode = true, only lead_assignments with source = 'demo'.
-- Does NOT modify rows in `leads` (no impact on real / generated leads).
-- Does NOT delete or update lead_assignments where source IS DISTINCT FROM 'demo'.
--
-- Targets accounts that have no valid demo-template assignment, or still have orphaned demo
-- assignments (lead_id no longer in the global demo pool). Other demo customers are unchanged.

CREATE TEMP TABLE _demo_portal_repair_customers ON COMMIT DROP AS
SELECT c.id
FROM customers c
WHERE c.demo_mode = true
  AND (
    NOT EXISTS (
      SELECT 1
      FROM lead_assignments la
      WHERE la.customer_id = c.id
        AND la.source = 'demo'
        AND la.lead_id IN (
          SELECT l.id
          FROM leads l
          WHERE l.bron = 'demo'
            AND l.customer_id IS NULL
        )
    )
    OR EXISTS (
      SELECT 1
      FROM lead_assignments la
      WHERE la.customer_id = c.id
        AND la.source = 'demo'
        AND la.lead_id NOT IN (
          SELECT l.id
          FROM leads l
          WHERE l.bron = 'demo'
            AND l.customer_id IS NULL
        )
    )
  );

DELETE FROM lead_assignments la
WHERE la.source = 'demo'
  AND la.customer_id IN (SELECT id FROM _demo_portal_repair_customers);

INSERT INTO lead_assignments (lead_id, customer_id, batch_id, distance_km, source, status, notities)
SELECT
  l.id,
  c.id,
  NULL,
  round((3 + random() * 22)::numeric, 1),
  'demo',
  CASE (l.rn - 1) % 4
    WHEN 0 THEN 'nieuw'
    WHEN 1 THEN 'nieuw'
    WHEN 2 THEN 'gecontacteerd'
    ELSE 'offerte'
  END,
  CASE (l.rn - 1) % 4
    WHEN 2 THEN 'Terugbellen na 17:00'
    WHEN 3 THEN 'Interesse in 10kWh systeem'
    ELSE NULL
  END
FROM customers c
INNER JOIN _demo_portal_repair_customers r ON r.id = c.id
CROSS JOIN LATERAL (
  SELECT
    CASE
      WHEN c.branches IS NOT NULL
        AND cardinality(c.branches) > 0
        AND EXISTS (
          SELECT 1
          FROM unnest(c.branches) elem
          WHERE EXISTS (
            SELECT 1
            FROM leads l0
            WHERE l0.bron = 'demo'
              AND l0.customer_id IS NULL
              AND l0.branch = elem
          )
        )
      THEN ARRAY(
        SELECT DISTINCT elem
        FROM unnest(c.branches) elem
        WHERE EXISTS (
          SELECT 1
          FROM leads l0
          WHERE l0.bron = 'demo'
            AND l0.customer_id IS NULL
            AND l0.branch = elem
        )
      )
      ELSE COALESCE(
        ARRAY(
          SELECT DISTINCT l1.branch
          FROM leads l1
          WHERE l1.bron = 'demo'
            AND l1.customer_id IS NULL
            AND l1.branch IS NOT NULL
        ),
        ARRAY[]::text[]
      )
    END AS branch_filter
) bf
INNER JOIN LATERAL (
  SELECT
    l2.id,
    row_number() OVER (ORDER BY l2.id) AS rn
  FROM leads l2
  WHERE l2.bron = 'demo'
    AND l2.customer_id IS NULL
    AND l2.branch = ANY (bf.branch_filter)
) l ON cardinality(bf.branch_filter) > 0;
