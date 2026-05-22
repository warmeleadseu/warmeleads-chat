import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  clearCustomerOAuthCredentials,
  saveCustomerOAuthCredentials,
} from '@/lib/teamleader/credentials';

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  let body: { client_id?: string; client_secret?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag' }, { status: 400 });
  }

  const clientId = (body.client_id ?? '').trim();
  const clientSecret = (body.client_secret ?? '').trim();
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Vul zowel Client ID als Client Secret in.' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  try {
    await saveCustomerOAuthCredentials(supabase, session.customer.id, {
      clientId,
      clientSecret,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Opslaan mislukt' },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  await clearCustomerOAuthCredentials(supabase, session.customer.id);
  return NextResponse.json({ ok: true });
}
