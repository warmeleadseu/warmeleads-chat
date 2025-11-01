/**
 * Script om te verifiëren of alle benodigde Supabase tabellen bestaan
 * Run: node verify-supabase-tables.js
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Lijst van alle benodigde tabellen
const requiredTables = [
  'users',
  'companies',
  'employees',
  'customers',
  'chat_messages',
  'data_changes',
  'orders',
  'open_invoices',
  'leads',
  'lead_branch_data',
  'user_preferences',
  'lead_reclamations',
  'pricing_config'
];

async function verifyTables() {
  console.log('🔍 Verifying Supabase tables...\n');
  
  const results = {
    existing: [],
    missing: []
  };

  for (const tableName of requiredTables) {
    try {
      // Try to query the table (limit 0 to not fetch data, just check existence)
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);

      if (error) {
        // Check if it's a "table doesn't exist" error
        if (error.message.includes('does not exist') || error.code === '42P01') {
          console.log(`❌ Missing: ${tableName}`);
          results.missing.push(tableName);
        } else {
          console.log(`⚠️  ${tableName}: ${error.message}`);
          results.missing.push(tableName);
        }
      } else {
        console.log(`✅ Exists: ${tableName}`);
        results.existing.push(tableName);
      }
    } catch (err) {
      console.log(`❌ Error checking ${tableName}:`, err.message);
      results.missing.push(tableName);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Existing tables: ${results.existing.length}/${requiredTables.length}`);
  console.log(`❌ Missing tables: ${results.missing.length}/${requiredTables.length}`);
  
  if (results.missing.length > 0) {
    console.log('\n🚨 MISSING TABLES:');
    results.missing.forEach(table => console.log(`   - ${table}`));
    console.log('\n📝 ACTION REQUIRED:');
    console.log('   Run the SQL script in Supabase SQL Editor:');
    console.log('   1. Open Supabase Dashboard');
    console.log('   2. Go to SQL Editor');
    console.log('   3. Copy/paste supabase-schema-complete.sql');
    console.log('   4. Execute');
    console.log('   5. Run this verification script again');
    return false;
  } else {
    console.log('\n✅ ALL TABLES EXIST! Database is ready for migration.');
    return true;
  }
}

verifyTables()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });

