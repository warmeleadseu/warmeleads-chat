#!/usr/bin/env node
/**
 * TEST: Customer Data API
 * 
 * This script simulates what happens when the CustomerPortal calls /api/customer-data
 */

import 'dotenv/config';

const API_BASE = process.env.NEXT_PUBLIC_VERCEL_URL 
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
  : 'http://localhost:3000';

const targetEmail = 'h.schlimback@gmail.com';
const sessionToken = '2'; // From debug script

async function testCustomerDataAPI() {
  console.log('\n🧪 TESTING CUSTOMER DATA API');
  console.log('='.repeat(60));
  console.log(`Target: ${targetEmail}`);
  console.log(`Token: ${sessionToken}`);
  console.log(`API: ${API_BASE}\n`);

  try {
    const url = `${API_BASE}/api/customer-data?customerId=${encodeURIComponent(targetEmail)}`;
    console.log(`📡 GET ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📊 Response: ${response.status} ${response.statusText}`);

    const data = await response.json();
    
    if (response.ok) {
      console.log('\n✅ API call successful!');
      console.log(`   Customer: ${data.customerData?.email}`);
      console.log(`   Name: ${data.customerData?.name}`);
      console.log(`   Google Sheet: ${data.customerData?.googleSheetUrl ? 'LINKED' : 'NOT LINKED'}`);
      console.log(`   Leads count: ${data.customerData?.leadData?.length || 0}`);
      
      if (data.customerData?.leadData && data.customerData.leadData.length > 0) {
        console.log('\n📊 Sample leads:');
        data.customerData.leadData.slice(0, 3).forEach((lead, i) => {
          console.log(`   ${i + 1}. ${lead.name || 'No name'} (${lead.email || 'no email'})`);
        });
      }
    } else {
      console.log('\n❌ API call failed!');
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      console.log(`   Details: ${data.details || 'None'}`);
      
      if (response.status === 401) {
        console.log('\n💡 This is an AUTHENTICATION issue!');
        console.log('   The token is not being recognized by the API');
        console.log('   Check:');
        console.log('   1. Is the token being sent correctly?');
        console.log('   2. Does the middleware verify the token properly?');
        console.log('   3. Is the user ID format correct (UUID vs integer)?');
      } else if (response.status === 404) {
        console.log('\n💡 Customer not found in database');
      } else if (response.status === 403) {
        console.log('\n💡 Permission denied - user cannot access this customer');
      }
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error(error);
    process.exit(1);
  }
}

// Run test
testCustomerDataAPI();

