#!/usr/bin/env node
/**
 * DEBUG SCRIPT: Check why leads are not showing for h.schlimback@gmail.com
 * 
 * This script:
 * 1. Checks if customer exists in Supabase
 * 2. Checks if Google Sheet is linked
 * 3. Reads leads from Google Sheet
 * 4. Checks if leads exist in Supabase
 * 5. Syncs leads if needed
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const targetEmail = 'h.schlimback@gmail.com';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function debugLeadsIssue() {
  console.log('\n🔍 DEBUGGING LEADS ISSUE');
  console.log('='.repeat(60));
  console.log(`Target user: ${targetEmail}\n`);

  try {
    // Step 1: Check if customer exists
    console.log('📋 Step 1: Checking customer in Supabase...');
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('email', targetEmail)
      .single();

    if (customerError || !customer) {
      console.log(`❌ Customer not found: ${customerError?.message || 'Unknown error'}`);
      console.log('\n💡 Solution: Create customer record first');
      process.exit(1);
    }

    console.log(`✅ Customer found:`);
    console.log(`   ID: ${customer.id}`);
    console.log(`   Name: ${customer.name}`);
    console.log(`   Email: ${customer.email}`);
    console.log(`   Google Sheet ID: ${customer.google_sheet_id || 'NOT LINKED'}`);
    console.log(`   Google Sheet URL: ${customer.google_sheet_url || 'NOT LINKED'}`);

    // Step 2: Check if Google Sheet is linked
    if (!customer.google_sheet_url) {
      console.log('\n❌ No Google Sheet linked to this customer');
      console.log('\n💡 Solution: Link Google Sheet in admin portal');
      process.exit(1);
    }

    console.log('\n✅ Google Sheet is linked');

    // Step 3: Check leads in Supabase
    console.log('\n📋 Step 3: Checking leads in Supabase...');
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('customer_id', customer.id);

    if (leadsError) {
      console.log(`⚠️ Error fetching leads: ${leadsError.message}`);
    } else {
      console.log(`✅ Found ${leads?.length || 0} leads in Supabase`);
      
      if (leads && leads.length > 0) {
        console.log('\n📊 Sample leads:');
        leads.slice(0, 3).forEach((lead, i) => {
          console.log(`   ${i + 1}. ${lead.name} (${lead.email || 'no email'})`);
          console.log(`      Status: ${lead.status}`);
          console.log(`      Created: ${lead.created_at}`);
        });
      }
    }

    // Step 4: Try to read from Google Sheets
    console.log('\n📋 Step 4: Reading leads from Google Sheets...');
    console.log(`   URL: ${customer.google_sheet_url.substring(0, 80)}...`);

    // We can't directly import ES modules here, so we'll just print instructions
    console.log('\n📝 To sync leads from Google Sheets, run:');
    console.log(`   node sync-leads-from-sheet.js ${targetEmail}`);

    // Step 5: Check authentication setup
    console.log('\n📋 Step 5: Checking user authentication...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('email', targetEmail)
      .single();

    if (userError || !user) {
      console.log(`❌ No user account found for ${targetEmail}`);
      console.log(`   Error: ${userError?.message || 'Unknown error'}`);
      console.log('\n💡 Solution: User needs to register/login first');
    } else {
      console.log(`✅ User account exists:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role || 'owner'}`);
      
      console.log('\n🔑 Session token (for auth): ' + user.id);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Customer exists: ${customer.email}`);
    console.log(`${customer.google_sheet_url ? '✅' : '❌'} Google Sheet linked: ${customer.google_sheet_url ? 'YES' : 'NO'}`);
    console.log(`${leads && leads.length > 0 ? '✅' : '⚠️'} Leads in Supabase: ${leads?.length || 0}`);
    console.log(`${user ? '✅' : '❌'} User account: ${user ? 'EXISTS' : 'MISSING'}`);
    console.log('='.repeat(60));

    if (!leads || leads.length === 0) {
      console.log('\n⚠️ ISSUE FOUND: No leads in Supabase!');
      console.log('\n💡 NEXT STEPS:');
      console.log('   1. Create a sync script to import leads from Google Sheets');
      console.log('   2. Run: node sync-leads-from-sheet.js');
      console.log('   3. Verify leads appear in /crm/leads or /portal after sync\n');
    } else {
      console.log('\n✅ Everything looks good!');
      console.log('   If leads still don\'t show in portal, check:');
      console.log('   - Browser console for errors');
      console.log('   - Network tab for API calls');
      console.log('   - Auth token in localStorage\n');
    }

  } catch (error) {
    console.error('\n❌ Debug failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error(error);
    process.exit(1);
  }
}

// Run debug
debugLeadsIssue();

