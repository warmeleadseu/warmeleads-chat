-- De Truckfinancier: actieve leads-batch omzetten van financial_lease → truck_lease.
-- Bestaande toewijzingen (2× financial_lease) blijven historisch; nieuwe inbound op truck_lease vult de batch.

DO $$
DECLARE
  v_customer_id uuid := '2ce01196-c11d-46ea-bf36-f96c1745d392';
  v_batch_id uuid := 'b2631abb-f078-4251-a3e2-187828168fee';
  v_meta_ids text[];
  v_sync boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE slug = 'truck_lease' AND is_active = true) THEN
    RAISE EXCEPTION '128: branche truck_lease ontbreekt of is inactief';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.customer_batches
    WHERE id = v_batch_id AND customer_id = v_customer_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION '128: batch % niet gevonden of niet actief', v_batch_id;
  END IF;

  SELECT meta_campaign_ids, meta_campaign_sync_enabled
  INTO v_meta_ids, v_sync
  FROM public.customer_batches
  WHERE id = v_batch_id;

  UPDATE public.customer_batches
  SET
    branch = 'truck_lease',
    notes = trim(COALESCE(notes, '')) || CASE
      WHEN trim(COALESCE(notes, '')) = '' THEN ''
      ELSE E'\n'
    END || '[Migratie 128] Branche gewijzigd: financial_lease → truck_lease (Truck Lease leads).'
  WHERE id = v_batch_id;

  UPDATE public.customers
  SET branches = ARRAY['truck_lease']::text[]
  WHERE id = v_customer_id;

  UPDATE public.batch_orders
  SET branch = 'truck_lease'
  WHERE batch_id = v_batch_id;

  DELETE FROM public.customer_branch_meta_defaults
  WHERE customer_id = v_customer_id AND branch = 'financial_lease';

  INSERT INTO public.customer_branch_meta_defaults (
    customer_id,
    branch,
    meta_campaign_ids,
    meta_campaign_sync_enabled,
    meta_campaign_paused_ids
  ) VALUES (
    v_customer_id,
    'truck_lease',
    COALESCE(v_meta_ids, '{}'::text[]),
    COALESCE(v_sync, true),
    '{}'::text[]
  )
  ON CONFLICT (customer_id, branch) DO UPDATE SET
    meta_campaign_ids = EXCLUDED.meta_campaign_ids,
    meta_campaign_sync_enabled = EXCLUDED.meta_campaign_sync_enabled,
    updated_at = now();

  RAISE NOTICE '128: Truckfinancier batch % → truck_lease', v_batch_id;
END $$;
