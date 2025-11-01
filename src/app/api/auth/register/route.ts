import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, company, phone } = await request.json();
    
    console.log('📝 POST /api/auth/register - New registration:', email);
    
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password en naam zijn verplicht' },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Ongeldig emailadres' },
        { status: 400 }
      );
    }
    
    // Check password strength (minimaal 8 karakters)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Wachtwoord moet minimaal 8 karakters lang zijn' },
        { status: 400 }
      );
    }
    
    const supabase = createServerClient();
    
    // Check if account already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'Dit emailadres is al geregistreerd' },
        { status: 409 }
      );
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create account in Supabase
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        name,
        company: company || null,
        phone: phone || null,
        role: 'owner', // New accounts are owners by default
        can_view_leads: true,
        can_view_orders: true,
        can_manage_employees: true,
        can_checkout: true,
        is_active: true,
        needs_password_reset: false,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Error creating user in Supabase:', insertError);
      
      // Check if it's a unique constraint violation
      if (insertError.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'Dit emailadres is al geregistreerd' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Registratie mislukt', details: insertError.message },
        { status: 500 }
      );
    }
    
    console.log('✅ Account created in Supabase:', email);
    
    // Also create company record if company name provided
    if (company) {
      const { error: companyError } = await supabase
        .from('companies')
        .insert({
          owner_email: email.toLowerCase(),
          company_name: company,
        });
      
      if (companyError) {
        console.warn('⚠️ Could not create company record:', companyError);
        // Don't fail registration if company creation fails
      }
    }
    
    // Return user data (without password)
    return NextResponse.json({
      success: true,
      user: {
        email: newUser.email,
        name: newUser.name,
        company: newUser.company,
        phone: newUser.phone,
        createdAt: newUser.created_at,
        isGuest: false,
        role: newUser.role,
        permissions: {
          canViewLeads: newUser.can_view_leads,
          canViewOrders: newUser.can_view_orders,
          canManageEmployees: newUser.can_manage_employees,
          canCheckout: newUser.can_checkout,
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error in POST /api/auth/register:', error);
    return NextResponse.json(
      { error: 'Registratie mislukt', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


