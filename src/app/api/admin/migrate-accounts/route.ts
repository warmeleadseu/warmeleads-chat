// Force refresh Supabase PostgREST schema cache and migrate accounts
// API Route: /api/admin/migrate-accounts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

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

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    console.log('🚀 Starting account migration via API...');
    
    const results = [];
    let totalMigrated = 0;
    
    for (const account of HARDCODED_ACCOUNTS) {
      try {
        const email = account.email.toLowerCase();
        const passwordHash = await bcrypt.hash(account.password, 10);
        
        console.log(`Migrating: ${email}...`);
        
        // Use from().insert() with explicit error handling
        const { data, error } = await supabase
          .from('users')
          .insert({
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
          })
          .select()
          .single();
        
        if (error) {
          if (error.code === '23505') {
            // Duplicate key - account already exists, update instead
            const { data: updateData, error: updateError } = await supabase
              .from('users')
              .update({
                password_hash: passwordHash,
                name: account.name,
                company: account.company || null,
                phone: account.phone || null,
                updated_at: new Date().toISOString()
              })
              .eq('email', email)
              .select()
              .single();
            
            if (updateError) {
              results.push({ email, status: 'error', message: updateError.message });
              console.error(`❌ Failed to update ${email}:`, updateError.message);
              continue;
            }
            
            results.push({ email, status: 'updated' });
            console.log(`✅ Updated: ${email}`);
          } else {
            results.push({ email, status: 'error', message: error.message });
            console.error(`❌ Failed to migrate ${email}:`, error.message);
            continue;
          }
        } else {
          results.push({ email, status: 'created' });
          console.log(`✅ Created: ${email}`);
          totalMigrated++;
        }
        
        // Create company
        if (account.company) {
          const { error: companyError } = await supabase
            .from('companies')
            .insert({
              owner_email: email,
              company_name: account.company
            });
          
          if (companyError && companyError.code !== '23505') {
            console.error(`⚠️  Company error for ${email}:`, companyError.message);
          }
        }
        
      } catch (error: any) {
        results.push({ email: account.email, status: 'error', message: error.message });
        console.error(`❌ Exception for ${account.email}:`, error);
      }
    }
    
    // Verify
    const { data: users, error: verifyError } = await supabase
      .from('users')
      .select('email, name, role, company')
      .order('created_at', { ascending: false });
    
    return NextResponse.json({
      success: true,
      message: `Migration completed. Migrated ${totalMigrated} accounts.`,
      results,
      users: users || [],
      verifyError: verifyError?.message
    });
    
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

