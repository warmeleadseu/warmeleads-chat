/**
 * Individual Meta Campaign Admin API
 * Update and delete operations for specific campaigns
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// PUT /api/admin/meta-campaigns/[campaignId] - Update campaign
export const PUT = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  context?: { params: { campaignId: string } }
) => {
  try {
    const campaignId = context?.params?.campaignId;
    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }
    const body = await request.json();

    const supabase = createServerClient();

    // Check if campaign exists
    const { data: existing, error: findError } = await supabase
      .from('customer_meta_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (findError || !existing) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Update campaign
    const { data: campaign, error } = await supabase
      .from('customer_meta_campaigns')
      .update({
        campaign_name: body.campaignName,
        branch_id: body.branchId,
        total_batch_size: body.totalBatchSize,
        territory_type: body.territoryType,
        center_postcode: body.centerPostcode,
        radius_km: body.radiusKm,
        allowed_regions: body.allowedRegions,
        is_active: body.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      console.error('Error updating campaign:', error);
      return NextResponse.json(
        { error: 'Failed to update campaign' },
        { status: 500 }
      );
    }

    console.log(`✅ Updated Meta campaign ${campaignId}`);
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('PUT /api/admin/meta-campaigns/[campaignId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/meta-campaigns/[campaignId] - Delete campaign
export const DELETE = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  context?: { params: { campaignId: string } }
) => {
  try {
    const campaignId = context?.params?.campaignId;
    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Check if campaign exists and has leads
    const { data: campaign, error: findError } = await supabase
      .from('customer_meta_campaigns')
      .select('current_batch_count, customer_email')
      .eq('id', campaignId)
      .single();

    if (findError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if campaign has leads
    if (campaign.current_batch_count > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete campaign with existing leads',
          message: 'Reset de batch eerst voordat je de campagne verwijdert'
        },
        { status: 400 }
      );
    }

    // Delete associated processing logs first
    await supabase
      .from('meta_lead_processing')
      .delete()
      .eq('meta_campaign_id', campaignId);

    // Delete the campaign
    const { error } = await supabase
      .from('customer_meta_campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) {
      console.error('Error deleting campaign:', error);
      return NextResponse.json(
        { error: 'Failed to delete campaign' },
        { status: 500 }
      );
    }

    console.log(`🗑️ Deleted Meta campaign ${campaignId} for customer ${campaign.customer_email}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/meta-campaigns/[campaignId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
