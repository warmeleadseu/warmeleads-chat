/**
 * API Route: Test Real Meta Form Leads with Current Admin Setup
 * 
 * This endpoint:
 * 1. Uses META_ACCESS_TOKEN from environment
 * 2. Fetches real leads from the specified Meta form
 * 3. Checks current admin configuration (branches, batches, forms)
 * 4. Simulates distribution for each lead
 * 5. Shows detailed results
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface MetaLead {
  id: string;
  created_time: string;
  field_data: Array<{
    name: string;
    values: string[];
  }>;
}

export async function POST(request: NextRequest) {
  const logs: string[] = [];
  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    logs.push(`[${timestamp}] ${message}`);
    console.log(`[META-TEST] ${message}`);
  };

  try {
    const { formId } = await request.json();

    if (!formId) {
      return NextResponse.json({
        success: false,
        error: 'Form ID is required',
        logs,
      }, { status: 400 });
    }

    addLog(`=== TESTING WITH REAL META FORM ===`);
    addLog(`Form ID: ${formId}`);

    // 1. Check if META_ACCESS_TOKEN exists
    const accessToken = process.env.META_ACCESS_TOKEN;
    
    if (!accessToken) {
      addLog(`❌ META_ACCESS_TOKEN not found in environment!`);
      return NextResponse.json({
        success: false,
        error: 'META_ACCESS_TOKEN not configured',
        logs,
      }, { status: 500 });
    }

    addLog(`✓ META_ACCESS_TOKEN found`);

    // 2. Fetch leads from Meta API
    addLog(`\n[STEP 1] Fetching leads from Meta API...`);
    
    const metaUrl = `https://graph.facebook.com/v18.0/${formId}/leads?access_token=${accessToken}&limit=10`;
    
    let metaLeads: MetaLead[] = [];
    
    try {
      const metaResponse = await fetch(metaUrl);
      const metaData = await metaResponse.json();
      
      if (metaData.error) {
        addLog(`❌ Meta API Error: ${metaData.error.message}`);
        return NextResponse.json({
          success: false,
          error: `Meta API Error: ${metaData.error.message}`,
          logs,
        }, { status: 400 });
      }
      
      metaLeads = metaData.data || [];
      addLog(`✓ Fetched ${metaLeads.length} leads from Meta`);
      
    } catch (error: any) {
      addLog(`❌ Failed to fetch from Meta: ${error.message}`);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch leads: ${error.message}`,
        logs,
      }, { status: 500 });
    }

    if (metaLeads.length === 0) {
      addLog(`⚠️  No leads found on this form`);
      return NextResponse.json({
        success: true,
        message: 'No leads found on this form',
        metaLeads: [],
        logs,
      });
    }

    // 3. Check current admin configuration
    addLog(`\n[STEP 2] Checking current admin configuration...`);
    
    const supabase = createServerClient();

    // Check if form is registered
    const { data: registeredForm } = await supabase
      .from('meta_lead_forms')
      .select('*')
      .eq('form_id', formId)
      .single();

    if (!registeredForm) {
      addLog(`⚠️  Form ${formId} not registered in admin!`);
      addLog(`   → Go to /admin/lead-forms to add it`);
    } else {
      addLog(`✓ Form registered: ${registeredForm.form_name}`);
      addLog(`   Branch: ${registeredForm.branch_id}`);
    }

    // Check active batches for this branch
    let activeBatches = [];
    
    if (registeredForm) {
      const { data: batches } = await supabase
        .from('customer_batches')
        .select(`
          *,
          customers!customer_batches_customer_email_fkey(
            company_name,
            contact_person
          )
        `)
        .eq('branch_id', registeredForm.branch_id)
        .eq('is_active', true);

      activeBatches = batches || [];
      
      addLog(`✓ Found ${activeBatches.length} active batches for branch ${registeredForm.branch_id}`);
      
      activeBatches.forEach((batch: any) => {
        const customer = Array.isArray(batch.customers) ? batch.customers[0] : batch.customers;
        const customerName = customer?.company_name || customer?.contact_person || batch.customer_email;
        addLog(`   - ${customerName}: ${batch.current_batch_count}/${batch.total_batch_size} leads`);
        addLog(`     Territory: ${batch.territory_type}${batch.territory_type === 'radius' ? ` (${batch.radius_km}km from ${batch.center_postcode})` : ''}`);
      });
    }

    // Check branch configuration
    if (registeredForm) {
      const { data: branchMappings } = await supabase
        .from('branch_field_mappings')
        .select('*')
        .eq('branch_id', registeredForm.branch_id);

      if (!branchMappings || branchMappings.length === 0) {
        addLog(`⚠️  No field mappings configured for branch ${registeredForm.branch_id}!`);
        addLog(`   → Go to /admin/branches to configure spreadsheet mappings`);
      } else {
        addLog(`✓ Branch has ${branchMappings.length} field mappings configured`);
      }
    }

    // 4. Parse leads and show what would happen
    addLog(`\n[STEP 3] Analyzing leads...`);
    
    const parsedLeads = metaLeads.slice(0, 5).map((metaLead: MetaLead) => {
      const fieldData: Record<string, string> = {};
      
      metaLead.field_data.forEach((field: any) => {
        fieldData[field.name] = field.values?.[0] || '';
      });

      return {
        meta_id: metaLead.id,
        created_at: metaLead.created_time,
        email: fieldData['email'] || fieldData['e_mail'] || 'N/A',
        phone: fieldData['phone_number'] || fieldData['telefoon'] || 'N/A',
        name: fieldData['full_name'] || fieldData['naam'] || 'N/A',
        postcode: fieldData['zip'] || fieldData['postcode'] || 'N/A',
        raw_fields: Object.keys(fieldData),
      };
    });

    addLog(`\nShowing first ${parsedLeads.length} leads:\n`);
    
    parsedLeads.forEach((lead, index) => {
      addLog(`Lead ${index + 1}:`);
      addLog(`  Email: ${lead.email}`);
      addLog(`  Name: ${lead.name}`);
      addLog(`  Phone: ${lead.phone}`);
      addLog(`  Postcode: ${lead.postcode}`);
      addLog(`  Created: ${new Date(lead.created_at).toLocaleString('nl-NL')}`);
      addLog(`  Available fields: ${lead.raw_fields.join(', ')}`);
      addLog('');
    });

    // 5. Summary and recommendations
    addLog(`\n=== SUMMARY ===`);
    addLog(`\n📊 Current Setup:`);
    addLog(`   • Form registered: ${registeredForm ? '✅' : '❌'}`);
    addLog(`   • Active batches: ${activeBatches.length}`);
    addLog(`   • Leads available: ${metaLeads.length}`);
    
    addLog(`\n💡 Next Steps:`);
    
    if (!registeredForm) {
      addLog(`   1. Register this form in /admin/lead-forms`);
      addLog(`   2. Link it to the correct branch`);
    }
    
    if (registeredForm && activeBatches.length === 0) {
      addLog(`   1. Create customer batches in /admin/batches`);
      addLog(`   2. Make sure they're active and have capacity`);
    }
    
    if (registeredForm && activeBatches.length > 0) {
      addLog(`   ✅ System is ready! Leads would be distributed to ${activeBatches.length} customer(s)`);
    }

    return NextResponse.json({
      success: true,
      formId,
      metaAccessTokenExists: !!accessToken,
      totalLeads: metaLeads.length,
      formRegistered: !!registeredForm,
      branchId: registeredForm?.branch_id,
      activeBatches: activeBatches.length,
      sampleLeads: parsedLeads,
      logs,
    });

  } catch (error: any) {
    addLog(`\n❌ ERROR: ${error.message}`);
    console.error('Meta form test error:', error);

    return NextResponse.json({
      success: false,
      error: error.message,
      logs,
    }, { status: 500 });
  }
}

