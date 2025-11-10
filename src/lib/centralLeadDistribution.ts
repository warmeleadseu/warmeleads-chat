/**
 * Central Lead Distribution Engine
 * 
 * Intelligently distributes leads to customers based on:
 * - Geographic priority (smallest radius first)
 * - Batch capacity
 * - Previous distributions (no duplicates per customer)
 * - 30-day reuse rule for returning leads
 */

import { createServerClient } from './supabase';
import { calculateDistance } from './geographicUtils';

interface Lead {
  id: string;
  email: string;
  phone?: string;
  name?: string;
  branch: string;
  postcode?: string;
  lat?: number;
  lng?: number;
  first_seen_at: Date;
  last_seen_at: Date;
  form_submission_count: number;
  total_distribution_count: number;
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
}

interface DistributionCandidate extends CustomerBatch {
  priority_score: number;
  distance_km?: number;
  match_reason: string;
}

interface DistributionResult {
  success: boolean;
  distributions_made: number;
  distributed_to: string[];
  error?: string;
  details: Array<{
    customer_email: string;
    batch_id: string;
    distribution_type: string;
    distance_km?: number;
  }>;
}

/**
 * Main function: Process incoming lead and distribute intelligently
 */
export async function processAndDistributeLead(
  leadData: {
    email: string;
    phone?: string;
    name?: string;
    branch: string;
    postcode?: string;
    address?: string;
    lat?: number;
    lng?: number;
    source?: string;
    meta_lead_id?: string;
  }
): Promise<DistributionResult> {
  try {
    console.log('🎯 Starting lead distribution for:', leadData.email);

    // Step 1: Check if this is a duplicate lead (returning customer)
    const existingLead = await findExistingLead(leadData.email, leadData.phone);

    let lead: Lead;
    let isReturningLead = false;

    if (existingLead) {
      console.log('🔄 Returning lead detected:', existingLead.id);
      isReturningLead = true;

      // Update existing lead
      lead = await updateExistingLead(existingLead.id, leadData);
    } else {
      console.log('✨ New lead, creating in database');
      lead = await createNewLead(leadData);
    }

    // Step 2: Find eligible customers for distribution
    const candidates = await findEligibleCustomers(lead, isReturningLead);

    if (candidates.fresh.length === 0 && candidates.reuse.length === 0) {
      console.log('⚠️ No eligible customers found for this lead');
      return {
        success: false,
        distributions_made: 0,
        distributed_to: [],
        error: 'No eligible customers with active batches',
        details: []
      };
    }

    // Step 3: Distribute to fresh customers (max 2)
    const freshDistributions = await distributeToFreshCustomers(lead, candidates.fresh);

    // Step 4: If no fresh customers but reuse is available, distribute there
    const reuseDistributions = freshDistributions.length === 0 
      ? await distributeToReuseCustomers(lead, candidates.reuse)
      : [];

    const allDistributions = [...freshDistributions, ...reuseDistributions];

    // Step 5: Update lead stats
    await updateLeadDistributionStats(lead.id, allDistributions.length);

    console.log(`✅ Distribution complete: ${allDistributions.length} distributions made`);

    return {
      success: true,
      distributions_made: allDistributions.length,
      distributed_to: allDistributions.map(d => d.customer_email),
      details: allDistributions
    };

  } catch (error) {
    console.error('❌ Error in lead distribution:', error);
    return {
      success: false,
      distributions_made: 0,
      distributed_to: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      details: []
    };
  }
}

/**
 * Find existing lead by email or phone
 */
async function findExistingLead(email: string, phone?: string): Promise<Lead | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .or(`email.eq.${email}${phone ? `,phone.eq.${phone}` : ''}`)
    .single();

  if (error || !data) return null;

  return data as Lead;
}

/**
 * Create new lead in database
 */
