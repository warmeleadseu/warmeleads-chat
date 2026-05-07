-- =============================================================================
-- Niche-onderzoek / onderzoeksbatch (€1.000) als apart product in het portaal
-- =============================================================================

-- Branche voor FK op customer_batches.batch (geen standaard lead-branche)
INSERT INTO branches (slug, name, color, description, sort_order, pricing_tiers, min_batch_size, nationwide_discount, is_active)
VALUES (
  'niche_research',
  'Niche-onderzoek',
  'violet',
  'Eenmalig onderzoek en validatie voor een maatwerk-niche buiten onze standaardverticals. Het bedrag wordt 100% gecrediteerd in leads zodra de campagne live gaat.',
  999,
  '[{"min_leads": 1, "price_per_lead": 1000}]'::jsonb,
  1,
  0,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  pricing_tiers = EXCLUDED.pricing_tiers,
  min_batch_size = EXCLUDED.min_batch_size,
  updated_at = now();

ALTER TABLE batch_orders
  ADD COLUMN IF NOT EXISTS batch_kind text NOT NULL DEFAULT 'leads'
    CHECK (batch_kind IN ('leads', 'niche_research'));

ALTER TABLE batch_orders
  ADD COLUMN IF NOT EXISTS niche_title text;

COMMENT ON COLUMN batch_orders.batch_kind IS 'leads = normale lead-batch; niche_research = onderzoeksbatch €1000';
COMMENT ON COLUMN batch_orders.niche_title IS 'Vrije titel van de te onderzoeken niche (alleen bij niche_research)';

ALTER TABLE customer_batches
  ADD COLUMN IF NOT EXISTS batch_kind text NOT NULL DEFAULT 'leads'
    CHECK (batch_kind IN ('leads', 'niche_research'));

ALTER TABLE customer_batches
  ADD COLUMN IF NOT EXISTS niche_title text;

COMMENT ON COLUMN customer_batches.batch_kind IS 'leads = normale batch; niche_research = onderzoeksbatch (geen lead-routering op deze branch)';
COMMENT ON COLUMN customer_batches.niche_title IS 'Vrije titel van de niche bij onderzoeksbatch';

-- -----------------------------------------------------------------------------
-- Backfill: TRD Multidiensten + Luigi Pani + celebration (eenmalig)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_cust_id uuid;
  v_am_id uuid;
  v_batch_id uuid;
  v_exists boolean;
BEGIN
  SELECT id INTO v_cust_id
  FROM customers
  WHERE name ILIKE '%TRD%Multidiensten%'
     OR name ILIKE '%TRD Multidiensten%'
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_am_id
  FROM admin_users
  WHERE email ILIKE 'luigi@warmeleads.eu'
     OR name ILIKE '%Luigi%Pani%'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_cust_id IS NULL OR v_am_id IS NULL THEN
    RAISE NOTICE '088 backfill skipped: cust=% am=%', v_cust_id, v_am_id;
    RETURN;
  END IF;

  UPDATE customers
     SET account_manager_id = v_am_id
   WHERE id = v_cust_id
     AND (account_manager_id IS NULL OR account_manager_id <> v_am_id);

  SELECT EXISTS (
    SELECT 1 FROM customer_batches
    WHERE customer_id = v_cust_id
      AND branch = 'niche_research'
      AND batch_kind = 'niche_research'
      AND niche_title = 'Electricien gezocht?'
  ) INTO v_exists;

  IF v_exists THEN
    RAISE NOTICE '088 backfill: onderzoeksbatch TRD bestaat al';
    RETURN;
  END IF;

  INSERT INTO customer_batches (
    customer_id,
    branch,
    batch_size,
    price_per_lead,
    total_price,
    leads_delivered,
    status,
    completed_at,
    notes,
    is_paid,
    batch_kind,
    niche_title,
    account_manager_id
  ) VALUES (
    v_cust_id,
    'niche_research',
    1,
    1000,
    1000,
    1,
    'completed',
    now(),
    '[Onderzoeksbatch, portaal] Electricien gezocht? (retroactief gekoppeld aan accountmanager)',
    true,
    'niche_research',
    'Electricien gezocht?',
    v_am_id
  )
  RETURNING id INTO v_batch_id;

  -- Live dashboard: één sale-event (zelfde payload-structuur als Mollie-webhook)
  INSERT INTO celebration_events (event_type, payload)
  SELECT
    'sale',
    jsonb_build_object(
      'customer', c.name,
      'branch', 'niche_research',
      'amount', 1000,
      'amId', am.id,
      'amName', am.name,
      'amAvatarUrl', am.avatar_url,
      'celebrationVideoUrl', am.celebration_video_url,
      'videoStart', am.celebration_video_start,
      'videoEnd', am.celebration_video_end,
      'batchId', v_batch_id::text,
      'nicheTitle', 'Electricien gezocht?'
    )
  FROM customers c
  CROSS JOIN admin_users am
  WHERE c.id = v_cust_id AND am.id = v_am_id;

  RAISE NOTICE '088 backfill: onderzoeksbatch % voor TRD + celebration', v_batch_id;
END $$;
