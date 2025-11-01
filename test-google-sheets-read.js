#!/usr/bin/env node
/**
 * TEST: Read leads directly from Google Sheets
 * 
 * Tests if we can read the 35 leads from h.schlimback@gmail.com's sheet
 */

import 'dotenv/config';

const sheetUrl = 'https://docs.google.com/spreadsheets/d/1KkbnT2JU_xq87y0BEfPdQv0pgSXYGRu_4GJiIJl_Owg/edit?gid=0#gid=0';

async function testGoogleSheetsRead() {
  console.log('\n🧪 TESTING GOOGLE SHEETS READ');
  console.log('='.repeat(60));
  console.log(`Sheet URL: ${sheetUrl}\n`);

  try {
    // Import the readCustomerLeads function
    const { readCustomerLeads } = await import('./src/lib/googleSheetsAPI.ts');
    
    console.log('📊 Reading leads from Google Sheets...');
    const leads = await readCustomerLeads(sheetUrl);
    
    console.log(`\n✅ Successfully read ${leads.length} leads from Google Sheets!`);
    
    if (leads.length > 0) {
      console.log('\n📋 First 5 leads:');
      leads.slice(0, 5).forEach((lead, i) => {
        console.log(`   ${i + 1}. ${lead.name || 'No name'}`);
        console.log(`      Email: ${lead.email || 'No email'}`);
        console.log(`      Phone: ${lead.phone || 'No phone'}`);
        console.log(`      Status: ${lead.status || 'No status'}`);
        console.log('');
      });
    }
    
    console.log('='.repeat(60));
    console.log(`✅ Total leads in sheet: ${leads.length}`);
    console.log('='.repeat(60));
    
    if (leads.length === 35) {
      console.log('\n🎉 PERFECT! The sheet has exactly 35 leads as expected!');
    } else {
      console.log(`\n⚠️ Expected 35 leads, but found ${leads.length}`);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error(error);
    process.exit(1);
  }
}

// Run test
testGoogleSheetsRead();