async function createNewLead(leadData: any): Promise<Lead> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('leads')
    .insert({
      email: leadData.email,
      phone: leadData.phone,
      name: leadData.name,
      branch: leadData.branch,
      postcode: leadData.postcode,
      address: leadData.address,
      lat: leadData.lat,
      lng: leadData.lng,
      source: leadData.source || 'meta_ads',
      status: 'new',
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      form_submission_count: 1,
      total_distribution_count: 0,
      is_available_for_distribution: true
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create lead: ${error?.message}`);
  }

  return data as Lead;
}

/**
 * Update existing lead with new submission
 */
async function updateExistingLead(leadId: string, leadData: any): Promise<Lead> {
  const supabase = createServerClient();
  // First get current count
  const { data: current } = await supabase
    .from('leads')
    .select('form_submission_count')
    .eq('id', leadId)
    .single();

  const newCount = (current?.form_submission_count || 0) + 1;

  const { data, error } = await supabase
    .from('leads')
    .update({
      last_seen_at: new Date().toISOString(),
      form_submission_count: newCount,
      // Update address/postcode if changed
      ...(leadData.postcode && { postcode: leadData.postcode }),
      ...(leadData.address && { address: leadData.address }),
      ...(leadData.lat && { lat: leadData.lat }),
      ...(leadData.lng && { lng: leadData.lng }),
    })
    .eq('id', leadId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update lead: ${error?.message}`);
  }

  return data as Lead;
}

/**
 * Find eligible customers for distribution
 * Returns both fresh customers and reuse-eligible customers
 */
