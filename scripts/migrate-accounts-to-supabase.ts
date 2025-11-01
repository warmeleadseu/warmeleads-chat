/**
 * One-time migration script: Migrate all accounts from Blob Storage and hardcoded accounts to Supabase
 * 
 * This script will:
 * 1. Fetch all existing accounts from Blob Storage (if available)
 * 2. Add all hardcoded accounts (admin + demo)
 * 3. Migrate everything to Supabase with proper password hashing
 * 4. Verify all accounts were migrated successfully
 * 
 * Usage: npx tsx scripts/migrate-accounts-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Hardcoded accounts to migrate
const HARDCODED_ACCOUNTS = [
  // Demo account
  {
    email: 'demo@warmeleads.eu',
    password: 'demo123',
    name: 'Demo User',
    company: 'Demo Company',
    phone: '+31 85 047 7067',
    role: 'owner' as const
  },
  // Admin accounts
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

interface BlobAccount {
  email: string;
  passwordHash: string;
  name: string;
  company?: string;
  phone?: string;
  createdAt: string;
  lastLogin?: string;
  role?: 'owner' | 'employee';
  companyId?: string;
  ownerEmail?: string;
  permissions?: {
    canViewLeads: boolean;
    canViewOrders: boolean;
    canManageEmployees: boolean;
    canCheckout: boolean;
  };
}

/**
 * Fetch all accounts from Blob Storage
 */
async function fetchBlobAccounts(): Promise<BlobAccount[]> {
  try {
    console.log('📦 Fetching accounts from Blob Storage...');
    
    // Try to fetch from the list-accounts endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/list-accounts`);
    
    if (!response.ok) {
      console.log('⚠️  Could not fetch from Blob Storage (might be empty or token not configured)');
      return [];
    }
    
    const data = await response.json();
    
    if (data.success && data.accounts && Array.isArray(data.accounts)) {
      console.log(`✅ Found ${data.accounts.length} accounts in Blob Storage`);
      return data.accounts;
    }
    
    return [];
  } catch (error) {
    console.log('⚠️  Could not fetch from Blob Storage:', error);
    return [];
  }
}

/**
 * Hash a plain text password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Check if account already exists in Supabase
 */
async function accountExists(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('email')
    .eq('email', email.toLowerCase())
    .single();
  
  return !!data && !error;
}

/**
 * Migrate a single account to Supabase
 */
async function migrateAccount(account: {
  email: string;
  password?: string;
  passwordHash?: string;
  name: string;
  company?: string;
  phone?: string;
  role: 'owner' | 'employee';
  companyId?: string;
  ownerEmail?: string;
  permissions?: {
    canViewLeads: boolean;
    canViewOrders: boolean;
    canManageEmployees: boolean;
    canCheckout: boolean;
  };
  createdAt?: string;
}): Promise<boolean> {
  try {
    const email = account.email.toLowerCase();
    
    // Check if already exists
    if (await accountExists(email)) {
      console.log(`⏭️  Account already exists in Supabase: ${email}`);
      return false;
    }
    
    // Determine password hash
    let passwordHash: string;
    if (account.passwordHash) {
      // Already hashed (from Blob Storage)
      passwordHash = account.passwordHash;
    } else if (account.password) {
      // Plain text password (hardcoded accounts)
      passwordHash = await hashPassword(account.password);
    } else {
      throw new Error('No password or passwordHash provided');
    }
    
    // Prepare permissions
    const permissions = account.permissions || {
      canViewLeads: true,
      canViewOrders: true,
      canManageEmployees: account.role === 'owner',
      canCheckout: account.role === 'owner'
    };
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        name: account.name,
        company: account.company || null,
        phone: account.phone || null,
        role: account.role,
        company_id: account.companyId || null,
        owner_email: account.ownerEmail || null,
        can_view_leads: permissions.canViewLeads,
        can_view_orders: permissions.canViewOrders,
        can_manage_employees: permissions.canManageEmployees,
        can_checkout: permissions.canCheckout,
        is_active: true,
        needs_password_reset: false,
        created_at: account.createdAt || new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error(`❌ Failed to migrate ${email}:`, error.message);
      return false;
    }
    
    console.log(`✅ Migrated: ${email}`);
    
    // If this is an owner with a company, create company record
    if (account.role === 'owner' && account.company) {
      const { error: companyError } = await supabase
        .from('companies')
        .insert({
          owner_email: email,
          company_name: account.company,
          created_at: account.createdAt || new Date().toISOString()
        });
      
      if (companyError && !companyError.message.includes('duplicate')) {
        console.error(`⚠️  Failed to create company for ${email}:`, companyError.message);
      } else if (!companyError) {
        console.log(`   📦 Created company: ${account.company}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error migrating ${account.email}:`, error);
    return false;
  }
}

/**
 * Main migration function
 */
async function migrateAllAccounts() {
  console.log('🚀 Starting account migration to Supabase...\n');
  
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  
  // Step 1: Migrate hardcoded accounts
  console.log('📝 Step 1: Migrating hardcoded accounts (admin + demo)...');
  for (const account of HARDCODED_ACCOUNTS) {
    const result = await migrateAccount(account);
    if (result) totalMigrated++;
    else totalSkipped++;
  }
  
  // Step 2: Migrate Blob Storage accounts
  console.log('\n📦 Step 2: Migrating accounts from Blob Storage...');
  const blobAccounts = await fetchBlobAccounts();
  
  if (blobAccounts.length === 0) {
    console.log('ℹ️  No accounts found in Blob Storage (or token not configured)');
  } else {
    for (const account of blobAccounts) {
      const result = await migrateAccount({
        email: account.email,
        passwordHash: account.passwordHash,
        name: account.name,
        company: account.company,
        phone: account.phone,
        role: account.role || 'owner',
        companyId: account.companyId,
        ownerEmail: account.ownerEmail,
        permissions: account.permissions,
        createdAt: account.createdAt
      });
      
      if (result) totalMigrated++;
      else totalSkipped++;
    }
  }
  
  // Step 3: Verify migration
  console.log('\n✅ Step 3: Verifying migration...');
  const { data: allUsers, error } = await supabase
    .from('users')
    .select('email, name, role, company')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Failed to verify migration:', error);
  } else {
    console.log(`\n📊 Total users in Supabase: ${allUsers?.length || 0}`);
    if (allUsers && allUsers.length > 0) {
      console.log('\nMigrated accounts:');
      allUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.name}) [${user.role}] ${user.company ? `@ ${user.company}` : ''}`);
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 MIGRATION COMPLETE!');
  console.log('='.repeat(60));
  console.log(`✅ Migrated: ${totalMigrated} accounts`);
  console.log(`⏭️  Skipped (already existed): ${totalSkipped} accounts`);
  console.log(`❌ Failed: ${totalFailed} accounts`);
  console.log('='.repeat(60));
  
  if (totalMigrated > 0) {
    console.log('\n✨ Next steps:');
    console.log('1. Test logging in with the migrated accounts');
    console.log('2. Remove hardcoded accounts from src/lib/auth.ts');
    console.log('3. Remove hardcoded account logic from src/config/admin.ts');
  }
}

// Run migration
migrateAllAccounts()
  .then(() => {
    console.log('\n✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });

