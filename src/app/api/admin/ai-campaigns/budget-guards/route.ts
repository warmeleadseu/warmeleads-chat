import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/adminAuth';
import {
  listBudgetGuards,
  updateBudgetGuard,
  isAiCampaignsEnabled,
  setAiCampaignsEnabled,
} from '@/lib/aiCampaignBudget';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;
  const guards = await listBudgetGuards();
  const enabled = await isAiCampaignsEnabled();
  return NextResponse.json({ guards, master_enabled: enabled });
}

const PatchSchema = z.object({
  branch: z.string().min(1),
  daily_budget_cents: z.number().int().min(0).optional(),
  monthly_budget_cents: z.number().int().min(0).optional(),
  openai_monthly_cap_cents: z.number().int().min(0).optional(),
});

export async function PUT(request: NextRequest) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;
  const parse = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: 'Ongeldige input', details: parse.error.issues }, { status: 400 });
  const { branch, ...patch } = parse.data;
  const row = await updateBudgetGuard(branch, patch);
  return NextResponse.json({ ok: true, guard: row });
}

const MasterSchema = z.object({ enabled: z.boolean() });

export async function POST(request: NextRequest) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;
  const parse = MasterSchema.safeParse(await request.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: 'Ongeldige input', details: parse.error.issues }, { status: 400 });
  await setAiCampaignsEnabled(parse.data.enabled);
  return NextResponse.json({ ok: true, master_enabled: parse.data.enabled });
}