async function findEligibleCustomers(
  lead: Lead,
  isReturningLead: boolean
): Promise<{
  fresh: DistributionCandidate[];
  reuse: DistributionCandidate[];
}> {
  const supabase = createServerClient();
  // Get all active batches for this branch
  const { data: batches, error: batchError } = await supabase
    .from('customer_batches')
    .select('*')
    .eq('branch_id', lead.branch)
    .eq('is_active', true);

  if (batchError || !batches) {
    console.error('Error fetching batches:', batchError);
    return { fresh: [], reuse: [] };
  }

  // Filter batches that still have capacity
  const availableBatches = batches.filter(
    (b: CustomerBatch) => b.current_batch_count < b.total_batch_size
  );

  // Get existing distributions for this lead
  const { data: existingDistributions } = await supabase
    .from('lead_distributions')
    .select('customer_email, distributed_at')
    .eq('lead_id', lead.id);

  const distributedCustomers = new Map(
    (existingDistributions || []).map(d => [
      d.customer_email,
      new Date(d.distributed_at)
    ])
  );

  // Categorize candidates
  const freshCandidates: DistributionCandidate[] = [];
  const reuseCandidates: DistributionCandidate[] = [];

  for (const batch of availableBatches as CustomerBatch[]) {
    const lastDistribution = distributedCustomers.get(batch.customer_email);

    if (!lastDistribution) {
      // Customer never received this lead - FRESH candidate
      const candidate = await evaluateCandidate(lead, batch);
      if (candidate) {
        freshCandidates.push(candidate);
      }
    } else {
      // Customer already received this lead - check 30-day rule
      const daysSince = Math.floor(
        (Date.now() - lastDistribution.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSince >= 30) {
        // Eligible for REUSE
        const candidate = await evaluateCandidate(lead, batch);
        if (candidate) {
          reuseCandidates.push({
            ...candidate,
            match_reason: `Reuse after ${daysSince} days`
          });
        }
      }
    }
  }

  // Sort by priority (lower score = higher priority)
  freshCandidates.sort((a, b) => a.priority_score - b.priority_score);
  reuseCandidates.sort((a, b) => a.priority_score - b.priority_score);

  console.log(`📊 Found ${freshCandidates.length} fresh + ${reuseCandidates.length} reuse candidates`);

  return { fresh: freshCandidates, reuse: reuseCandidates };
}

/**
 * Evaluate if a customer batch matches the lead's geography
 */
async function evaluateCandidate(
  lead: Lead,
  batch: CustomerBatch
): Promise<DistributionCandidate | null> {
  let priorityScore = 0;
  let distanceKm: number | undefined;
  let matchReason = '';

  switch (batch.territory_type) {
    case 'radius':
      if (!lead.lat || !lead.lng || !batch.center_lat || !batch.center_lng) {
        return null; // Can't calculate distance
      }

      distanceKm = calculateDistance(
        lead.lat,
        lead.lng,
        batch.center_lat,
        batch.center_lng
      );

      if (distanceKm > (batch.radius_km || 0)) {
        return null; // Outside radius
      }

      priorityScore = batch.radius_km || 0;
      matchReason = `${batch.radius_km}km radius (${distanceKm.toFixed(1)}km away)`;
      break;

    case 'regions':
      // Check if lead's region is in allowed list
      // TODO: Implement region matching based on postcode
      priorityScore = 500;
      matchReason = 'Regional match';
      break;

    case 'full_country':
      priorityScore = 1000;
      matchReason = 'Nationwide';
      break;

    default:
      return null;
  }

  return {
    ...batch,
    priority_score: priorityScore,
    distance_km: distanceKm,
    match_reason: matchReason
  };
}

/**
 * Distribute to fresh customers (max 2)
 */
async function distributeToFreshCustomers(
  lead: Lead,
  candidates: DistributionCandidate[]
): Promise<Array<{ customer_email: string; batch_id: string; distribution_type: string; distance_km?: number }>> {
  const distributions = [];
  const maxDistributions = 2;

  for (let i = 0; i < Math.min(maxDistributions, candidates.length); i++) {
    const candidate = candidates[i];

    try {
      await createDistribution(lead, candidate, 'fresh');
      await incrementBatchCount(candidate.id);
      await syncToCustomerSheet(lead, candidate);

      distributions.push({
        customer_email: candidate.customer_email,
        batch_id: candidate.id,
        distribution_type: 'fresh',
        distance_km: candidate.distance_km
      });

      console.log(`✅ Distributed to ${candidate.customer_email} (fresh, ${candidate.match_reason})`);
    } catch (error) {
      console.error(`❌ Failed to distribute to ${candidate.customer_email}:`, error);
    }
  }

  return distributions;
}

/**
 * Distribute to reuse-eligible customers (max 2)
 */
async function distributeToReuseCustomers(
  lead: Lead,
  candidates: DistributionCandidate[]
): Promise<Array<{ customer_email: string; batch_id: string; distribution_type: string; distance_km?: number }>> {
  const distributions = [];
  const maxDistributions = 2;

  for (let i = 0; i < Math.min(maxDistributions, candidates.length); i++) {
    const candidate = candidates[i];

    try {
      await createDistribution(lead, candidate, 'reuse_30d');
      // Note: Reuse distributions do NOT count towards batch (bonus leads)
      await syncToCustomerSheet(lead, candidate);

      distributions.push({
        customer_email: candidate.customer_email,
        batch_id: candidate.id,
        distribution_type: 'reuse_30d',
        distance_km: candidate.distance_km
      });

      console.log(`✅ Distributed to ${candidate.customer_email} (30d reuse, BONUS)`);
    } catch (error) {
      console.error(`❌ Failed to reuse distribute to ${candidate.customer_email}:`, error);
    }
  }

  return distributions;
}

/**
 * Create distribution record in database
 */
async function createDistribution(
  lead: Lead,
  candidate: DistributionCandidate,
  distributionType: string
): Promise<void> {
  const supabase = createServerClient();
  const daysSinceFirstSeen = Math.floor(
    (Date.now() - new Date(lead.first_seen_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysSinceLastSeen = Math.floor(
    (Date.now() - new Date(lead.last_seen_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const { error } = await supabase
    .from('lead_distributions')
    .insert({
      lead_id: lead.id,
      customer_email: candidate.customer_email,
      batch_id: candidate.id,
      distributed_at: new Date().toISOString(),
      distribution_type: distributionType,
      distance_km: candidate.distance_km,
      territory_match_type: candidate.territory_type,
      priority_score: candidate.priority_score,
      days_since_first_seen: daysSinceFirstSeen,
      days_since_last_seen: daysSinceLastSeen,
      previous_distribution_count: lead.total_distribution_count,
      is_returning_lead: lead.form_submission_count > 1,
      is_reuse_distribution: distributionType === 'reuse_30d',
      counts_towards_batch: distributionType !== 'reuse_30d',
      added_to_sheet: false
    });

  if (error) {
    throw new Error(`Failed to create distribution: ${error.message}`);
  }
}

/**
 * Increment batch count for customer
 */
async function incrementBatchCount(batchId: string): Promise<void> {
  const supabase = createServerClient();
  // First fetch current count
  const { data: batch } = await supabase
    .from('customer_batches')
    .select('current_batch_count, total_batch_size')
    .eq('id', batchId)
    .single();

  if (!batch) return;

  const newCount = batch.current_batch_count + 1;

  // Update count and check if batch is now full
  const { error } = await supabase
    .from('customer_batches')
    .update({
      current_batch_count: newCount,
      last_lead_received_at: new Date().toISOString(),
      is_completed: newCount >= batch.total_batch_size,
      is_active: newCount < batch.total_batch_size,
      ...(newCount >= batch.total_batch_size && {
        completed_at: new Date().toISOString()
      })
    })
    .eq('id', batchId);

  if (error) {
    console.error('Failed to increment batch count:', error);
  } else if (newCount >= batch.total_batch_size) {
    console.log(`🎉 Batch ${batchId} is now complete!`);
    // TODO: Send notification to customer
  }
}

/**
 * Sync lead to customer's Google Sheet using branch-specific field mappings
 */
async function syncToCustomerSheet(
  lead: Lead,
  candidate: DistributionCandidate
): Promise<void> {
  try {
    console.log(`📊 Syncing to sheet for ${candidate.customer_email}`);
    
    const supabase = createServerClient();
    
    // 1. Get branch field mappings for this branch
    const { data: mappings, error: mappingError } = await supabase
      .from('branch_field_mappings')
      .select('sheet_column_name, lead_field_path')
      .eq('branch_id', candidate.branch_id);
    
    if (mappingError || !mappings || mappings.length === 0) {
      console.error(`⚠️ No field mappings found for branch ${candidate.branch_id}`);
      throw new Error(`No field mappings configured for branch ${candidate.branch_id}`);
    }
    
    console.log(`📋 Found ${mappings.length} field mappings for branch ${candidate.branch_id}`);
    
    // 2. Build row data using mappings
    const rowData: Record<string, any> = {};
    
    for (const mapping of mappings) {
      const sheetColumn = mapping.sheet_column_name;
      const leadFieldPath = mapping.lead_field_path;
      
      // Resolve lead field value (supports nested paths like "branchData.postcode")
      let value: any;
      
      if (leadFieldPath.includes('.')) {
        // Handle nested path (e.g., "branchData.postcode")
        const parts = leadFieldPath.split('.');
        value = lead;
        for (const part of parts) {
          value = value?.[part];
        }
      } else {
        // Handle direct field (e.g., "email", "phone")
        value = (lead as any)[leadFieldPath];
      }
      
      // Convert value to string (Google Sheets expects strings)
      rowData[sheetColumn] = value !== null && value !== undefined ? String(value) : '';
    }
    
    console.log(`📝 Mapped lead data to ${Object.keys(rowData).length} columns:`, rowData);
    
    // 3. Sync to Google Sheets
    const { addRowToSheet } = await import('./googleSheetsAPI');
    
    await addRowToSheet(
      candidate.spreadsheet_url,
      rowData,
      candidate.sheet_name || 'Leads',
      process.env.GOOGLE_SHEETS_API_KEY
    );
    
    console.log(`✅ Successfully synced to sheet for ${candidate.customer_email}`);
    
    // 4. Update distribution record
    await supabase
      .from('lead_distributions')
      .update({
        added_to_sheet: true,
        synced_at: new Date().toISOString()
      })
      .eq('lead_id', lead.id)
      .eq('customer_email', candidate.customer_email)
      .order('distributed_at', { ascending: false })
      .limit(1);
      
  } catch (error) {
    console.error('Failed to sync to sheet:', error);
    
    // Log sync error to distribution record
    const supabase = createServerClient();
    await supabase
      .from('lead_distributions')
      .update({
        sheet_sync_error: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('lead_id', lead.id)
      .eq('customer_email', candidate.customer_email)
      .order('distributed_at', { ascending: false })
      .limit(1);
    
    throw error;  // Re-throw to mark distribution as failed
  }
}

/**
 * Update lead's distribution stats
 */
async function updateLeadDistributionStats(
  leadId: string,
  newDistributionsCount: number
): Promise<void> {
  const supabase = createServerClient();
  // Fetch current stats
  const { data: lead } = await supabase
    .from('leads')
    .select('total_distribution_count, unique_customers_count')
    .eq('id', leadId)
    .single();

  if (!lead) return;

  const { error } = await supabase
    .from('leads')
    .update({
      total_distribution_count: lead.total_distribution_count + newDistributionsCount,
      unique_customers_count: lead.unique_customers_count + newDistributionsCount
    })
    .eq('id', leadId);

  if (error) {
    console.error('Failed to update lead stats:', error);
  }
}

/**
 * Get lead distribution history (for admin UI)
 */
export async function getLeadDistributionHistory(leadId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('lead_distributions')
    .select(`
      *,
      customer:customers!lead_distributions_customer_email_fkey(
        email,
        company_name,
        contact_person
      ),
      batch:customer_batches!lead_distributions_batch_id_fkey(
        batch_number,
        total_batch_size,
        current_batch_count
      )
    `)
    .eq('lead_id', leadId)
    .order('distributed_at', { ascending: true });

  if (error) {
    console.error('Error fetching distribution history:', error);
    return [];
  }

  return data;
}

