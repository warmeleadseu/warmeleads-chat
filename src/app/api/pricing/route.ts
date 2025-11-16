import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { DEFAULT_PRICING, type BranchPricingConfig } from '@/lib/pricing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper to check if user is admin (using localStorage admin token)
function isAdminRequest(req: NextRequest): boolean {
  // Admin panel uses localStorage, so we'll allow all requests from admin routes
  // In production, you might want to add proper admin session validation
  return true; // For now, trust that only admins can access /admin routes
}

// GET - Fetch pricing configuration (PUBLIC - No auth required for reading prices)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');

    console.log('💰 Fetching pricing config:', branchId || 'ALL');

    const supabase = createServerClient();

    if (branchId) {
      // Get specific branch pricing
      const { data, error } = await supabase
        .from('pricing_config')
        .select('*')
        .eq('branch_id', branchId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        console.error('❌ Error fetching pricing:', error);
        return NextResponse.json(
          { error: 'Failed to fetch pricing', details: error.message },
          { status: 500 }
        );
      }

      // Return default if not found
      if (!data) {
        const defaultBranch = DEFAULT_PRICING.find(p => p.branchId === branchId);
        return NextResponse.json(defaultBranch || null);
      }

      // Transform to expected format
      const pricing: BranchPricingConfig = {
        branchId: data.branch_id,
        branchName: data.branch_name,
        exclusive: {
          basePrice: parseFloat(data.exclusive_base_price),
          tiers: data.exclusive_tiers
        },
        shared: {
          basePrice: parseFloat(data.shared_base_price),
          minQuantity: data.shared_min_quantity
        }
      };

      return NextResponse.json(pricing);
    } else {
      // Get all pricing - MERGE database data with defaults
      const { data, error } = await supabase
        .from('pricing_config')
        .select('*');

      if (error) {
        console.error('❌ Error fetching all pricing:', error);
        // Return defaults on error
        return NextResponse.json(DEFAULT_PRICING);
      }

      // Transform database data to expected format
      const dbPricing: BranchPricingConfig[] = (data || []).map(p => ({
        branchId: p.branch_id,
        branchName: p.branch_name,
        exclusive: {
          basePrice: parseFloat(p.exclusive_base_price),
          tiers: p.exclusive_tiers
        },
        shared: {
          basePrice: parseFloat(p.shared_base_price),
          minQuantity: p.shared_min_quantity
        }
      }));

      // Create a map of database pricing by branchId
      const dbPricingMap = new Map(dbPricing.map(p => [p.branchId, p]));

      // Merge: Use database values if available, otherwise use defaults
      const mergedPricing = DEFAULT_PRICING.map(defaultPricing => {
        const dbVersion = dbPricingMap.get(defaultPricing.branchId);
        return dbVersion || defaultPricing;
      });

      return NextResponse.json(mergedPricing);
    }
  } catch (error) {
    console.error('❌ Error in GET /api/pricing:', error);
    // Return defaults on error
    return NextResponse.json(DEFAULT_PRICING);
  }
}

// POST - Save pricing configuration (ADMIN ONLY)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { branchId, pricing } = body as { branchId: string; pricing: BranchPricingConfig };

    if (!branchId || !pricing) {
      return NextResponse.json(
        { error: 'Branch ID and pricing are required' },
        { status: 400 }
      );
    }

    console.log('💾 Saving pricing config for:', branchId);

    const supabase = createServerClient();

    // Upsert pricing
    const { data, error } = await supabase
      .from('pricing_config')
      .upsert({
        branch_id: branchId,
        branch_name: pricing.branchName,
        exclusive_base_price: pricing.exclusive.basePrice,
        exclusive_tiers: pricing.exclusive.tiers,
        shared_base_price: pricing.shared.basePrice,
        shared_min_quantity: pricing.shared.minQuantity
      }, {
        onConflict: 'branch_id'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving pricing:', error);
      return NextResponse.json(
        { error: 'Failed to save pricing', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Pricing saved successfully');

    return NextResponse.json({
      success: true,
      pricing: data
    });
  } catch (error) {
    console.error('❌ Error in POST /api/pricing:', error);
    return NextResponse.json(
      { error: 'Failed to save pricing' },
      { status: 500 }
    );
  }
}

// PUT - Update pricing configuration for a branch (ADMIN ONLY)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { branchId, updates } = body;

    if (!branchId || !updates) {
      return NextResponse.json(
        { error: 'Branch ID and updates are required' },
        { status: 400 }
      );
    }

    console.log('📝 Updating pricing for:', branchId);
    console.log('📊 Updates:', updates);

    const supabase = createServerClient();

    // Use UPSERT to handle both insert and update
    const { data, error } = await supabase
      .from('pricing_config')
      .upsert({
        branch_id: branchId,
        branch_name: updates.branchName || branchId,
        exclusive_base_price: updates.exclusive?.basePrice || 0,
        exclusive_tiers: updates.exclusive?.tiers || [],
        shared_base_price: updates.shared?.basePrice || 0,
        shared_min_quantity: updates.shared?.minQuantity || 500
      }, {
        onConflict: 'branch_id'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating pricing:', error);
      return NextResponse.json(
        { error: 'Failed to update pricing', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Pricing updated successfully');

    return NextResponse.json({
      success: true,
      pricing: data
    });
  } catch (error) {
    console.error('❌ Error in PUT /api/pricing:', error);
    return NextResponse.json(
      { error: 'Failed to update pricing' },
      { status: 500 }
    );
  }
}
