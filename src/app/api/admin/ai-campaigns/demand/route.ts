import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { getAllBranchDemand } from '@/lib/aiCampaignDemand';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;
  const demand = await getAllBranchDemand();
  return NextResponse.json({ demand });
}
