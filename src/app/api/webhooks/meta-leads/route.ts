/**
 * Meta/Facebook Leads Webhook Endpoint
 * Central lead pool system - receives leads and intelligently distributes them
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { processAndDistributeLead } from '@/lib/centralLeadDistribution';
import { postcodeToCoords } from '@/lib/geographicUtils';

// Meta App verification token (should match what's set in Meta)
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'warmeleads_verify_token';

export async function GET(request: NextRequest) {
  // Meta webhook verification
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Meta webhook verified successfully');
    return new Response(challenge, { status: 200 });
  }

  console.error('❌ Meta webhook verification failed');
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    console.log('📨 Received Meta webhook');

    // 1. Verify webhook signature (if enabled)
    const signature = request.headers.get('x-hub-signature-256');
    const body = await request.text();

    // TODO: Implement signature verification for production
    // const isValidSignature = verifySignature(body, signature);
    // if (!isValidSignature) {
    //   console.error('❌ Invalid webhook signature');
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    // }

    // 2. Parse webhook payload
    const payload = JSON.parse(body);
    console.log(`📦 Processing ${payload.entry?.length || 0} entries`);

    // 3. Process each lead
    const results = [];

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'leadgen') {
          const leadData = change.value;
          const result = await processMetaLead(leadData);
          results.push(result);
        }
      }
    }

    console.log(`✅ Processed ${results.length} leads`);
    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('❌ Meta webhook error:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Process a single Meta lead through central distribution system
 */
