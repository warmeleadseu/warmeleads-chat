/**
 * Gedeelde TypeScript-types voor de AI-campagne studio.
 */

export interface AiCampaignBriefRow {
  id: string;
  branch: string;
  status: 'draft' | 'generated' | 'launched' | 'killed' | 'failed' | 'deleted';
  target_audience: Record<string, unknown>;
  geographic_targeting: { countries: string[]; regions?: string[] };
  target_cpl_cents: number | null;
  /**
   * @deprecated WarmeLeads optimaliseert op CPL per branche, niet op
   * klant-side QualifiedLead. Kolom blijft voor back-compat van bestaande
   * briefs maar wordt nergens meer gevuld of gelezen.
   */
  target_cpql_cents?: number | null;
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
  /** Strategist input (sliders + audience flags). */
  strategy_params?: Record<string, unknown> | null;
  /** Targeting-overrides (countries/regions/age/gender) van de Studio. */
  targeting_spec?: Record<string, unknown> | null;
  /** Volledig battle-plan (campaigns -> adsets -> creative_briefs) van de strategist. */
  strategy_plan?: Record<string, unknown> | null;
  deleted_at?: string | null;
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
  /** Tree-koppeling naar `ai_campaign_meta_adsets.id` (Studio v2). */
  meta_adset_row_id?: string | null;
  creative_style?: string | null;
  framework?: string | null;
  predicted_cpl_cents?: number | null;
  created_at: string;
  updated_at: string;
}

export interface AiCampaignExperimentRow {
  id: string;
  brief_id: string;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  phase: 'pending' | 'running' | 'paused' | 'killed' | 'completed' | 'deleted';
  stop_reason: string | null;
  last_optimizer_tick_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  tree_summary?: Record<string, unknown> | null;
  deleted_at?: string | null;
  created_at: string;
}

export interface AiCampaignMetaCampaignRow {
  id: string;
  experiment_id: string;
  meta_campaign_id: string | null;
  angle: string;
  rationale: string | null;
  daily_budget_cents: number;
  daily_budget_share: number;
  bid_strategy: 'LOWEST_COST_WITHOUT_CAP' | 'COST_CAP' | 'LOWEST_COST_WITH_BID_CAP';
  status: 'pending' | 'active' | 'paused' | 'archived' | 'failed';
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiCampaignMetaAdsetRow {
  id: string;
  meta_campaign_row_id: string;
  meta_adset_id: string | null;
  name: string;
  strategy_type: 'broad' | 'interest' | 'behavior' | 'lookalike' | 'retargeting_excl' | 'advantage';
  targeting_summary: Record<string, unknown>;
  daily_budget_cents: number | null;
  predicted_cpl_cents: number | null;
  status: 'pending' | 'active' | 'paused' | 'archived' | 'failed';
  archived_at: string | null;
  created_at: string;
  updated_at: string;
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
