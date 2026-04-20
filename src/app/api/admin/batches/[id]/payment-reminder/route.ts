import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { sendUnpaidBatchReminderEmail } from '@/lib/email';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { id } = await params;
  const supabase = createServerClient();

  const { data: batch, error: batchError } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, price_per_lead, total_price, is_paid, customers(name)')
    .eq('id', id)
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });
  }

  if (admin.role === 'accountmanager') {
    const { data: myCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('account_manager_id', admin.id)
      .eq('id', batch.customer_id)
      .single();

    if (!myCustomer) {
      return NextResponse.json({ error: 'Geen toegang tot deze batch' }, { status: 403 });
    }
  }

  if (batch.is_paid) {
    return NextResponse.json({ error: 'Deze batch is al betaald' }, { status: 400 });
  }

  const [{ data: customer, error: customerError }, { data: branchRow }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, email, contact_person')
      .eq('id', batch.customer_id)
      .single(),
    supabase
      .from('branches')
      .select('slug, name')
      .eq('slug', batch.branch)
      .single(),
  ]);

  if (customerError || !customer) {
    return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
  }

  if (!customer.email) {
    return NextResponse.json({ error: 'Klant heeft geen e-mailadres' }, { status: 400 });
  }

  const sent = await sendUnpaidBatchReminderEmail(customer, {
    id: batch.id,
    branch: batch.branch,
    branch_name: branchRow?.name || batch.branch,
    batch_size: batch.batch_size,
    price_per_lead: batch.price_per_lead,
    total_price: batch.total_price,
  });

  if (!sent) {
    return NextResponse.json({ error: 'E-mail versturen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
