/**
 * Admin API: Update/Delete Batch
 * PUT /api/admin/batches/[batchId] - Update batch
 * DELETE /api/admin/batches/[batchId] - Delete batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { postcodeToCoords } from '@/lib/geographicUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const params = await context.params;
    const { batchId } = params;
    const supabase = createServerClient();
    const body = await request.json();

    const updates: any = {};

    if (body.totalBatchSize !== undefined) updates.total_batch_size = body.totalBatchSize;
    if (body.spreadsheetUrl !== undefined) updates.spreadsheet_url = body.spreadsheetUrl;
    if (body.sheetName !== undefined) updates.sheet_name = body.sheetName;
    if (body.isActive !== undefined) updates.is_active = body.isActive;
    if (body.notes !== undefined) updates.notes = body.notes;

    // Handle territory updates
    if (body.territoryType !== undefined) {
      updates.territory_type = body.territoryType;

      if (body.territoryType === 'radius') {
        if (body.centerPostcode) {
          updates.center_postcode = body.centerPostcode;
          const coords = await postcodeToCoords(body.centerPostcode);
          if (coords) {
            updates.center_lat = coords.lat;
            updates.center_lng = coords.lng;
          }
        }
        if (body.radiusKm !== undefined) updates.radius_km = body.radiusKm;
      } else if (body.territoryType === 'regions') {
        if (body.allowedRegions !== undefined) updates.allowed_regions = body.allowedRegions;
      }
    }

    const { data: batch, error } = await supabase
      .from('customer_batches')
      .update(updates)
      .eq('id', batchId)
      .select()
      .single();

    if (error) {
      console.error('Error updating batch:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      batch: {
        id: batch.id,
        customerEmail: batch.customer_email,
        batchNumber: batch.batch_number,
        branchId: batch.branch_id,
        totalBatchSize: batch.total_batch_size,
        currentBatchCount: batch.current_batch_count,
        spreadsheetUrl: batch.spreadsheet_url,
        sheetName: batch.sheet_name,
        territoryType: batch.territory_type,
        centerPostcode: batch.center_postcode,
        radiusKm: batch.radius_km,
        allowedRegions: batch.allowed_regions,
        isActive: batch.is_active,
        isCompleted: batch.is_completed,
        notes: batch.notes
      }
    });
  } catch (error) {
    console.error('Admin batch update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const params = await context.params;
    const { batchId } = params;
    const supabase = createServerClient();

    const { error } = await supabase
      .from('customer_batches')
      .delete()
      .eq('id', batchId);

    if (error) {
      console.error('Error deleting batch:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin batch delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

