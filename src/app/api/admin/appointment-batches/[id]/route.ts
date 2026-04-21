import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const supabase = createServerClient();

  const allowed = ['status', 'is_paid', 'batch_size', 'price_per_appointment', 'total_price',
    'appointments_per_week', 'appointments_per_day', 'notes', 'account_manager_id', 'starts_at'];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) updates[k] = body[k];

  const { data, error } = await supabase
    .from('appointment_batches')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Bewerken mislukt' }, { status: 500 });
  return NextResponse.json(data);
}
