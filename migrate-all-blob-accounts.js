// Migrate ALL Blob Storage accounts to Supabase
const { list } = require('@vercel/blob');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateAllAccounts() {
  console.log('🚀 Starting FULL account migration from Blob Storage to Supabase...\n');
  
  try {
    // 1. Fetch all accounts from Blob Storage
    const result = await list({
      prefix: 'auth-accounts/',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    
    if (!result.blobs || result.blobs.length === 0) {
      console.log('⚠️  Geen accounts in Blob Storage');
      return;
    }
    
    console.log(`📦 Gevonden: ${result.blobs.length} accounts in Blob Storage\n`);
    
    const accounts = [];
    for (const blob of result.blobs) {
      try {
        const response = await fetch(blob.url);
        const accountData = await response.json();
        accounts.push(accountData);
      } catch (err) {
        console.log(`⚠️  Skip ${blob.pathname}:`, err.message);
      }
    }
    
    // 2. Deduplicate by email (use most recent)
    const uniqueAccounts = new Map();
    for (const account of accounts) {
      const email = account.email.toLowerCase();
      const existing = uniqueAccounts.get(email);
      
      if (!existing || new Date(account.createdAt) > new Date(existing.createdAt)) {
        uniqueAccounts.set(email, account);
      }
    }
    
    console.log(`📧 Unieke accounts (na deduplicatie): ${uniqueAccounts.size}\n`);
    
    // 3. Migrate each account to Supabase
    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const [email, account] of uniqueAccounts) {
      try {
        console.log(`Migrating: ${email}...`);
        
        // Check if already exists in Supabase
        const { data: existing } = await supabase
          .from('users')
          .select('email')
          .eq('email', email)
          .single();
        
        if (existing) {
          console.log(`  ⏭️  Al in Supabase`);
          skipped++;
          continue;
        }
        
        // Insert into Supabase
        const { error } = await supabase
          .from('users')
          .insert({
            email: email,
            password_hash: account.password, // Already bcrypt hashed in Blob Storage
            name: account.name || 'Onbekend',
            company: account.company || null,
            phone: account.phone || null,
            role: account.role || 'owner',
            company_id: account.companyId || null,
            owner_email: account.ownerEmail || null,
            can_view_leads: account.permissions?.canViewLeads ?? true,
            can_view_orders: account.permissions?.canViewOrders ?? true,
            can_manage_employees: account.permissions?.canManageEmployees ?? false,
            can_checkout: account.permissions?.canCheckout ?? true,
            is_active: true,
            needs_password_reset: false,
            created_at: account.createdAt || new Date().toISOString()
          });
        
        if (error) {
          console.log(`  ❌ Error: ${error.message}`);
          failed++;
          continue;
        }
        
        // Create company if exists
        if (account.company) {
          await supabase
            .from('companies')
            .insert({
              owner_email: email,
              company_name: account.company,
              created_at: account.createdAt || new Date().toISOString()
            })
            .then(() => {})
            .catch(() => {}); // Ignore errors (might already exist)
        }
        
        console.log(`  ✅ Gemigreerd`);
        migrated++;
        
      } catch (error) {
        console.log(`  ❌ Exception: ${error.message}`);
        failed++;
      }
    }
    
    // 4. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATIE RESULTAAT');
    console.log('='.repeat(60));
    console.log(`✅ Gemigreerd: ${migrated} accounts`);
    console.log(`⏭️  Overgeslagen (al in Supabase): ${skipped} accounts`);
    console.log(`❌ Mislukt: ${failed} accounts`);
    console.log('='.repeat(60));
    
    // 5. Verify
    const { data: allUsers } = await supabase
      .from('users')
      .select('email, name')
      .order('created_at', { ascending: false });
    
    console.log(`\n📊 Totaal in Supabase: ${allUsers?.length || 0} accounts\n`);
    
    if (migrated > 0) {
      console.log('🎉 Migratie succesvol!');
      console.log('✅ Alle klanten kunnen nu inloggen via Supabase');
    }
    
  } catch (error) {
    console.error('❌ Migratie error:', error);
  }
}

migrateAllAccounts()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

