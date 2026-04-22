export interface Batch {
  id: string;
  branch: string;
  branch_name?: string;
  batch_size: number;
  leads_delivered: number;
  price_per_lead: number;
  total_price: number;
  leads_per_day: number | null;
  leads_per_week: number | null;
  lead_filters: unknown[];
  status: string;
  compensations?: { amount: number; reason: string }[];
}

export interface Order {
  id: string;
  branch: string;
  batch_size: number;
  price_per_lead: number;
  total_price: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

export interface PricingData {
  branch: string;
  branch_name?: string;
  tiers: { min_leads: number; price_per_lead: number }[];
  min_batch_size: number;
  nationwide_discount: number;
  is_custom: boolean;
}

export interface WelcomeDiscountState {
  active: boolean;
  expiresAt: string | null;
}
