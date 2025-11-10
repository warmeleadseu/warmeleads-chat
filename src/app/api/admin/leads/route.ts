/**
 * Admin API: Get all leads with distribution stats
 * GET /api/admin/leads
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const searchParams = request.nextUrl.searchParams;

    // Get filters from query params
    const branch = searchParams.get('branch');
    const status = searchParams.get('status'); // available, exhausted
    const search = searchParams.get('search'); // email or phone search
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('leads')
      .select(`
        *,
        distributions:lead_distributions(count)
      `, { count: 'exact' });

    // Apply filters
    if (branch && branch !== 'all') {
      query = query.eq('branch', branch);
    }

    if (status === 'available') {
      query = query.eq('is_available_for_distribution', true);
    } else if (status === 'exhausted') {
      query = query.eq('is_available_for_distribution', false);
    }

    if (search) {
      query = query.or(`email.ilike.%${search}%,phone.ilike.%${search}%,name.ilike.%${search}%`);
    }

    // Execute query with pagination
    const { data: leads, error, count } = await query
      .order('last_seen_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get distribution details for each lead
    const leadsWithDetails = await Promise.all(
      (leads || []).map(async (lead) => {
        // Get full distribution history with customer details and batch info
        const { data: distributions } = await supabase
          .from('lead_distributions')
          .select(`
            id,
            customer_email,
            distributed_at,
            distribution_type,
            distance_km,
            territory_match_type,
            priority_score,
            added_to_sheet,
            sheet_row_number,
            sheet_sync_error,
            is_returning_lead,
            is_reuse_distribution,
            batch_id,
            customers!lead_distributions_customer_email_fkey(
              email,
              company_name,
              contact_person
            ),
            customer_batches!lead_distributions_batch_id_fkey(
              batch_number
            )
          `)
          .eq('lead_id', lead.id)
          .order('distributed_at', { ascending: false });

        const uniqueCustomers = new Set(distributions?.map(d => d.customer_email) || []);

        // Format distributions for frontend
        const formattedDistributions = (distributions || []).map((dist: any) => {
          const customer = Array.isArray(dist.customers) ? dist.customers[0] : dist.customers;
          const batch = Array.isArray(dist.customer_batches) ? dist.customer_batches[0] : dist.customer_batches;
          
          return {
            id: dist.id,
            customerEmail: dist.customer_email,
            customerName: customer?.company_name || customer?.contact_person || dist.customer_email,
            batchId: dist.batch_id,
            batchNumber: batch?.batch_number || 'N/A',
            distributedAt: dist.distributed_at,
            distributionType: dist.distribution_type,
            distanceKm: dist.distance_km,
            territoryMatchType: dist.territory_match_type,
            priorityScore: dist.priority_score,
            addedToSheet: dist.added_to_sheet,
            sheetRowNumber: dist.sheet_row_number,
            sheetSyncError: dist.sheet_sync_error,
            isReturningLead: dist.is_returning_lead,
            isReuseDistribution: dist.is_reuse_distribution,
          };
        });

        return {
          ...lead,
          distributionCount: lead.total_distribution_count || 0,
          uniqueCustomersCount: uniqueCustomers.size,
          distributions: formattedDistributions,
          lastDistributedAt: distributions && distributions.length > 0
            ? distributions[0].distributed_at
            : null
        };
      })
    );

    // Get stats
    const { data: stats } = await supabase
      .from('leads')
      .select('branch, total_distribution_count.sum()', { count: 'exact' });

    const totalLeads = count || 0;
    const avgDistribution = leads && leads.length > 0
      ? leads.reduce((sum, l) => sum + (l.total_distribution_count || 0), 0) / leads.length
      : 0;

    return NextResponse.json({
      leads: leadsWithDetails,
      pagination: {
        total: totalLeads,
        limit,
        offset,
        hasMore: totalLeads > offset + limit
      },
      stats: {
        totalLeads,
        avgDistribution: Math.round(avgDistribution * 10) / 10
      }
    });

  } catch (error) {
    console.error('Admin leads API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

