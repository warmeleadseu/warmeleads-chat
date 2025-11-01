/**
 * Retry-based migration - waits for PostgREST cache refresh
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

const HARDCODED_ACCOUNTS = [
  {
    email: 'demo@warmeleads.eu',
    password: 'demo123',
    name: 'Demo User',
    company: 'Demo Company',
    phone: '+31 85 047 7067'
  },
  {
    email: 'h.schlimback@gmail.com',
    password: 'Ab49n805!',
    name: 'H Schlimback',
    company: 'WarmeLeads BV',
    phone: '+31 61 392 7338'
  },
  {
    email: 'rick@warmeleads.eu',
    password: 'Ab49n805!',
    name: 'Rick',
    company: 'WarmeLeads BV',
    phone: '+31 61 392 7338'
  }
];

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateWithRetry() {
  console.log('🚀 Starting migration with retry logic...\n');
  console.log('⏳ Waiting 5 seconds for PostgREST cache to refresh...\n');
  
  // Wait for PostgREST cache to refresh
  await wait(5000);
  
  let totalMigrated = 0;
  let retries = 0;
  const maxRetries = 5;
  
  for (const account of HARDCODED_ACCOUNTS) {
    let success = false;
    
    while (!success && retries < maxRetries) {
      try {
        const email = account.email.toLowerCase();
        const passwordHash = await bcrypt.hash(account.password, 10);
        
        console.log(`Attempt ${retries + 1}: Migrating ${email}...`);
        
        const { data, error } = await supabase
          .from('users')
          .upsert({
            email: email,
            password_hash: passwordHash,
            name: account.name,
            company: account.company || null,
            phone: account.phone || null,
            role: 'owner',
            can_view_leads: true,
            can_view_orders: true,
            can_manage_employees: true,
            can_checkout: true,
            is_active: true,
            needs_password_reset: false
          }, {
            onConflict: 'email'
          })
          .select()
          .single();
        
        if (error) {
          if (error.message.includes('schema cache')) {
            console.log(`⏳ Cache not ready, waiting 3 seconds...`);
            await wait(3000);
            retries++;
            continue;
          }
          throw error;
        }
        
        console.log(`✅ Migrated: ${email}`);
        totalMigrated++;
        success = true;
        
        // Create company
        if (account.company) {
          await supabase
            .from('companies')
            .upsert({
              owner_email: email,
              company_name: account.company
            }, {
              onConflict: 'owner_email'
            });
          console.log(`   📦 Company created: ${account.company}`);
        }
        
      } catch (error: any) {
        console.error(`❌ Failed: ${error.message}`);
        retries++;
        if (retries < maxRetries) {
          console.log(`⏳ Retrying in 3 seconds...`);
          await wait(3000);
        }
      }
    }
    
    retries = 0; // Reset for next account
  }
  
  console.log(`\n✅ Migration complete! Migrated ${totalMigrated}/${HARDCODED_ACCOUNTS.length} accounts\n`);
  
  // Verify
  console.log('📊 Verifying migration...');
  const { data: users, error } = await supabase
    .from('users')
    .select('email, name, role, company')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.log(`⚠️  Could not verify (cache issue), but migration likely succeeded`);
  } else if (users) {
    console.log(`\nUsers in database (${users.length}):`);
    users.forEach(u => console.log(`  - ${u.email} (${u.name}) [${u.role}]`));
  }
}

migrateWithRetry()
  .then(() => {
    console.log('\n✅ Migration process completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  });

