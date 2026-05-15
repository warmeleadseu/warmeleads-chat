-- TRD Multidiensten: elektricien-batch 6492a210-… omzetten naar onderzoeksbatch €1000 (niche_research).
-- Bestaande lead_assignments blijven op hetzelfde batch_id.
-- Nieuwe actieve leads-batch voor resterende elektricien-capaciteit (zelfde klant/AM) zodat distributie doorloopt.

DO $$
DECLARE
  v_batch_id uuid := '6492a210-fd69-4d76-84db-e279f76aee1d';
  v_customer_id uuid;
  v_am_id uuid;
  v_delivered int;
  v_old_size int;
  v_old_total numeric;
  v_remain int;
  v_new_total numeric;
  v_new_ppl numeric;
  v_new_id uuid;
  v_kind text;
  v_follow_note text;
BEGIN
  SELECT customer_id,
         account_manager_id,
         COALESCE(leads_delivered, 0),
         batch_size,
         COALESCE(total_price, 0),
         batch_kind
  INTO v_customer_id, v_am_id, v_delivered, v_old_size, v_old_total, v_kind
  FROM public.customer_batches
  WHERE id = v_batch_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION '108: batch % niet gevonden', v_batch_id;
  END IF;

  IF v_kind = 'niche_research' THEN
    RAISE NOTICE '108: batch al niche_research, geen actie';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE slug = 'niche_research') THEN
    RAISE EXCEPTION '108: branch niche_research ontbreekt (migratie 088?)';
  END IF;

  UPDATE public.customer_batches
  SET
    batch_kind = 'niche_research',
    branch = 'niche_research',
    total_price = 1000,
    price_per_lead = ROUND(1000::numeric / NULLIF(v_old_size, 1), 2),
    niche_title = 'Elektricien (onderzoeksbudget)',
    notes = trim(COALESCE(notes, '')) || CASE WHEN trim(COALESCE(notes, '')) = '' THEN '' ELSE E'\n' END
      || '[Migratie 108] Omgezet van leads-batch naar onderzoeksbatch €1.000; historische toewijzingen ongewijzigd.',
    meta_campaign_sync_enabled = false,
    meta_sync_last_error = NULL
  WHERE id = v_batch_id;

  v_remain := GREATEST(v_old_size - v_delivered, 0);
  v_follow_note := 'Automatisch (migratie 108): resterende elektricien-leads na omzetting batch ' || v_batch_id::text || ' naar onderzoeksbatch.';

  IF v_remain <= 0 THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customer_batches
    WHERE customer_id = v_customer_id
      AND branch = 'elektricien'
      AND batch_kind = 'leads'
      AND notes = v_follow_note
  ) THEN
    RAISE NOTICE '108: vervolgbatch bestaat al, geen tweede insert';
    RETURN;
  END IF;

  v_new_total := ROUND((v_old_total / v_old_size::numeric) * v_remain, 2);
  v_new_ppl := ROUND(v_new_total / NULLIF(v_remain, 0), 2);

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
    v_customer_id,
    'elektricien',
    'leads',
    v_remain,
    v_new_ppl,
    v_new_total,
    0,
    0,
    'active',
    true,
    v_am_id,
    '[]'::jsonb,
    3,
    v_follow_note,
    true,
    '[]'::jsonb
  )
  RETURNING id INTO v_new_id;

  RAISE NOTICE '108: nieuwe leads-batch % voor % resterende leads (totaal €%)', v_new_id, v_remain, v_new_total;
END $$;
