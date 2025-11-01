/**
 * Direct PostgreSQL migration - bypasses PostgREST entirely
 */

import { Client } from 'pg';
import bcrypt from 'bcryptjs';

// Parse Supabase URL to get database connection info
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

// Extract project ref from URL (e.g., "klnstthwdtszrqsmsljq.supabase.co" -> "klnstthwdtszrqsmsljq")
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

// Construct PostgreSQL connection string
// Format: postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
const connectionString = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD || supabaseServiceRoleKey}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

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

async function migrateWithDirectSQL() {
  console.log('🚀 Starting direct PostgreSQL migration...\n');
  console.log(`📡 Connecting to Supabase project: ${projectRef}...\n`);
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL!\n');
    
    let totalMigrated = 0;
    
    for (const account of HARDCODED_ACCOUNTS) {
      try {
        const email = account.email.toLowerCase();
        const passwordHash = await bcrypt.hash(account.password, 10);
        
        console.log(`Migrating: ${email}...`);
        
        // Insert with ON CONFLICT DO UPDATE
        const result = await client.query(`
          INSERT INTO users (
            email, password_hash, name, company, phone, role,
            can_view_leads, can_view_orders, can_manage_employees, can_checkout,
            is_active, needs_password_reset, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, 'owner',
            true, true, true, true, true, false, NOW(), NOW()
          )
          ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            name = EXCLUDED.name,
            company = EXCLUDED.company,
            phone = EXCLUDED.phone,
            updated_at = NOW()
          RETURNING email;
        `, [email, passwordHash, account.name, account.company, account.phone]);
        
        if (result.rows.length > 0) {
          console.log(`✅ Migrated: ${email}`);
          totalMigrated++;
          
          // Create company record
          await client.query(`
            INSERT INTO companies (owner_email, company_name, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            ON CONFLICT (owner_email) DO UPDATE SET
              company_name = EXCLUDED.company_name,
              updated_at = NOW();
          `, [email, account.company]);
          
          console.log(`   📦 Company record created/updated: ${account.company}`);
        }
        
      } catch (error: any) {
        console.error(`❌ Failed to migrate ${account.email}:`, error.message);
      }
    }
    
    console.log(`\n✅ Migration complete! Migrated ${totalMigrated} accounts\n`);
    
    // Verify
    const verifyResult = await client.query('SELECT email, name, role, company FROM users ORDER BY created_at DESC');
    
    console.log('📊 All users in database:');
    verifyResult.rows.forEach(u => {
      console.log(`  - ${u.email} (${u.name}) [${u.role}] ${u.company ? `@ ${u.company}` : ''}`);
    });
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

migrateWithDirectSQL()
  .then(() => {
    console.log('\n✅ Migration successful!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  });

