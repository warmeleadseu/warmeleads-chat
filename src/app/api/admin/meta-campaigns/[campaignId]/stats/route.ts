/**
 * Meta Campaign Statistics API
 * Provides detailed statistics for campaign performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

export const GET = withAuth(async (
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

    // Get campaign info
    const { data: campaign, error: campaignError } = await supabase
      .from('customer_meta_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Get processing statistics
    const { data: processingLogs, error: logsError } = await supabase
      .from('meta_lead_processing')
      .select('processing_status, rejection_reason')
      .eq('meta_campaign_id', campaign.meta_campaign_id);

    if (logsError) {
      console.error('Error fetching processing logs:', logsError);
      return NextResponse.json(
        { error: 'Failed to fetch statistics' },
        { status: 500 }
      );
    }

    // Calculate statistics
    const totalLeads = processingLogs?.length || 0;
    const qualifiedLeads = processingLogs?.filter(log => log.processing_status === 'distributed').length || 0;
    const rejectedLeads = processingLogs?.filter(log => log.processing_status === 'rejected').length || 0;
    const conversionRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;

    // Calculate rejection reasons
    const rejectionCounts: Record<string, number> = {};
    processingLogs?.forEach(log => {
      if (log.processing_status === 'rejected' && log.rejection_reason) {
        const reasons = log.rejection_reason.split(',');
        reasons.forEach((reason: string) => {
          const cleanReason = reason.trim();
          rejectionCounts[cleanReason] = (rejectionCounts[cleanReason] || 0) + 1;
        });
      }
    });

    const topRejectionReasons = Object.entries(rejectionCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 reasons

    // Get leads created from this campaign
    const { data: createdLeads, error: leadsError } = await supabase
      .from('leads')
      .select('qualification_score, territory_distance_km')
      .eq('meta_campaign_id', campaign.meta_campaign_id);

    if (leadsError) {
      console.error('Error fetching created leads:', leadsError);
    }

    // Calculate additional metrics
    const avgQualificationScore = createdLeads?.length
      ? createdLeads.reduce((sum, lead) => sum + (lead.qualification_score || 0), 0) / createdLeads.length
      : 0;

    const avgDistance = createdLeads?.length
      ? createdLeads.reduce((sum, lead) => sum + (lead.territory_distance_km || 0), 0) / createdLeads.length
      : 0;

    const stats = {
      campaignId,
      campaignName: campaign.campaign_name,
      customerEmail: campaign.customer_email,
      branchId: campaign.branch_id,
      totalLeads,
      qualifiedLeads,
      rejectedLeads,
      conversionRate: Math.round(conversionRate * 10) / 10,
      topRejectionReasons,
      batchProgress: {
        current: campaign.current_batch_count,
        total: campaign.total_batch_size,
        percentage: campaign.total_batch_size > 0
          ? Math.round((campaign.current_batch_count / campaign.total_batch_size) * 100)
          : 0
      },
      qualityMetrics: {
        avgQualificationScore: Math.round(avgQualificationScore),
        avgDistanceKm: Math.round(avgDistance * 10) / 10,
        totalQualified: createdLeads?.length || 0
      },
      status: {
        isActive: campaign.is_active,
        isBatchActive: campaign.is_batch_active,
        isComplete: !!campaign.batch_completed_at
      },
      timestamps: {
        created: campaign.created_at,
        lastLead: campaign.last_lead_received,
        completed: campaign.batch_completed_at
      }
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('GET /api/admin/meta-campaigns/[campaignId]/stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
