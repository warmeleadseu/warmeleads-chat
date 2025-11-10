/**
 * API Route: Get Configured Branches
 * Returns only active branches that have complete field mappings configured
 * Used for dropdowns in forms, batches, etc.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Get all active branches with their mapping counts
    const { data: branches, error } = await supabase
      .from('branch_definitions')
      .select(`
        id,
        name,
        display_name,
        description,
        icon,
        is_active,
        branch_field_mappings(count)
      `)
      .eq('is_active', true)
      .order('display_name', { ascending: true });

    if (error) throw error;

    // Filter to only include branches with field mappings configured
    const configuredBranches = (branches || []).filter((branch: any) => {
      const mappingCount = branch.branch_field_mappings?.[0]?.count || 0;
      return mappingCount > 0;
    });

    // Format the response
    const formattedBranches = configuredBranches.map((branch: any) => ({
      id: branch.id,
      name: branch.name,
      displayName: branch.display_name,
      description: branch.description,
      icon: branch.icon,
    }));

    return NextResponse.json({
      success: true,
      branches: formattedBranches,
      total: formattedBranches.length,
    });
  } catch (error: any) {
    console.error('Error fetching configured branches:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        branches: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

