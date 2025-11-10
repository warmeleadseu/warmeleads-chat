/**
 * Admin API: Single Lead Details with Distribution History
 * GET /api/admin/leads/[leadId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  try {
    const params = await context.params;
    const { leadId } = params;
    const supabase = createServerClient();

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Get distribution history
    const { data: distributions, error: distError } = await supabase
      .from('lead_distributions')
      .select(`
        *,
        customer:customers!lead_distributions_customer_email_fkey(
          email,
          company_name,
          contact_person
        ),
        batch:customer_batches!lead_distributions_batch_id_fkey(
          id,
          batch_number,
          total_batch_size,
          current_batch_count
        )
      `)
      .eq('lead_id', leadId)
      .order('distributed_at', { ascending: true });

    if (distError) {
      console.error('Error fetching distributions:', distError);
    }

    // Format distributions
    const distributionsFormatted = distributions?.map(d => ({
      id: d.id,
      customerEmail: d.customer_email,
      customerName: d.customer?.company_name,
      batchId: d.batch_id,
      batchNumber: d.batch?.batch_number,
      batchProgress: `${d.batch?.current_batch_count}/${d.batch?.total_batch_size}`,
      distributedAt: d.distributed_at,
      distributionType: d.distribution_type,
      distanceKm: d.distance_km,
      territoryMatchType: d.territory_match_type,
      priorityScore: d.priority_score,
      daysSinceFirstSeen: d.days_since_first_seen,
      daysSinceLastSeen: d.days_since_last_seen,
      isReturningLead: d.is_returning_lead,
      isReuseDistribution: d.is_reuse_distribution,
      countsTowardsBatch: d.counts_towards_batch,
      addedToSheet: d.added_to_sheet,
      syncedAt: d.synced_at
    })) || [];

    return NextResponse.json({
      lead: {
        id: lead.id,
        email: lead.email,
        phone: lead.phone,
        name: lead.name,
        branch: lead.branch,
        postcode: lead.postcode,
        address: lead.address,
        lat: lead.lat,
        lng: lead.lng,
        status: lead.status,
        source: lead.source,
        totalDistributionCount: lead.total_distribution_count,
        uniqueCustomersCount: lead.unique_customers_count,
        firstSeenAt: lead.first_seen_at,
        lastSeenAt: lead.last_seen_at,
        formSubmissionCount: lead.form_submission_count,
        isAvailableForDistribution: lead.is_available_for_distribution,
        createdAt: lead.created_at
      },
      distributions: distributionsFormatted,
      stats: {
        totalDistributions: distributionsFormatted.length,
        uniqueCustomers: new Set(distributionsFormatted.map(d => d.customerEmail)).size,
        freshDistributions: distributionsFormatted.filter(d => d.distributionType === 'fresh').length,
        reuseDistributions: distributionsFormatted.filter(d => d.isReuseDistribution).length
      }
    });
  } catch (error) {
    console.error('Admin lead detail API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

