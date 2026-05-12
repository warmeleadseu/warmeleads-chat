-- Demo portaal: pre-pay klanten (actief portaal, nog geen betaalde batch) krijgen demo_mode=true
-- voor consistentie met tooling en zodat bestaande CRM-portalen dezelfde regel volgen als de app
-- (demo tot eerste betaalde customer_batch).

UPDATE customers c
SET demo_mode = true
WHERE COALESCE(c.portal_active, false) = true
  AND COALESCE(c.is_active, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM customer_batches cb
    WHERE cb.customer_id = c.id
      AND COALESCE(cb.is_paid, false) = true
  );

-- Minstens één betaalde batch: demo_mode uit (bron van waarheid = customer_batches.is_paid).
UPDATE customers c
SET demo_mode = false
WHERE EXISTS (
    SELECT 1
    FROM customer_batches cb
    WHERE cb.customer_id = c.id
      AND COALESCE(cb.is_paid, false) = true
  )
  AND COALESCE(c.demo_mode, false) = true;
