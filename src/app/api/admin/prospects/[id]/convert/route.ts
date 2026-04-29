import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { loadAccessibleProspect } from '@/lib/prospects';

interface ConvertBody {
  // Optional override van customer-velden, default uit prospect
  name?: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  branches?: string[];
  notes?: string | null;
  account_manager_id?: string | null;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: ConvertBody = {};
  try {
    body = (await request.json()) as ConvertBody;
  } catch {
    body = {};
  }

  const supabase = createServerClient();
  const access = await loadAccessibleProspect(supabase, admin, params.id);
  if (!access.ok || !access.prospect) {
    if (access.reason === 'forbidden') return forbidden();
    return NextResponse.json({ error: 'Prospect niet gevonden' }, { status: 404 });
  }

  const p = access.prospect;
  if (p.converted_to_customer_id) {
    return NextResponse.json(
      { error: 'Deze prospect is al geconverteerd', customer_id: p.converted_to_customer_id },
      { status: 409 },
    );
  }

  const customerInsert: Record<string, unknown> = {
    name: body.name || p.company_name,
    contact_person: body.contact_person ?? p.contact_person ?? null,
    email: body.email ?? p.email ?? null,
    phone: body.phone ?? p.phone ?? null,
    branches: body.branches ?? p.branches ?? [],
    notes: body.notes ?? p.notes ?? null,
    is_active: true,
    account_manager_id: body.account_manager_id ?? p.account_manager_id ?? null,
  };

  // Adres + identifiers, alleen als gevuld op prospect
  if (p.address) customerInsert.address = p.address;
  if (p.postcode) customerInsert.postcode = p.postcode;
  if (p.city) customerInsert.city = p.city;
  if (p.kvk_nummer) customerInsert.kvk_nummer = p.kvk_nummer;
  if (p.vat_id) customerInsert.vat_id = p.vat_id;

  // Insert customer
  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .insert(customerInsert)
    .select()
    .single();
  if (cErr || !customer) {
    return NextResponse.json(
      { error: 'Klant aanmaken mislukt', details: cErr?.message },
      { status: 500 },
    );
  }

  // Update prospect
  const { error: pErr } = await supabase
    .from('prospects')
    .update({
      status: 'gewonnen',
      converted_to_customer_id: customer.id,
      converted_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  if (pErr) {
    // Rollback: best-effort
    await supabase.from('customers').delete().eq('id', customer.id);
    return NextResponse.json({ error: 'Conversie kon prospect niet bijwerken' }, { status: 500 });
  }

  await supabase.from('prospect_activities').insert({
    prospect_id: params.id,
    admin_user_id: admin.id,
    type: 'conversion',
    title: `Geconverteerd naar klant: ${customer.name}`,
    metadata: { customer_id: customer.id },
  });

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'prospect.converted',
    entityType: 'prospect',
    entityId: params.id,
    details: { customer_id: customer.id, company_name: customer.name },
  });

  return NextResponse.json({
    success: true,
    customer: { ...customer, password_hash: undefined },
  });
}
