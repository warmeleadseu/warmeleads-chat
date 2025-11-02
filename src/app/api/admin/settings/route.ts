import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/admin/settings
 * Fetch admin settings
 */
export async function GET(request: NextRequest) {
  try {
    console.log('⚙️ Admin: Fetching settings...');
    
    const supabase = createServerClient();

    // For now, we'll use a simple key-value approach
    // In a real app, you might want a dedicated settings table
    const { data: settingsData, error } = await supabase
      .from('customers')
      .select('id')
      .limit(1)
      .single();

    // Return default settings for now
    // These can be stored in environment variables or a dedicated settings table
    const settings = {
      website: {
        title: process.env.NEXT_PUBLIC_SITE_TITLE || 'WarmeLeads - Verse Leads Nederland',
        description: process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'Koop verse leads voor thuisbatterijen, zonnepanelen, warmtepompen en financial lease',
        contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'info@warmeleads.eu',
        contactPhone: process.env.NEXT_PUBLIC_CONTACT_PHONE || '+31850477067',
        whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '+31613927338'
      },
      integrations: {
        stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.substring(0, 20) + '...' || 'Not configured',
        openaiConfigured: !!process.env.OPENAI_API_KEY,
        googleAnalyticsId: process.env.NEXT_PUBLIC_GA_ID || 'G-PBJPRGK8VL',
        supabaseConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL
      },
      notifications: {
        emailNotifications: true,
        smsNotifications: false,
        slackWebhook: ''
      }
    };

    const response = NextResponse.json({
      success: true,
      settings
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error: any) {
    console.error('💥 Server error fetching settings:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown server error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings
 * Update admin settings
 */
export async function PUT(request: NextRequest) {
  try {
    console.log('⚙️ Admin: Updating settings...');
    
    const body = await request.json();
    const { settings } = body;

    // In a production app, you would save these to a database or config file
    // For now, we'll just validate and return success
    console.log('Settings to update:', settings);

    // Validate settings structure
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid settings format' },
        { status: 400 }
      );
    }

    // In production, you would:
    // 1. Save to a settings table in Supabase
    // 2. Update environment variables
    // 3. Trigger a rebuild/redeploy if needed

    console.log('✅ Settings validated (save to .env or database in production)');

    return NextResponse.json({
      success: true,
      message: 'Settings opgeslagen (in productie: update .env variabelen)',
      settings
    });

  } catch (error: any) {
    console.error('💥 Server error updating settings:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown server error'
      },
      { status: 500 }
    );
  }
}

