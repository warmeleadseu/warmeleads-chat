/**
 * Meta/Facebook Leads Webhook Endpoint
 * Receives leads from Meta ads and processes them through the qualifying pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { MetaLeadQualifier, type MetaLeadData, type CampaignConfig } from '@/lib/metaLeadQualifier';
import { BatchManager } from '@/lib/batchManager';

// Meta App verification token (should match what's set in Meta)
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'warmeleads_verify_token';

export async function GET(request: NextRequest) {
  // Meta webhook verification
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Meta webhook verified successfully');
    return new Response(challenge, { status: 200 });
  }

  console.error('❌ Meta webhook verification failed');
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    console.log('📨 Received Meta webhook');

    // 1. Verify webhook signature (if enabled)
    const signature = request.headers.get('x-hub-signature-256');
    const body = await request.text();

    // TODO: Implement signature verification for production
    // const isValidSignature = verifySignature(body, signature);
    // if (!isValidSignature) {
    //   console.error('❌ Invalid webhook signature');
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    // }

    // 2. Parse webhook payload
    const payload = JSON.parse(body);
    console.log(`📦 Processing ${payload.entry?.length || 0} entries`);

    // 3. Process each lead
    const results = [];

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'leadgen') {
          const leadData = change.value;
          const result = await processMetaLead(leadData);
          results.push(result);
        }
      }
    }

    console.log(`✅ Processed ${results.length} leads`);
    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('❌ Meta webhook error:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Process a single Meta lead
 */
