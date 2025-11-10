/**
 * Admin API: Customer Batches Management
 * GET /api/admin/batches - List all batches (optionally filtered by customer)
 * POST /api/admin/batches - Create new batch for customer
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { postcodeToCoords } from '@/lib/geographicUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const searchParams = request.nextUrl.searchParams;
    const customerEmail = searchParams.get('customerEmail');
    const branch = searchParams.get('branch');
    const active = searchParams.get('active');

    let query = supabase
      .from('customer_batches')
      .select(`
        *,
        customer:customers!customer_batches_customer_email_fkey(
          email,
          company_name,
          contact_person
        )
      `)
      .order('created_at', { ascending: false });

    if (customerEmail) {
      query = query.eq('customer_email', customerEmail);
    }

    if (branch && branch !== 'all') {
      query = query.eq('branch_id', branch);
    }

    if (active === 'true') {
      query = query.eq('is_active', true);
    } else if (active === 'false') {
      query = query.eq('is_active', false);
    }

    const { data: batches, error } = await query;

    if (error) {
      console.error('Error fetching batches:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format batches
    const batchesFormatted = batches?.map(batch => ({
      id: batch.id,
      customerEmail: batch.customer_email,
      customerName: batch.customer?.company_name,
      batchNumber: batch.batch_number,
      branchId: batch.branch_id,
      totalBatchSize: batch.total_batch_size,
      currentBatchCount: batch.current_batch_count,
      spreadsheetUrl: batch.spreadsheet_url,
      sheetName: batch.sheet_name,
      territoryType: batch.territory_type,
      centerPostcode: batch.center_postcode,
      centerLat: batch.center_lat,
      centerLng: batch.center_lng,
      radiusKm: batch.radius_km,
      allowedRegions: batch.allowed_regions,
      isActive: batch.is_active,
      isCompleted: batch.is_completed,
      createdAt: batch.created_at,
      startedAt: batch.started_at,
      completedAt: batch.completed_at,
      lastLeadReceivedAt: batch.last_lead_received_at,
      notes: batch.notes
    })) || [];

    return NextResponse.json({ batches: batchesFormatted });
  } catch (error) {
    console.error('Admin batches API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();

    const {
      customerEmail,
      branchId,
      totalBatchSize,
      spreadsheetUrl,
      sheetName,
      territoryType,
      centerPostcode,
      radiusKm,
      allowedRegions,
      notes
    } = body;

    // Validate required fields
    if (!customerEmail || !branchId || !totalBatchSize || !spreadsheetUrl || !territoryType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate batch number
    const { data: existingBatches } = await supabase
      .from('customer_batches')
      .select('batch_number')
      .eq('customer_email', customerEmail)
      .order('created_at', { ascending: false })
      .limit(1);

    const batchCount = existingBatches?.length || 0;
    const batchNumber = `BATCH-${new Date().getFullYear()}-${String(batchCount + 1).padStart(3, '0')}`;

    // Get coordinates from postcode if needed
    let centerLat = null;
    let centerLng = null;

    if (territoryType === 'radius' && centerPostcode) {
      const coords = await postcodeToCoords(centerPostcode);
      if (coords) {
        centerLat = coords.lat;
        centerLng = coords.lng;
      }
    }

    // Create batch
    const { data: batch, error } = await supabase
      .from('customer_batches')
      .insert({
        customer_email: customerEmail,
        batch_number: batchNumber,
        branch_id: branchId,
        total_batch_size: totalBatchSize,
        current_batch_count: 0,
        spreadsheet_url: spreadsheetUrl,
        sheet_name: sheetName || 'Leads',
        territory_type: territoryType,
        center_postcode: centerPostcode || null,
        center_lat: centerLat,
        center_lng: centerLng,
        radius_km: territoryType === 'radius' ? radiusKm : null,
        allowed_regions: territoryType === 'regions' ? allowedRegions : null,
        is_active: true,
        is_completed: false,
        notes: notes || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating batch:', error);
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
        centerLat: batch.center_lat,
        centerLng: batch.center_lng,
        radiusKm: batch.radius_km,
        allowedRegions: batch.allowed_regions,
        isActive: batch.is_active,
        isCompleted: batch.is_completed,
        createdAt: batch.created_at,
        notes: batch.notes
      }
    });
  } catch (error) {
    console.error('Admin batch create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

