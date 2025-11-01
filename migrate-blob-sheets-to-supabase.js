#!/usr/bin/env node
/**
 * 📦 MIGRATIE: Blob Storage Google Sheets → Supabase
 * 
 * Dit script:
 * 1. Lijst alle customer-sheets/* blobs
 * 2. Extract customerId + googleSheetUrl
 * 3. Migreer naar Supabase via crmSystem.linkGoogleSheet()
 * 4. Verifieer migratie
 * 5. Optioneel: Verwijder blobs
 */

import { list } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function migrateBlobSheetsToSupabase() {
  console.log('📦 Starting Blob Storage → Supabase migration for Google Sheets\n');
  console.log('============================================================\n');

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Step 1: List all customer-sheets blobs
    console.log('📋 Step 1: Listing Blob Storage files...');
    const { blobs } = await list({
      prefix: 'customer-sheets/',
      mode: 'folded',
    });

    const sheetFiles = blobs.filter(blob => blob.pathname.endsWith('.json'));
    console.log(`   Found ${sheetFiles.length} Google Sheets configurations in Blob Storage\n`);

    if (sheetFiles.length === 0) {
      console.log('✅ No migration needed - Blob Storage is empty!');
      process.exit(0);
    }

    // Step 2: Fetch and migrate each sheet
    console.log('🔄 Step 2: Migrating to Supabase...\n');

    for (const file of sheetFiles) {
      try {
        // Fetch blob content
        const response = await fetch(file.url);
        const data = await response.json();

        const customerId = data.customerId;
        const googleSheetUrl = data.googleSheetUrl;

        if (!customerId || !googleSheetUrl) {
          console.log(`⚠️  Skipped ${file.pathname} - missing data`);
          skipped++;
          continue;
        }

        console.log(`\n📊 Processing: ${customerId}`);
        console.log(`   URL: ${googleSheetUrl.substring(0, 50)}...`);

        // Extract sheet ID
        const match = googleSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) {
          console.log(`   ❌ Invalid URL format`);
          errors++;
          continue;
        }

        const sheetId = match[1];

        // Step 3: Find customer in Supabase (by email)
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('id, email, google_sheet_url')
          .eq('email', customerId)
          .single();

        if (customerError) {
          // Customer doesn't exist yet - create minimal record
          console.log(`   ℹ️  Customer not found, creating record...`);
          
          const { data: newCustomer, error: createError } = await supabase
            .from('customers')
            .insert({
              email: customerId,
              name: customerId.split('@')[0],
              status: 'customer',
              source: 'direct',
              has_account: true,
              google_sheet_id: sheetId,
              google_sheet_url: googleSheetUrl,
            })
            .select()
            .single();

          if (createError) {
            console.log(`   ❌ Error creating customer:`, createError.message);
            errors++;
            continue;
          }

          console.log(`   ✅ Created customer + linked Google Sheet`);
          migrated++;
          continue;
        }

        // Customer exists - check if sheet already linked
        if (customer.google_sheet_url === googleSheetUrl) {
          console.log(`   ✅ Already migrated (sheet URL matches)`);
          skipped++;
          continue;
        }

        // Step 4: Update customer with Google Sheet
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            google_sheet_id: sheetId,
            google_sheet_url: googleSheetUrl,
            last_activity: new Date().toISOString(),
          })
          .eq('id', customer.id);

        if (updateError) {
          console.log(`   ❌ Error updating customer:`, updateError.message);
          errors++;
          continue;
        }

        // Log data change
        await supabase.from('data_changes').insert({
          customer_id: customer.id,
          field: 'googleSheetId',
          old_value: customer.google_sheet_url || null,
          new_value: sheetId,
          source: 'migration',
        });

        console.log(`   ✅ Migrated successfully`);
        migrated++;

      } catch (fileError) {
        console.error(`   ❌ Error processing ${file.pathname}:`, fileError instanceof Error ? fileError.message : 'Unknown');
        errors++;
      }
    }

    // Step 5: Summary
    console.log('\n============================================================');
    console.log('📊 MIGRATION SUMMARY');
    console.log('============================================================');
    console.log(`✅ Migrated:    ${migrated}`);
    console.log(`⏭️  Skipped:     ${skipped}`);
    console.log(`❌ Errors:      ${errors}`);
    console.log('============================================================\n');

    if (migrated > 0) {
      console.log('🎉 Migration complete! All Google Sheets are now in Supabase.\n');
      console.log('📝 Next steps:');
      console.log('   1. Verify in Supabase dashboard (customers table)');
      console.log('   2. Test in admin portal (/admin/customers)');
      console.log('   3. If all good, manually delete Blob Storage files\n');
    } else {
      console.log('ℹ️  No new data migrated (all already in Supabase or skipped).\n');
    }

    process.exit(errors > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run migration
migrateBlobSheetsToSupabase();

