import { createServerClient } from '@/lib/supabase';

export type BudgetReserveResult =
  | { ok: true; spent_today_cents: number; spent_month_cents: number; daily_budget_cents: number; monthly_budget_cents: number }
  | { ok: false; reason: string; [key: string]: unknown };

export type OpenAIReserveResult =
  | { ok: true; spent_month_cents: number; cap_cents: number; noop?: boolean }
  | { ok: false; reason: string; [key: string]: unknown };

/**
 * Atomische dag/maand reservering op `ai_campaign_budget_guards` via RPC.
 * Faalt expliciet (ok=false) bij 0-cap of overschrijding.
 */
export async function reserveBranchBudget(
  branch: string,
  amountCents: number,
): Promise<BudgetReserveResult> {
  if (!branch) return { ok: false, reason: 'missing_branch' };
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, reason: 'invalid_amount' };
  }
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('reserve_branch_budget', {
    p_branch: branch,
    p_amount_cents: amountCents,
  });
  if (error) return { ok: false, reason: error.message };
  if (!data || typeof data !== 'object') return { ok: false, reason: 'invalid_rpc_response' };
  return data as BudgetReserveResult;
}

export async function reserveOpenAIBudget(
  branch: string,
  amountCents: number,
): Promise<OpenAIReserveResult> {
  if (!branch) return { ok: false, reason: 'missing_branch' };
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    return { ok: false, reason: 'invalid_amount' };
  }
  if (amountCents === 0) return { ok: true, spent_month_cents: 0, cap_cents: 0, noop: true };
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('reserve_openai_budget', {
    p_branch: branch,
    p_amount_cents: amountCents,
  });
  if (error) return { ok: false, reason: error.message };
  if (!data || typeof data !== 'object') return { ok: false, reason: 'invalid_rpc_response' };
  return data as OpenAIReserveResult;
}

export interface BudgetGuardRow {
  branch: string;
  daily_budget_cents: number;
  monthly_budget_cents: number;
  spent_today_cents: number;
  spent_month_cents: number;
  openai_monthly_cap_cents: number;
  openai_spent_month_cents: number;
  updated_at: string;
}

export async function listBudgetGuards(): Promise<BudgetGuardRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('ai_campaign_budget_guards')
    .select('branch, daily_budget_cents, monthly_budget_cents, spent_today_cents, spent_month_cents, openai_monthly_cap_cents, openai_spent_month_cents, updated_at')
    .order('branch');
  if (error) throw new Error(error.message);
  return (data || []) as BudgetGuardRow[];
}

export async function updateBudgetGuard(
  branch: string,
  patch: Partial<Pick<BudgetGuardRow, 'daily_budget_cents' | 'monthly_budget_cents' | 'openai_monthly_cap_cents'>>,
): Promise<BudgetGuardRow> {
  const supabase = createServerClient();
  const update: Record<string, number> = {};
  if (typeof patch.daily_budget_cents === 'number') update.daily_budget_cents = Math.max(0, patch.daily_budget_cents);
  if (typeof patch.monthly_budget_cents === 'number') update.monthly_budget_cents = Math.max(0, patch.monthly_budget_cents);
  if (typeof patch.openai_monthly_cap_cents === 'number') update.openai_monthly_cap_cents = Math.max(0, patch.openai_monthly_cap_cents);
  const { data, error } = await supabase
    .from('ai_campaign_budget_guards')
    .update(update)
    .eq('branch', branch)
    .select('branch, daily_budget_cents, monthly_budget_cents, spent_today_cents, spent_month_cents, openai_monthly_cap_cents, openai_spent_month_cents, updated_at')
    .single();
  if (error || !data) throw new Error(error?.message || 'Update mislukt');
  return data as BudgetGuardRow;
}

/**
 * Master kill-switch via `app_settings.key='ai_campaigns_enabled'`. Default = false.
 */
export async function isAiCampaignsEnabled(): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'ai_campaigns_enabled')
    .maybeSingle();
  if (!data) return false;
  return String(data.value).toLowerCase() === 'true';
}

export async function setAiCampaignsEnabled(enabled: boolean): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from('app_settings')
    .upsert({ key: 'ai_campaigns_enabled', value: enabled ? 'true' : 'false' }, { onConflict: 'key' });
}
