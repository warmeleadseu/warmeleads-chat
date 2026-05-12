import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Voorkomt build-time static generation: Supabase-call mag alleen runtime, niet bij `next build`.
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('branches')
    .select('slug, name, color, description')
    .eq('is_active', true)
    .eq('hidden_from_admin', false)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Kon branches niet ophalen' }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
