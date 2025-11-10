/**
 * Meta Campaigns Admin API
 * CRUD operations for Meta campaign configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/admin/meta-campaigns - List all campaigns
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();

    const { data: campaigns, error } = await supabase
      .from('customer_meta_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    // Map database columns to camelCase
    const formattedCampaigns = (campaigns || []).map(c => ({
      id: c.id,
      customerEmail: c.customer_email,
      metaCampaignId: c.meta_campaign_id,
      metaFormId: c.meta_form_id,
      campaignName: c.campaign_name,
      branchId: c.branch_id,
      totalBatchSize: c.total_batch_size,
      currentBatchCount: c.current_batch_count,
      isBatchActive: c.is_batch_active,
      territoryType: c.territory_type,
      centerPostcode: c.center_postcode,
      centerLat: c.center_lat,
      centerLng: c.center_lng,
      radiusKm: c.radius_km,
      allowedRegions: c.allowed_regions,
      webhookToken: c.webhook_token,
      isWebhookActive: c.is_webhook_active,
      isActive: c.is_active,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      lastLeadReceived: c.last_lead_received,
      batchCompletedAt: c.batch_completed_at
    }));

    return NextResponse.json({ campaigns: formattedCampaigns });
  } catch (error) {
    console.error('GET /api/admin/meta-campaigns error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/meta-campaigns - Create new campaign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerEmail,
      metaCampaignId,
      metaFormId,
      campaignName,
      branchId,
      totalBatchSize,
      territoryType,
      centerPostcode,
      radiusKm,
      allowedRegions,
      isActive
    } = body;

    // Validation
    if (!customerEmail || !metaCampaignId || !metaFormId || !branchId || !totalBatchSize) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate webhook token
    const webhookToken = `wl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const supabase = createServerClient();

    // Check if campaign already exists
    const { data: existing } = await supabase
      .from('customer_meta_campaigns')
      .select('id')
      .eq('meta_campaign_id', metaCampaignId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Campaign with this Meta Campaign ID already exists' },
        { status: 409 }
      );
    }

    // Create campaign
    const { data: campaign, error } = await supabase
      .from('customer_meta_campaigns')
      .insert({
        customer_email: customerEmail,
        meta_campaign_id: metaCampaignId,
        meta_form_id: metaFormId,
        campaign_name: campaignName,
        branch_id: branchId,
        total_batch_size: totalBatchSize,
        current_batch_count: 0,
        is_batch_active: true,
        territory_type: territoryType,
        center_postcode: centerPostcode,
        radius_km: radiusKm,
        allowed_regions: allowedRegions,
        webhook_token: webhookToken,
        is_active: isActive !== false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating campaign:', error);
      return NextResponse.json(
        { error: 'Failed to create campaign' },
        { status: 500 }
      );
    }

    console.log(`✅ Created Meta campaign ${campaign.id} for customer ${customerEmail}`);
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('POST /api/admin/meta-campaigns error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
