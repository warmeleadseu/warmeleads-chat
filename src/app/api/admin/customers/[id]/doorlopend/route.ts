import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { adminCanAccessCustomer } from '@/lib/permissions';
import { createServerClient } from '@/lib/supabase';
import { beheerderNaam } from '@/lib/factuurBetaling';
import { doorloopStatus, zetDoorlopend } from '@/lib/doorlopen';

/**
 * Doorlopend op factuur op de klantkaart. Superadmin, admin en de eigen
 * accountmanager mogen het aan- en uitzetten; de klant krijgt bij aanzetten
 * altijd een bevestiging met een stopknop.
 */

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await params;
  if (!(await adminCanAccessCustomer(admin, id))) return forbidden();
  const status = await doorloopStatus(createServerClient(), id);
  if (!status) return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await params;
  if (!(await adminCanAccessCustomer(admin, id))) return forbidden();
  const body = await request.json().catch(() => ({}));
  if (typeof body?.aan !== 'boolean') return NextResponse.json({ error: 'Geef aan of doorlopend aan of uit moet' }, { status: 400 });

  const supabase = createServerClient();
  const r = await zetDoorlopend(supabase, id, body.aan, { soort: 'beheer', id: admin.id, naam: beheerderNaam(admin) });
  if (!r.ok) return NextResponse.json({ error: r.fout }, { status: 409 });
  return NextResponse.json(await doorloopStatus(supabase, id));
}
