import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'E-mailadres is vereist' },
        { status: 400 }
      );
    }

    console.log('📋 Getting profile data for:', email);

    const supabase = createServerClient();
    
    // Get profile data from Supabase
    const { data: accountData, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    
    if (fetchError || !accountData) {
      console.log('ℹ️ No profile data found in Supabase');
      return NextResponse.json(
        { error: 'Profiel niet gevonden' },
        { status: 404 }
      );
    }
    
    console.log('✅ Profile data retrieved successfully');
    
    return NextResponse.json({
      success: true,
      user: {
        email: accountData.email,
        name: accountData.name,
        company: accountData.company,
        phone: accountData.phone,
        updatedAt: accountData.updated_at,
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
    console.error('❌ Get profile error:', error);
    return NextResponse.json(
      { error: 'Er is een onverwachte fout opgetreden', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