async function processMetaLead(metaLeadData: any): Promise<{
  leadId: string;
  status: 'distributed' | 'no_customers' | 'error';
  distributionsCount: number;
  distributedTo: string[];
  reason?: string;
}> {
  const supabase = createServerClient();

  try {
    console.log(`🎯 Processing Meta lead ${metaLeadData.id}`);

    // 1. Log incoming lead in processing table
    const processingLogId = await logLeadProcessing(metaLeadData, 'received');

    // 2. Extract lead data from Meta format
    const leadData = await extractLeadDataFromMeta(metaLeadData);

    if (!leadData.email) {
      await updateProcessingLog(processingLogId, {
        processing_status: 'no_eligible_customers',
        error_message: 'No email found in lead data'
      });
      return {
        leadId: metaLeadData.id,
        status: 'error',
        distributionsCount: 0,
        distributedTo: [],
        reason: 'No email found'
      };
    }

    // 3. Get coordinates if postcode is available
    if (leadData.postcode && !leadData.lat) {
      const coords = await postcodeToCoords(leadData.postcode);
      if (coords) {
        leadData.lat = coords.lat;
        leadData.lng = coords.lng;
      }
    }

    // 4. Process through central distribution engine
    const distributionResult = await processAndDistributeLead({
      email: leadData.email!,
      phone: leadData.phone,
      name: leadData.name,
      branch: leadData.branch || 'general',
      postcode: leadData.postcode,
      address: leadData.address,
      lat: leadData.lat,
      lng: leadData.lng,
      source: 'meta_ads',
      meta_lead_id: metaLeadData.id
    });

    // 5. Update processing log
    await updateProcessingLog(processingLogId, {
      email: leadData.email,
      phone: leadData.phone,
      name: leadData.name,
      branch_id: leadData.branch,
      postcode: leadData.postcode,
      processing_status: distributionResult.success 
        ? (distributionResult.distributions_made > 0 ? 'distributed' : 'no_eligible_customers')
        : 'no_eligible_customers',
      is_duplicate: distributionResult.details.some(d => d.distribution_type !== 'fresh'),
      distributions_made: distributionResult.distributions_made,
      distributed_to_customers: distributionResult.distributed_to,
      processed_at: new Date().toISOString(),
      error_message: distributionResult.error
    });

    if (distributionResult.success && distributionResult.distributions_made > 0) {
      return {
        leadId: metaLeadData.id,
        status: 'distributed',
        distributionsCount: distributionResult.distributions_made,
        distributedTo: distributionResult.distributed_to
      };
    } else {
      return {
        leadId: metaLeadData.id,
        status: 'no_customers',
        distributionsCount: 0,
        distributedTo: [],
        reason: distributionResult.error || 'No eligible customers found'
      };
    }

  } catch (error) {
    console.error(`❌ Error processing lead ${metaLeadData.id}:`, error);

    // Update processing log with error
    if (metaLeadData.id) {
      try {
        const processingLogId = await logLeadProcessing(metaLeadData, 'received');
        await updateProcessingLog(processingLogId, {
          processing_status: 'no_eligible_customers',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (logError) {
        console.error('Failed to log processing error:', logError);
      }
    }

    return {
      leadId: metaLeadData.id,
      status: 'error',
      distributionsCount: 0,
      distributedTo: [],
      reason: error instanceof Error ? error.message : 'Processing error'
    };
  }
}

/**
 * Extract lead data from Meta webhook format
 */
async function extractLeadDataFromMeta(metaLeadData: any): Promise<{
  email?: string;
  phone?: string;
  name?: string;
  branch?: string;
  postcode?: string;
  address?: string;
  lat?: number;
  lng?: number;
}> {
  const fieldData = metaLeadData.field_data || [];
  
  const result: any = {};

  for (const field of fieldData) {
    const fieldName = field.name?.toLowerCase() || '';
    const value = field.values?.[0];

    if (!value) continue;

    // Match email
    if (fieldName.includes('email') || fieldName.includes('e-mail')) {
      result.email = value;
    }
    // Match phone
    else if (fieldName.includes('phone') || fieldName.includes('telefoon') || fieldName.includes('mobiel')) {
      result.phone = value;
    }
    // Match name
    else if (fieldName.includes('name') || fieldName.includes('naam') || fieldName.includes('full_name')) {
      result.name = value;
    }
    // Match postcode
    else if (fieldName.includes('postcode') || fieldName.includes('postal') || fieldName.includes('zip')) {
      result.postcode = value;
    }
    // Match address
    else if (fieldName.includes('address') || fieldName.includes('adres') || fieldName.includes('straat')) {
      result.address = value;
    }
  }

  // Get branch from form ID lookup
  const formId = metaLeadData.form_id;
  if (formId) {
    const supabase = createServerClient();
    const { data: form } = await supabase
      .from('meta_lead_forms')
      .select('branch_id')
      .eq('form_id', formId)
      .eq('is_active', true)
      .single();

    if (form) {
      result.branch = form.branch_id;
      
      // Update form stats
      const { data: currentForm } = await supabase
        .from('meta_lead_forms')
        .select('total_leads_received')
        .eq('form_id', formId)
        .single();

      await supabase
        .from('meta_lead_forms')
        .update({
          total_leads_received: (currentForm?.total_leads_received || 0) + 1,
          last_lead_received_at: new Date().toISOString()
        })
        .eq('form_id', formId);
    }
  }

  // Fallback: try to extract branch from campaign/form name
  if (!result.branch) {
    const campaignName = metaLeadData.campaign_name?.toLowerCase() || '';
    const formName = metaLeadData.form_name?.toLowerCase() || '';
    
    if (campaignName.includes('thuisbatterij') || formName.includes('thuisbatterij')) {
      result.branch = 'thuisbatterijen';
    } else if (campaignName.includes('zonnepanelen') || formName.includes('zonnepanelen')) {
      result.branch = 'zonnepanelen';
    } else if (campaignName.includes('kozijn') || formName.includes('kozijn')) {
      result.branch = 'kozijnen';
    } else if (campaignName.includes('airco') || formName.includes('airco')) {
      result.branch = 'airco';
    } else {
      result.branch = 'general';
    }
  }

  return result;
}

/**
 * Log lead processing in the database
 */
async function logLeadProcessing(metaLeadData: any, status: string): Promise<string> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('meta_lead_processing')
    .insert({
      meta_lead_id: metaLeadData.id,
      raw_meta_data: metaLeadData,
      processing_status: status,
      received_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to log lead processing: ${error.message}`);
  }

  return data.id;
}

/**
 * Update processing log
 */
async function updateProcessingLog(logId: string, updates: any): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('meta_lead_processing')
    .update(updates)
    .eq('id', logId);

  if (error) {
    console.error('Failed to update processing log:', error);
  }
}
