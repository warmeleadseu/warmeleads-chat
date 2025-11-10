/**
 * API Route: Test Lead Distribution
 * 
 * Tests the lead distribution system without actually writing to Google Sheets
 * Returns detailed information about candidates, priority scoring, and distribution decisions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { postcodeToCoords, calculateDistance } from '@/lib/geographicUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TestLead {
  email: string;
  phone?: string;
  name?: string;
  branch: string;
  postcode?: string;
  address?: string;
}

interface CustomerBatch {
  id: string;
  customer_email: string;
  batch_number: string;
  branch_id: string;
  total_batch_size: number;
  current_batch_count: number;
  spreadsheet_url: string;
  sheet_name?: string;
  territory_type: 'radius' | 'full_country' | 'regions';
  center_postcode?: string;
  center_lat?: number;
  center_lng?: number;
  radius_km?: number;
  allowed_regions?: string[];
  is_active: boolean;
  customers?: { company_name?: string; contact_person?: string; email: string };
}

interface DistributionCandidate {
  customerEmail: string;
  customerName: string;
  batchId: string;
  territoryType: string;
  priorityScore: number;
  distance?: number;
  matchReason: string;
  eligible: boolean;
  rejectionReason?: string;
}

export async function POST(request: NextRequest) {
  const logs: string[] = [];
  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    logs.push(`[${timestamp}] ${message}`);
    console.log(`[TEST-DISTRIBUTION] ${message}`);
  };

  try {
    const { lead, dryRun } = await request.json() as { lead: TestLead; dryRun: boolean };

    addLog(`=== START TEST DISTRIBUTION ===`);
    addLog(`Mode: ${dryRun ? 'DRY RUN (simulation only)' : 'LIVE RUN (real distribution)'}`);
    addLog(`Lead: ${lead.name || lead.email} | Branch: ${lead.branch}`);

    const supabase = createServerClient();

    // 1. Check if lead already exists
    addLog(`\n[STEP 1] Checking for existing lead...`);
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, email, total_distribution_count, unique_customers_count, form_submission_count')
      .eq('email', lead.email)
      .single();

    if (existingLead) {
      addLog(`⚠️  Lead already exists in database:`);
      addLog(`    - ID: ${existingLead.id}`);
      addLog(`    - Total distributions: ${existingLead.total_distribution_count}`);
      addLog(`    - Unique customers: ${existingLead.unique_customers_count}`);
      addLog(`    - Form submissions: ${existingLead.form_submission_count}`);
    } else {
      addLog(`✓ Lead is new (not in database yet)`);
    }

    // 2. Get geographic coordinates
    addLog(`\n[STEP 2] Processing geographic data...`);
    let leadCoordinates: { lat: number; lng: number } | null = null;
    
    if (lead.postcode) {
      addLog(`Postcode provided: ${lead.postcode}`);
      leadCoordinates = await postcodeToCoords(lead.postcode);
      
      if (leadCoordinates) {
        addLog(`✓ Coordinates found: ${leadCoordinates.lat.toFixed(6)}, ${leadCoordinates.lng.toFixed(6)}`);
      } else {
        addLog(`⚠️  Could not geocode postcode ${lead.postcode}`);
      }
    } else {
      addLog(`⚠️  No postcode provided, geographic matching will be limited`);
    }

    // 3. Find active batches for this branch
    addLog(`\n[STEP 3] Finding active batches for branch: ${lead.branch}...`);
    const { data: batches, error: batchError } = await supabase
      .from('customer_batches')
      .select(`
        *,
        customers!customer_batches_customer_email_fkey(
          email,
          company_name,
          contact_person
        )
      `)
      .eq('branch_id', lead.branch)
      .eq('is_active', true);

    if (batchError) {
      addLog(`❌ Error loading batches: ${batchError.message}`);
      throw new Error(`Failed to load batches: ${batchError.message}`);
    }

    addLog(`Found ${batches?.length || 0} active batches`);

    if (!batches || batches.length === 0) {
      addLog(`❌ No active batches found for branch ${lead.branch}`);
      return NextResponse.json({
        success: false,
        distributionsPlanned: 0,
        distributionsExecuted: 0,
        candidates: [],
        selectedCustomers: [],
        logs,
        error: `No active batches found for branch ${lead.branch}`,
        geographicData: {
          postcode: lead.postcode,
          leadCoordinates,
        },
      });
    }

    // 4. Filter batches with capacity
    addLog(`\n[STEP 4] Checking batch capacity...`);
    const batchesWithCapacity = (batches as CustomerBatch[]).filter(
      (b) => b.current_batch_count < b.total_batch_size
    );
    
    addLog(`Batches with available capacity: ${batchesWithCapacity.length}/${batches.length}`);
    batchesWithCapacity.forEach((b) => {
      const customer = Array.isArray(b.customers) ? b.customers[0] : b.customers;
      const customerName = customer?.company_name || customer?.contact_person || b.customer_email;
      addLog(`  - ${customerName}: ${b.current_batch_count}/${b.total_batch_size} (${b.total_batch_size - b.current_batch_count} remaining)`);
    });

    if (batchesWithCapacity.length === 0) {
      addLog(`❌ No batches with available capacity`);
      return NextResponse.json({
        success: false,
        distributionsPlanned: 0,
        distributionsExecuted: 0,
        candidates: [],
        selectedCustomers: [],
        logs,
        error: 'No batches with available capacity',
        geographicData: {
          postcode: lead.postcode,
          leadCoordinates,
        },
      });
    }

    // 5. Evaluate each candidate
    addLog(`\n[STEP 5] Evaluating distribution candidates...`);
    const candidates: DistributionCandidate[] = [];

    for (const batch of batchesWithCapacity) {
      const customer = Array.isArray(batch.customers) ? batch.customers[0] : batch.customers;
      const customerName = customer?.company_name || customer?.contact_person || batch.customer_email;

      addLog(`\n  Evaluating: ${customerName}`);
      addLog(`    Territory: ${batch.territory_type}`);

      let eligible = true;
      let rejectionReason = '';
      let matchReason = '';
      let distance: number | undefined = undefined;
      let priorityScore = 1000; // Default (lower is better)

      // Check if customer already received this lead
      if (existingLead) {
        const { data: existingDistribution } = await supabase
          .from('lead_distributions')
          .select('id, distributed_at')
          .eq('lead_id', existingLead.id)
          .eq('customer_email', batch.customer_email)
          .single();

        if (existingDistribution) {
          eligible = false;
          rejectionReason = `Customer already received this lead on ${new Date(existingDistribution.distributed_at).toLocaleDateString('nl-NL')}`;
          addLog(`    ❌ ${rejectionReason}`);
        }
      }

      // Geographic matching
      if (eligible) {
        if (batch.territory_type === 'full_country') {
          priorityScore = 1000; // Lowest priority
          matchReason = 'Heel Nederland (laagste prioriteit)';
          addLog(`    ✓ Match: ${matchReason}`);
        } else if (batch.territory_type === 'radius') {
          if (!leadCoordinates || !batch.center_lat || !batch.center_lng) {
            eligible = false;
            rejectionReason = leadCoordinates
              ? 'Batch heeft geen center coordinates'
              : 'Lead heeft geen coordinates';
            addLog(`    ❌ ${rejectionReason}`);
          } else {
            distance = calculateDistance(
              leadCoordinates.lat,
              leadCoordinates.lng,
              batch.center_lat,
              batch.center_lng
            );
            
            addLog(`    Distance: ${distance.toFixed(1)}km from ${batch.center_postcode} (max: ${batch.radius_km}km)`);
            
            if (distance <= (batch.radius_km || 0)) {
              priorityScore = batch.radius_km || 0; // Smaller radius = higher priority
              matchReason = `Binnen ${batch.radius_km}km straal (${distance.toFixed(1)}km afstand)`;
              addLog(`    ✓ Match: ${matchReason}`);
            } else {
              eligible = false;
              rejectionReason = `Buiten bereik: ${distance.toFixed(1)}km > ${batch.radius_km}km`;
              addLog(`    ❌ ${rejectionReason}`);
            }
          }
        } else if (batch.territory_type === 'regions') {
          priorityScore = 500; // Medium priority
          matchReason = 'Specifieke regio\'s (medium prioriteit)';
          addLog(`    ✓ Match: ${matchReason}`);
          addLog(`    ⚠️  Note: Region matching not fully implemented yet`);
        }
      }

      candidates.push({
        customerEmail: batch.customer_email,
        customerName,
        batchId: batch.id,
        territoryType: batch.territory_type,
        priorityScore,
        distance,
        matchReason,
        eligible,
        rejectionReason,
      });
    }

    // 6. Sort by priority and select top 2 eligible
    addLog(`\n[STEP 6] Selecting distribution targets...`);
    const eligibleCandidates = candidates
      .filter((c) => c.eligible)
      .sort((a, b) => a.priorityScore - b.priorityScore);

    addLog(`Eligible candidates: ${eligibleCandidates.length}`);
    
    const selectedCandidates = eligibleCandidates.slice(0, 2);
    addLog(`Selected for distribution: ${selectedCandidates.length} (max 2)`);

    selectedCandidates.forEach((c, index) => {
      addLog(`  ${index + 1}. ${c.customerName} (priority: ${c.priorityScore}, ${c.matchReason})`);
    });

    // 7. Execute distribution (or simulate if dry run)
    addLog(`\n[STEP 7] ${dryRun ? 'Simulating' : 'Executing'} distribution...`);
    
    if (!dryRun && selectedCandidates.length > 0) {
      addLog(`⚠️  LIVE MODE: Would write to Google Sheets and database here`);
      addLog(`⚠️  NOT IMPLEMENTED YET - keeping as dry run for safety`);
      // TODO: Implement actual distribution when ready
    } else if (selectedCandidates.length > 0) {
      addLog(`✓ DRY RUN: No actual writes performed`);
      addLog(`✓ Would distribute to ${selectedCandidates.length} customers:`);
      selectedCandidates.forEach((c) => {
        addLog(`  - ${c.customerName} (${c.customerEmail})`);
      });
    } else {
      addLog(`⚠️  No eligible candidates found - nothing to distribute`);
    }

    addLog(`\n=== END TEST DISTRIBUTION ===`);

    return NextResponse.json({
      success: selectedCandidates.length > 0,
      leadId: existingLead?.id,
      distributionsPlanned: selectedCandidates.length,
      distributionsExecuted: dryRun ? 0 : selectedCandidates.length,
      candidates,
      selectedCustomers: selectedCandidates.map((c) => c.customerEmail),
      logs,
      geographicData: {
        postcode: lead.postcode,
        leadCoordinates,
      },
    });
  } catch (error: any) {
    addLog(`\n❌ FATAL ERROR: ${error.message}`);
    console.error('Test distribution error:', error);

    return NextResponse.json({
      success: false,
      distributionsPlanned: 0,
      distributionsExecuted: 0,
      candidates: [],
      selectedCustomers: [],
      logs,
      error: error.message,
    });
  }
}

