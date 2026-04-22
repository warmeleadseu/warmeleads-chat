-- Read-only audit: demo portal vs. real leads (run in Supabase SQL editor or psql).
-- Safe to run anytime; no writes.

-- 1) demo_mode customers with no valid demo-template assignment
SELECT c.id, c.name, c.email, c.branches, c.demo_mode,
       (SELECT count(*) FROM lead_assignments la
        WHERE la.customer_id = c.id AND la.source = 'demo') AS demo_assignment_rows,
       (SELECT count(*) FROM lead_assignments la
        WHERE la.customer_id = c.id AND la.source = 'demo'
          AND la.lead_id IN (
            SELECT l.id FROM leads l
            WHERE l.bron = 'demo' AND l.customer_id IS NULL
          )) AS valid_demo_links
FROM customers c
WHERE c.demo_mode = true
ORDER BY valid_demo_links ASC, c.name;

-- 2) Orphan demo assignments (should be zero after migration 076 + app repair)
SELECT la.id, la.customer_id, c.name AS customer_name, la.lead_id, la.source
FROM lead_assignments la
JOIN customers c ON c.id = la.customer_id
WHERE la.source = 'demo'
  AND la.lead_id NOT IN (
    SELECT l.id FROM leads l WHERE l.bron = 'demo' AND l.customer_id IS NULL
  )
LIMIT 200;

-- 3) Global demo template pool size (expected > 0)
SELECT count(*) AS demo_template_leads
FROM leads
WHERE bron = 'demo' AND customer_id IS NULL;

-- 4) Sanity: no demo_source assignment should point at a non-demo lead (real data leak check)
SELECT la.id, la.customer_id, la.lead_id, l.bron, l.customer_id AS lead_owner_customer
FROM lead_assignments la
JOIN leads l ON l.id = la.lead_id
WHERE la.source = 'demo'
  AND (l.bron IS DISTINCT FROM 'demo' OR l.customer_id IS NOT NULL)
LIMIT 50;
