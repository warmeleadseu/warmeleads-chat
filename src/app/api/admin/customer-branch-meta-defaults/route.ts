import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { metaDefaultsBranchForBatch } from '@/lib/metaBatchCampaignSync';
import { isNicheResearchBatchKind } from '@/lib/batchKind';
import { coerceCustomerBatchMetaCampaignIds } from '@/lib/metaCampaignIds';

/**
 * Lees de actieve `customer_branch_meta_defaults` voor een klant+branche.
 *
 * Wordt gebruikt door:
 *  - admin/batches: detail-panel om de "Standaard voor nieuwe batches"-checkbox in
 *    de juiste persistente staat te zetten;
 *  - admin/batches: nieuwe-batch-form om de meta-campagne-picker te pre-fillen
 *    zodat de admin ziet welke campagnes automatisch worden gekoppeld.
 *
 * Voor niche-research-batches wordt `lead_branch_slug` als branche-sleutel
 * gebruikt (niet `branch`), conform `metaDefaultsBranchForBatch`.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = request.nextUrl;
  const customerId = url.searchParams.get('customer_id');
  const rawBranch = url.searchParams.get('branch') || '';
  const batchKind = url.searchParams.get('batch_kind');
  const leadBranchSlug = url.searchParams.get('lead_branch_slug');

  if (!customerId || !rawBranch) {
    return NextResponse.json({ error: 'customer_id en branch zijn verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  if (admin.role === 'accountmanager') {
    const { data: cust } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .eq('account_manager_id', admin.id)
      .maybeSingle();
    if (!cust) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
  }

  const branch = metaDefaultsBranchForBatch({
    branch: rawBranch,
    batch_kind: batchKind,
    lead_branch_slug: isNicheResearchBatchKind(batchKind) ? leadBranchSlug : null,
  });

  const { data, error } = await supabase
    .from('customer_branch_meta_defaults')
    .select('meta_campaign_ids, meta_campaign_paused_ids, meta_campaign_sync_enabled, updated_at')
    .eq('customer_id', customerId)
    .eq('branch', branch)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data) {
    return NextResponse.json({
      exists: false,
      branch,
      meta_campaign_ids: [],
      meta_campaign_paused_ids: [],
      meta_campaign_sync_enabled: true,
      updated_at: null,
    });
  }

  return NextResponse.json({
    exists: true,
    branch,
    meta_campaign_ids: coerceCustomerBatchMetaCampaignIds(data.meta_campaign_ids),
    meta_campaign_paused_ids: coerceCustomerBatchMetaCampaignIds(data.meta_campaign_paused_ids),
    meta_campaign_sync_enabled: data.meta_campaign_sync_enabled !== false,
    updated_at: data.updated_at ?? null,
  });
}
