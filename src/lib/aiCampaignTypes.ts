/**
 * Gedeelde TypeScript-types voor de AI-campagne studio.
 */

export interface AiCampaignBriefRow {
  id: string;
  branch: string;
  status: 'draft' | 'generated' | 'launched' | 'killed' | 'failed';
  target_audience: Record<string, unknown>;
  geographic_targeting: { countries: string[]; regions?: string[] };
  target_cpl_cents: number | null;
  target_cpql_cents: number | null;
  daily_budget_cents: number;
  max_total_budget_cents: number;
  lead_form_id: string;
  page_id: string;
  special_ad_category: 'NONE' | 'CREDIT' | 'EMPLOYMENT' | 'HOUSING' | 'ISSUES_ELECTIONS_POLITICS';
  is_test_mode: boolean;
  image_formats: string[];
  variant_count: number;
  naming_prefix: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiCampaignVariantRow {
  id: string;
  brief_id: string;
  experiment_id: string | null;
  parent_variant_id: string | null;
  lineage_depth: number;
  angle: string | null;
  tone: string | null;
  headline: string;
  primary_text: string;
  description: string | null;
  cta: string;
  image_prompt: string | null;
  image_storage_path: string | null;
  image_url: string | null;
  meta_image_hash: string | null;
  meta_creative_id: string | null;
  meta_ad_id: string | null;
  status: 'draft' | 'live' | 'paused' | 'killed' | 'failed';
  scale_count: number;
  policy_precheck: Record<string, unknown>;
  generation: Record<string, unknown>;
  prompt_used: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiCampaignExperimentRow {
  id: string;
  brief_id: string;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  phase: 'pending' | 'running' | 'paused' | 'killed' | 'completed';
  stop_reason: string | null;
  last_optimizer_tick_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface AiBudgetGuardRow {
  branch: string;
  daily_budget_cents: number;
  monthly_budget_cents: number;
  spent_today_cents: number;
  spent_month_cents: number;
  openai_monthly_cap_cents: number;
  openai_spent_month_cents: number;
  updated_at: string;
}
