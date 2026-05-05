import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('email_jobs')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Job niet gevonden' }, { status: 404 });
  }
  if (data.admin_id !== admin.id && admin.role !== 'superadmin' && admin.role !== 'admin') {
    return forbidden();
  }

  return NextResponse.json({ job: data });
}
