import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('🔍 Debug Info:');
    console.log('  URL:', url);
    console.log('  Key exists:', !!key);
    console.log('  Key length:', key?.length);
    
    if (!url || !key) {
      return NextResponse.json({
        error: 'Missing env vars',
        hasUrl: !!url,
        hasKey: !!key
      });
    }
    
    const supabase = createClient(url, key);
    
    // Simple query - just get emails
    const { data, error, count } = await supabase
      .from('customers')
      .select('email, name, google_sheet_id, google_sheet_url', { count: 'exact' });
    
    return NextResponse.json({
      success: !error,
      error: error?.message,
      errorCode: error?.code,
      errorDetails: error?.details,
      count: count,
      dataLength: data?.length || 0,
      data: data || []
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}

