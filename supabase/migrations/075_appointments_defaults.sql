-- Demo defaults for appointments feature
-- Seeds default appointment pricing for existing branches so demo customers can order appointments

-- Set default appointment pricing tiers per branch (only if empty)
UPDATE branches
SET
  appointment_pricing_tiers = '[{"min_leads": 5, "price_per_lead": 150}, {"min_leads": 10, "price_per_lead": 135}, {"min_leads": 25, "price_per_lead": 120}, {"min_leads": 50, "price_per_lead": 110}]'::jsonb,
  appointment_min_batch_size = COALESCE(appointment_min_batch_size, 5),
  appointment_nationwide_discount = COALESCE(appointment_nationwide_discount, 10),
  default_appointment_duration = COALESCE(default_appointment_duration, 60),
  default_travel_buffer = COALESCE(default_travel_buffer, 30)
WHERE slug = 'thuisbatterij' AND (appointment_pricing_tiers IS NULL OR appointment_pricing_tiers = '[]'::jsonb);

UPDATE branches
SET
  appointment_pricing_tiers = '[{"min_leads": 5, "price_per_lead": 125}, {"min_leads": 10, "price_per_lead": 115}, {"min_leads": 25, "price_per_lead": 100}, {"min_leads": 50, "price_per_lead": 90}]'::jsonb,
  appointment_min_batch_size = COALESCE(appointment_min_batch_size, 5),
  appointment_nationwide_discount = COALESCE(appointment_nationwide_discount, 10),
  default_appointment_duration = COALESCE(default_appointment_duration, 60),
  default_travel_buffer = COALESCE(default_travel_buffer, 30)
WHERE slug = 'zonnepanelen' AND (appointment_pricing_tiers IS NULL OR appointment_pricing_tiers = '[]'::jsonb);

UPDATE branches
SET
  appointment_pricing_tiers = '[{"min_leads": 5, "price_per_lead": 165}, {"min_leads": 10, "price_per_lead": 150}, {"min_leads": 25, "price_per_lead": 135}, {"min_leads": 50, "price_per_lead": 125}]'::jsonb,
  appointment_min_batch_size = COALESCE(appointment_min_batch_size, 5),
  appointment_nationwide_discount = COALESCE(appointment_nationwide_discount, 10),
  default_appointment_duration = COALESCE(default_appointment_duration, 75),
  default_travel_buffer = COALESCE(default_travel_buffer, 30)
WHERE slug = 'warmtepomp' AND (appointment_pricing_tiers IS NULL OR appointment_pricing_tiers = '[]'::jsonb);

UPDATE branches
SET
  appointment_pricing_tiers = '[{"min_leads": 5, "price_per_lead": 135}, {"min_leads": 10, "price_per_lead": 120}, {"min_leads": 25, "price_per_lead": 105}, {"min_leads": 50, "price_per_lead": 95}]'::jsonb,
  appointment_min_batch_size = COALESCE(appointment_min_batch_size, 5),
  appointment_nationwide_discount = COALESCE(appointment_nationwide_discount, 10),
  default_appointment_duration = COALESCE(default_appointment_duration, 60),
  default_travel_buffer = COALESCE(default_travel_buffer, 30)
WHERE slug = 'airco' AND (appointment_pricing_tiers IS NULL OR appointment_pricing_tiers = '[]'::jsonb);

UPDATE branches
SET
  appointment_pricing_tiers = '[{"min_leads": 5, "price_per_lead": 195}, {"min_leads": 10, "price_per_lead": 175}, {"min_leads": 25, "price_per_lead": 155}, {"min_leads": 50, "price_per_lead": 140}]'::jsonb,
  appointment_min_batch_size = COALESCE(appointment_min_batch_size, 5),
  appointment_nationwide_discount = COALESCE(appointment_nationwide_discount, 15),
  default_appointment_duration = COALESCE(default_appointment_duration, 90),
  default_travel_buffer = COALESCE(default_travel_buffer, 45)
WHERE slug = 'zakelijke_batterij' AND (appointment_pricing_tiers IS NULL OR appointment_pricing_tiers = '[]'::jsonb);

UPDATE branches
SET
  appointment_pricing_tiers = '[{"min_leads": 5, "price_per_lead": 115}, {"min_leads": 10, "price_per_lead": 100}, {"min_leads": 25, "price_per_lead": 85}, {"min_leads": 50, "price_per_lead": 75}]'::jsonb,
  appointment_min_batch_size = COALESCE(appointment_min_batch_size, 5),
  appointment_nationwide_discount = COALESCE(appointment_nationwide_discount, 10),
  default_appointment_duration = COALESCE(default_appointment_duration, 45),
  default_travel_buffer = COALESCE(default_travel_buffer, 30)
WHERE slug = 'financial_lease' AND (appointment_pricing_tiers IS NULL OR appointment_pricing_tiers = '[]'::jsonb);

-- Fallback: any other branch without pricing gets a generic default
UPDATE branches
SET
  appointment_pricing_tiers = '[{"min_leads": 5, "price_per_lead": 150}, {"min_leads": 10, "price_per_lead": 135}, {"min_leads": 25, "price_per_lead": 120}]'::jsonb,
  appointment_min_batch_size = COALESCE(appointment_min_batch_size, 5),
  appointment_nationwide_discount = COALESCE(appointment_nationwide_discount, 10),
  default_appointment_duration = COALESCE(default_appointment_duration, 60),
  default_travel_buffer = COALESCE(default_travel_buffer, 30)
WHERE appointment_pricing_tiers IS NULL OR appointment_pricing_tiers = '[]'::jsonb;
