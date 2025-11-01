import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { DEFAULT_PRICING, type BranchPricingConfig } from '@/lib/pricing';

// GET - Fetch pricing configuration
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
      // Get all pricing
      const { data, error } = await supabase
        .from('pricing_config')
        .select('*');

      if (error) {
        console.error('❌ Error fetching all pricing:', error);
        // Return defaults on error
        return NextResponse.json(DEFAULT_PRICING);
      }

      if (!data || data.length === 0) {
        // Return defaults if empty
        return NextResponse.json(DEFAULT_PRICING);
      }

      // Transform to expected format
      const pricing: BranchPricingConfig[] = data.map(p => ({
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

      return NextResponse.json(pricing);
    }
  } catch (error) {
    console.error('❌ Error in GET /api/pricing:', error);
    // Return defaults on error
    return NextResponse.json(DEFAULT_PRICING);
  }
}

// POST - Save pricing configuration
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

// PUT - Update pricing configuration for a branch
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

    const supabase = createServerClient();

    // Build update object
    const updateData: any = {};
    if (updates.branchName) updateData.branch_name = updates.branchName;
    if (updates.exclusive) {
      if (updates.exclusive.basePrice) updateData.exclusive_base_price = updates.exclusive.basePrice;
      if (updates.exclusive.tiers) updateData.exclusive_tiers = updates.exclusive.tiers;
    }
    if (updates.shared) {
      if (updates.shared.basePrice) updateData.shared_base_price = updates.shared.basePrice;
      if (updates.shared.minQuantity) updateData.shared_min_quantity = updates.shared.minQuantity;
    }

    // Update pricing
    const { data, error } = await supabase
      .from('pricing_config')
      .update(updateData)
      .eq('branch_id', branchId)
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
