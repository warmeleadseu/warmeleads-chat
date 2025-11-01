/**
 * Generate SQL statements for manual execution in Supabase SQL Editor
 * This bypasses all PostgREST cache issues
 */

import bcrypt from 'bcryptjs';

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

async function generateSQL() {
  console.log('🔐 Generating SQL statements...\n');
  console.log('Copy and paste the following SQL into your Supabase SQL Editor:\n');
  console.log('-- ========================================');
  console.log('-- Account Migration SQL');
  console.log('-- ========================================\n');
  
  for (const account of HARDCODED_ACCOUNTS) {
    const email = account.email.toLowerCase();
    const passwordHash = await bcrypt.hash(account.password, 10);
    
    console.log(`-- Account: ${email}`);
    console.log(`INSERT INTO users (`);
    console.log(`  email, password_hash, name, company, phone, role,`);
    console.log(`  can_view_leads, can_view_orders, can_manage_employees, can_checkout,`);
    console.log(`  is_active, needs_password_reset, created_at, updated_at`);
    console.log(`) VALUES (`);
    console.log(`  '${email}',`);
    console.log(`  '${passwordHash}',`);
    console.log(`  '${account.name}',`);
    console.log(`  ${account.company ? `'${account.company}'` : 'NULL'},`);
    console.log(`  ${account.phone ? `'${account.phone}'` : 'NULL'},`);
    console.log(`  'owner',`);
    console.log(`  true, true, true, true,`);
    console.log(`  true, false, NOW(), NOW()`);
    console.log(`)`);
    console.log(`ON CONFLICT (email) DO UPDATE SET`);
    console.log(`  password_hash = EXCLUDED.password_hash,`);
    console.log(`  name = EXCLUDED.name,`);
    console.log(`  company = EXCLUDED.company,`);
    console.log(`  phone = EXCLUDED.phone,`);
    console.log(`  updated_at = NOW();`);
    console.log(``);
    
    if (account.company) {
      console.log(`-- Company for ${email}`);
      console.log(`INSERT INTO companies (owner_email, company_name, created_at, updated_at)`);
      console.log(`VALUES ('${email}', '${account.company}', NOW(), NOW())`);
      console.log(`ON CONFLICT (owner_email) DO UPDATE SET`);
      console.log(`  company_name = EXCLUDED.company_name,`);
      console.log(`  updated_at = NOW();`);
      console.log(``);
    }
  }
  
  console.log('-- ========================================');
  console.log('-- Verify the migration');
  console.log('-- ========================================');
  console.log('SELECT email, name, role, company FROM users ORDER BY created_at DESC;');
  console.log('');
}

generateSQL()
  .then(() => {
    console.log('\n✅ SQL generated successfully!');
    console.log('\nNext steps:');
    console.log('1. Go to https://supabase.com/dashboard/project/klnstthwdtszrqsmsljq/sql/new');
    console.log('2. Copy the SQL statements above');
    console.log('3. Paste and run them in the SQL Editor');
    console.log('4. Verify the accounts were created');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Failed to generate SQL:', err);
    process.exit(1);
  });

