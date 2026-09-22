import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

/** Beheer van koppelingen tussen klantportalen. Alleen voor admins. */

function magBeheren(role: string): boolean {
  return role === 'superadmin' || role === 'admin';
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('portaalkoppelingen')
    .select('*, bron:customers!portaalkoppelingen_bron_customer_id_fkey(name), doel:customers!portaalkoppelingen_doel_customer_id_fkey(name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/portaalkoppelingen GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (!magBeheren(admin.role)) {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan koppelingen beheren' }, { status: 403 });
  }

  const body = await request.json();
  const { bron_customer_id, doel_customer_id } = body;

  if (!bron_customer_id || !doel_customer_id) {
    return NextResponse.json({ error: 'bron en doel zijn verplicht' }, { status: 400 });
  }
  if (bron_customer_id === doel_customer_id) {
    return NextResponse.json({ error: 'Een klant koppelen aan zichzelf heeft geen zin' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('portaalkoppelingen')
    .insert({
      bron_customer_id,
      doel_customer_id,
      branches: Array.isArray(body.branches) && body.branches.length > 0 ? body.branches : null,
      verbruikt_batch: body.verbruikt_batch !== false,
      deelt_leadgegevens: body.deelt_leadgegevens === true,
      mag_wijzigen_tot_bevestiging: body.mag_wijzigen_tot_bevestiging !== false,
      notities: body.notities || null,
      aangemaakt_door_admin_id: admin.id,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Deze koppeling bestaat al' }, { status: 409 });
    }
    console.error('[admin/portaalkoppelingen POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (!magBeheren(admin.role)) {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan koppelingen beheren' }, { status: 403 });
  }

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: 'id ontbreekt' }, { status: 400 });

  const velden: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ['verbruikt_batch', 'deelt_leadgegevens', 'mag_wijzigen_tot_bevestiging', 'actief'] as const) {
    if (k in body) velden[k] = body[k] === true;
  }
  if ('branches' in body) {
    velden.branches = Array.isArray(body.branches) && body.branches.length > 0 ? body.branches : null;
  }
  if ('notities' in body) velden.notities = body.notities || null;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('portaalkoppelingen')
    .update(velden)
    .eq('id', body.id)
    .select('*')
    .single();

  if (error) {
    console.error('[admin/portaalkoppelingen PATCH]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (!magBeheren(admin.role)) {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan koppelingen beheren' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id ontbreekt' }, { status: 400 });

  const supabase = createServerClient();
  /* Deactiveren in plaats van verwijderen: reeds geboekte afspraken verwijzen
     naar deze koppeling, en die geschiedenis moet leesbaar blijven. */
  const { error } = await supabase
    .from('portaalkoppelingen')
    .update({ actief: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
