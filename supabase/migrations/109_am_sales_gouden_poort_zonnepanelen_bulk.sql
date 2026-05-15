-- Bart-Willem: zonnepanelen bulk 417 leads @ €1.251 ex btw → customer_batches (bulk_leads) + AM op batch voor leaderboard/targets.
-- Luigi Pani: onderzoeksbatch €1.000 voor De Gouden Poort BV, betaald, status paused (nog niet actief).

DO $$
DECLARE
  v_bart uuid;
  v_luigi uuid;
  v_gouden uuid;
  v_bulk_customer uuid;
  v_ppl numeric;
  v_temp_customer_name text := '[Migratie 109] Zonnepanelen bulk - klantnaam aanvullen';
BEGIN
  SELECT id
  INTO v_bart
  FROM public.admin_users
  WHERE is_active = true
    AND (is_account_manager = true OR role = 'accountmanager')
    AND (
      name ILIKE '%Bart%Willem%'
      OR name ILIKE '%Bart-Willem%'
      OR email ILIKE 'bart%'
    )
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_bart IS NULL THEN
    RAISE EXCEPTION '109: admin_user voor Bart-Willem niet gevonden (is_account_manager / naam / e-mail)';
  END IF;

  SELECT id
  INTO v_luigi
  FROM public.admin_users
  WHERE is_active = true
    AND (is_account_manager = true OR role = 'accountmanager')
    AND (
      name ILIKE '%Luigi%Pani%'
      OR email ILIKE 'luigi@warmeleads.eu'
      OR email ILIKE 'luigi%'
    )
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_luigi IS NULL THEN
    RAISE EXCEPTION '109: admin_user voor Luigi Pani niet gevonden';
  END IF;

  -- ── De Gouden Poort BV + onderzoeksbatch ─────────────────────────────
  IF EXISTS (
    SELECT 1
    FROM public.customer_batches
    WHERE notes LIKE '%[Migratie 109] De Gouden Poort BV — onderzoeksbatch%'
  ) THEN
    RAISE NOTICE '109: onderzoeksbatch Gouden Poort (migratie 109) bestaat al';
  ELSE
    SELECT id
    INTO v_gouden
    FROM public.customers
    WHERE lower(regexp_replace(trim(name), '\s+', ' ', 'g')) IN (
      lower('De Gouden Poort BV'),
      lower('De Gouden Poort B.V.'),
      lower('Gouden Poort BV')
    )
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_gouden IS NULL THEN
      INSERT INTO public.customers (name, account_manager_id, branches, notes)
      VALUES (
        'De Gouden Poort BV',
        v_luigi,
        '{}'::text[],
        '[Migratie 109] Aangemaakt i.v.m. betaalde onderzoeksbatch (Luigi Pani).'
      )
      RETURNING id INTO v_gouden;
    ELSE
      UPDATE public.customers
      SET account_manager_id = v_luigi
      WHERE id = v_gouden
        AND (account_manager_id IS DISTINCT FROM v_luigi);
    END IF;

    INSERT INTO public.customer_batches (
      customer_id,
      branch,
      batch_kind,
      batch_size,
      price_per_lead,
      total_price,
      leads_delivered,
      leads_delivered_external,
      status,
      is_paid,
      account_manager_id,
      lead_filters,
      lookback_days,
      notes,
      niche_title,
      meta_campaign_sync_enabled,
      compensations
    ) VALUES (
      v_gouden,
      'niche_research',
      'niche_research',
      1,
      1000,
      1000,
      0,
      0,
      'paused',
      true,
      v_luigi,
      '[]'::jsonb,
      0,
      '[Migratie 109] De Gouden Poort BV — onderzoeksbatch verkocht door Luigi Pani; €1.000 betaald; status paused (nog niet actief).',
      'De Gouden Poort — onderzoek',
      false,
      '[]'::jsonb
    );

    RAISE NOTICE '109: onderzoeksbatch voor De Gouden Poort BV aangemaakt (klant %, AM Luigi)', v_gouden;
  END IF;

  -- ── Zonnepanelen bulk (Bart-Willem) ───────────────────────────────────
  IF EXISTS (
    SELECT 1
    FROM public.customer_batches
    WHERE notes LIKE '%[Migratie 109] Bart-Willem — zonnepanelen bulk 417%'
  ) THEN
    RAISE NOTICE '109: zonnepanelen bulk-batch (migratie 109) bestaat al';
    RETURN;
  END IF;

  SELECT c.id
  INTO v_bulk_customer
  FROM public.customers c
  WHERE c.account_manager_id = v_bart
    AND c.branches IS NOT NULL
    AND 'zonnepanelen' = ANY (c.branches)
  ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
  LIMIT 1;

  IF v_bulk_customer IS NULL THEN
    INSERT INTO public.customers (name, account_manager_id, branches, notes)
    VALUES (
      v_temp_customer_name,
      v_bart,
      ARRAY['zonnepanelen']::text[],
      '[Migratie 109] Placeholder: geen bestaande zonnepanelen-klant bij Bart-Willem; hernoem naar echte klant in admin.'
    )
    RETURNING id INTO v_bulk_customer;
  END IF;

  v_ppl := ROUND((1251::numeric / 417::numeric), 2);

  INSERT INTO public.customer_batches (
    customer_id,
    branch,
    batch_kind,
    batch_size,
    price_per_lead,
    total_price,
    leads_delivered,
    leads_delivered_external,
    status,
    is_paid,
    account_manager_id,
    lead_filters,
    lookback_days,
    notes,
    meta_campaign_sync_enabled,
    compensations
  ) VALUES (
    v_bulk_customer,
    'zonnepanelen',
    'bulk_leads',
    417,
    v_ppl,
    1251,
    0,
    0,
    'active',
    true,
    v_bart,
    '[]'::jsonb,
    3,
    '[Migratie 109] Bart-Willem — zonnepanelen bulk 417 leads, €1.251 ex btw.',
    false,
    '[]'::jsonb
  );

  RAISE NOTICE '109: zonnepanelen bulk-batch aangemaakt voor klant % (AM Bart-Willem)', v_bulk_customer;
END $$;