async function processMetaLead(metaLeadData: any): Promise<{
  leadId: string;
  status: 'qualified' | 'rejected';
  reason?: string;
  batchCompleted?: boolean;
}> {
  const supabase = createServerClient();

  try {
    console.log(`🎯 Processing Meta lead ${metaLeadData.id} from campaign ${metaLeadData.campaign_id}`);

    // 1. Log incoming lead in processing table
    const processingLogId = await logLeadProcessing(metaLeadData, 'received');

    // 2. Find matching campaign
    const campaign = await getCampaignByMetaId(metaLeadData.campaign_id);

    if (!campaign) {
      await updateProcessingLog(processingLogId, {
        processing_status: 'rejected',
        rejection_reason: 'Campaign not found'
      });
      return { leadId: metaLeadData.id, status: 'rejected', reason: 'Campaign not found' };
    }

    // 3. Qualify the lead
    const qualifyingResult = await MetaLeadQualifier.qualifyLead(metaLeadData, campaign);

    console.log(`🔍 Lead qualification result:`, {
      qualified: qualifyingResult.isQualified,
      score: qualifyingResult.score,
      reasons: qualifyingResult.reasons
    });

    // 4. Update processing log with qualification results
    await updateProcessingLog(processingLogId, {
      customer_email: campaign.customerEmail,
      branch_match: qualifyingResult.branchMatch,
      territory_match: qualifyingResult.territoryMatch,
      batch_capacity_available: qualifyingResult.batchCapacity,
      qualification_score: qualifyingResult.score,
      lead_postcode: metaLeadData.field_data?.find((f: any) => f.name.toLowerCase().includes('postcode'))?.values[0],
      lead_lat: qualifyingResult.coordinates?.lat,
      lead_lng: qualifyingResult.coordinates?.lng,
      distance_to_center_km: qualifyingResult.territoryDistance,
      processed_lead_data: MetaLeadQualifier.metaLeadToLeadFormat(metaLeadData, qualifyingResult, campaign)
    });

    // 5. Process qualified leads
    if (qualifyingResult.isQualified) {
      const distributionResult = await BatchManager.processQualifiedLead(
        metaLeadData.id,
        campaign.id,
        MetaLeadQualifier.metaLeadToLeadFormat(metaLeadData, qualifyingResult, campaign)
      );

      if (distributionResult.success) {
        await updateProcessingLog(processingLogId, {
          processing_status: 'distributed',
          created_lead_id: distributionResult.leadId,
          distributed_at: new Date().toISOString()
        });

        return {
          leadId: metaLeadData.id,
          status: 'qualified',
          batchCompleted: distributionResult.batchCompleted
        };
      } else {
        await updateProcessingLog(processingLogId, {
          processing_status: 'rejected',
          rejection_reason: `Distribution failed: ${distributionResult.error}`,
          error_message: distributionResult.error
        });

        return {
          leadId: metaLeadData.id,
          status: 'rejected',
          reason: distributionResult.error
        };
      }
    } else {
      // Lead rejected during qualification
      const rejectionReason = getRejectionReason(qualifyingResult);
      await updateProcessingLog(processingLogId, {
        processing_status: 'rejected',
        rejection_reason: rejectionReason,
        rejected_at: new Date().toISOString()
      });

      return {
        leadId: metaLeadData.id,
        status: 'rejected',
        reason: rejectionReason
      };
    }

  } catch (error) {
    console.error(`❌ Error processing lead ${metaLeadData.id}:`, error);

    // Update processing log with error
    if (metaLeadData.id) {
      try {
        const processingLogId = await logLeadProcessing(metaLeadData, 'received');
        await updateProcessingLog(processingLogId, {
          processing_status: 'rejected',
          rejection_reason: 'Processing error',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (logError) {
        console.error('Failed to log processing error:', logError);
      }
    }

    return {
      leadId: metaLeadData.id,
      status: 'rejected',
      reason: error instanceof Error ? error.message : 'Processing error'
    };
  }
}

/**
 * Get campaign configuration by Meta campaign ID
 */
async function getCampaignByMetaId(metaCampaignId: string): Promise<CampaignConfig | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('customer_meta_campaigns')
    .select('*')
    .eq('meta_campaign_id', metaCampaignId)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error('Campaign lookup failed:', error);
    return null;
  }

  return {
    id: data.id,
    customerEmail: data.customer_email,
    metaCampaignId: data.meta_campaign_id,
    metaFormId: data.meta_form_id,
    branchId: data.branch_id,
    totalBatchSize: data.total_batch_size,
    currentBatchCount: data.current_batch_count,
    isBatchActive: data.is_batch_active,
    territoryType: data.territory_type,
    centerPostcode: data.center_postcode,
    centerLat: data.center_lat,
    centerLng: data.center_lng,
    radiusKm: data.radius_km,
    allowedRegions: data.allowed_regions,
    isActive: data.is_active
  };
}

/**
 * Log lead processing in the database
 */
async function logLeadProcessing(metaLeadData: any, status: string): Promise<string> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('meta_lead_processing')
    .insert({
      meta_lead_id: metaLeadData.id,
      meta_campaign_id: metaLeadData.campaign_id,
      raw_meta_data: metaLeadData,
      processing_status: status,
      received_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to log lead processing: ${error.message}`);
  }

  return data.id;
}

/**
 * Update processing log
 */
async function updateProcessingLog(logId: string, updates: any): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('meta_lead_processing')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', logId);

  if (error) {
    console.error('Failed to update processing log:', error);
  }
}

/**
 * Convert qualifying result to rejection reason
 */
function getRejectionReason(result: any): string {
  const reasons = [];

  if (!result.branchMatch) reasons.push('wrong_branch');
  if (!result.territoryMatch) reasons.push('outside_territory');
  if (!result.batchCapacity) reasons.push('batch_full');

  return reasons.join(', ') || 'qualification_failed';
}

/**
 * Webhook signature verification (for production security)
 */
function verifySignature(body: string, signature: string | null): boolean {
  if (!signature) return false;

  // TODO: Implement HMAC SHA256 verification
  // const expectedSignature = crypto
  //   .createHmac('sha256', process.env.META_APP_SECRET!)
  //   .update(body, 'utf8')
  //   .digest('hex');
  //
  // return signature === `sha256=${expectedSignature}`;

  return true; // For now, accept all in development
}
