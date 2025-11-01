import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ApiResponseHandler } from '@/lib/apiResponses';
import { safeLog } from '@/lib/logger';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    safeLog.log('🔐 POST /api/auth/login - Login attempt:', email);
    
    if (!email || !password) {
      return ApiResponseHandler.validationError('Email en wachtwoord zijn verplicht');
    }
    
    const supabase = createServerClient();
    
    // Find account in Supabase
    const { data: accountData, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    
    if (fetchError || !accountData) {
      console.log('❌ Account not found for:', email);
      return NextResponse.json(
        { error: 'Ongeldig emailadres of wachtwoord' },
        { status: 401 }
      );
    }
    
    console.log('🔍 Account data loaded:', { 
      email: accountData.email, 
      is_active: accountData.is_active,
      needs_password_reset: accountData.needs_password_reset,
      role: accountData.role
    });
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, accountData.password_hash);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Ongeldig emailadres of wachtwoord' },
        { status: 401 }
      );
    }
    
    // Additional check for employee accounts
    if (accountData.role === 'employee') {
      if (!accountData.is_active) {
        console.log('❌ Employee account not active yet:', email);
        return NextResponse.json(
          { error: 'Account is nog niet geactiveerd. Probeer over een paar minuten opnieuw.' },
          { status: 401 }
        );
      }
      
      if (accountData.needs_password_reset) {
        console.log('❌ Employee account still needs password reset:', email);
        return NextResponse.json(
          { error: 'Account setup is nog niet voltooid.' },
          { status: 401 }
        );
      }
    }
    
    // Update last_login timestamp
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('email', email.toLowerCase());
    
    console.log('✅ Login successful:', email, { 
      role: accountData.role, 
      is_active: accountData.is_active,
      needs_password_reset: accountData.needs_password_reset 
    });
    
    // Generate a simple session token (just the user ID for now)
    // In production, you'd use a proper JWT with expiration
    const sessionToken = accountData.id;
    
    // Return user data (without password) including employee/role info + session token
    return NextResponse.json({
      success: true,
      token: sessionToken, // ADD TOKEN
      user: {
        email: accountData.email,
        name: accountData.name,
        company: accountData.company,
        phone: accountData.phone,
        createdAt: accountData.created_at,
        isGuest: false,
        role: accountData.role || 'owner',
        companyId: accountData.company_id,
        ownerEmail: accountData.owner_email,
        permissions: {
          canViewLeads: accountData.can_view_leads,
          canViewOrders: accountData.can_view_orders,
          canManageEmployees: accountData.can_manage_employees,
          canCheckout: accountData.can_checkout,
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error in POST /api/auth/login:', error);
    return NextResponse.json(
      { error: 'Login mislukt', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


