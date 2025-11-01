/**
 * Direct SQL migration script - bypasses PostgREST cache issues
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const HARDCODED_ACCOUNTS = [
  {
    email: 'demo@warmeleads.eu',
    password: 'demo123',
    name: 'Demo User',
    company: 'Demo Company',
    phone: '+31 85 047 7067',
    role: 'owner' as const
  },
  {
    email: 'h.schlimback@gmail.com',
    password: 'Ab49n805!',
    name: 'H Schlimback',
    company: 'WarmeLeads BV',
    phone: '+31 61 392 7338',
    role: 'owner' as const
  },
  {
    email: 'rick@warmeleads.eu',
    password: 'Ab49n805!',
    name: 'Rick',
    company: 'WarmeLeads BV',
    phone: '+31 61 392 7338',
    role: 'owner' as const
  }
];

async function migrateWithSQL() {
  console.log('🚀 Starting direct SQL migration...\n');
  
  let totalMigrated = 0;
  
  for (const account of HARDCODED_ACCOUNTS) {
    try {
      const email = account.email.toLowerCase();
      const passwordHash = await bcrypt.hash(account.password, 10);
      
      console.log(`Migrating: ${email}...`);
      
      // Use raw SQL to insert
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          INSERT INTO users (
            email, password_hash, name, company, phone, role,
            can_view_leads, can_view_orders, can_manage_employees, can_checkout,
            is_active, needs_password_reset
          ) VALUES (
            '${email}',
            '${passwordHash}',
            '${account.name}',
            ${account.company ? `'${account.company}'` : 'NULL'},
            ${account.phone ? `'${account.phone}'` : 'NULL'},
            '${account.role}',
            true, true, true, true, true, false
          )
          ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            name = EXCLUDED.name,
            company = EXCLUDED.company,
            phone = EXCLUDED.phone,
            last_login = NOW()
          RETURNING email;
        `
      });
      
      if (error) {
        // If RPC doesn't exist, use direct insert with auth override
        const { data: insertData, error: insertError } = await supabase.auth.admin.createUser({
          email: email,
          password: account.password,
          email_confirm: true,
          user_metadata: {
            name: account.name,
            company: account.company,
            phone: account.phone,
            role: account.role
          }
        });
        
        if (insertError && !insertError.message.includes('already exists')) {
          console.error(`❌ Failed: ${email} -`, insertError.message);
          continue;
        }
        
        // Now insert into our users table
        const { error: userError } = await supabase
          .from('users')
          .upsert({
            email: email,
            password_hash: passwordHash,
            name: account.name,
            company: account.company || null,
            phone: account.phone || null,
            role: account.role,
            can_view_leads: true,
            can_view_orders: true,
            can_manage_employees: true,
            can_checkout: true,
            is_active: true,
            needs_password_reset: false
          }, {
            onConflict: 'email'
          });
        
        if (userError) {
          console.error(`❌ Failed to insert user: ${email} -`, userError.message);
          continue;
        }
      }
      
      console.log(`✅ Migrated: ${email}`);
      totalMigrated++;
      
      // Create company if needed
      if (account.company) {
        await supabase
          .from('companies')
          .upsert({
            owner_email: email,
            company_name: account.company
          }, {
            onConflict: 'owner_email'
          });
      }
      
    } catch (error) {
      console.error(`❌ Error migrating ${account.email}:`, error);
    }
  }
  
  console.log(`\n✅ Migration complete! Migrated ${totalMigrated} accounts\n`);
  
  // Verify
  const { data: users } = await supabase
    .from('users')
    .select('email, name, role, company');
  
  if (users) {
    console.log('📊 Users in database:');
    users.forEach(u => console.log(`  - ${u.email} (${u.name}) [${u.role}]`));
  }
}

migrateWithSQL()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });

