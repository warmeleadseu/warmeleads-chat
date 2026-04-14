-- Track which orders had welcome discount applied, so the webhook can mark
-- the customer's welcome_offer_used only after successful payment.
ALTER TABLE batch_orders
  ADD COLUMN IF NOT EXISTS welcome_discount_applied boolean DEFAULT false;
