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
        // Get distribution count and customers
        const { data: distributions } = await supabase
          .from('lead_distributions')
          .select(`
            customer_email,
            distributed_at,
            distribution_type,
            customers!lead_distributions_customer_email_fkey(company_name)
          `)
          .eq('lead_id', lead.id);

        const uniqueCustomers = new Set(distributions?.map(d => d.customer_email) || []);

        return {
          ...lead,
          distributionCount: lead.total_distribution_count || 0,
          uniqueCustomersCount: uniqueCustomers.size,
          lastDistributedAt: distributions && distributions.length > 0
            ? new Date(Math.max(...distributions.map(d => new Date(d.distributed_at).getTime())))
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

