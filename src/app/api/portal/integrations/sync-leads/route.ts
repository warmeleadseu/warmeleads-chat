import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  backfillLeadsToIntegration,
  MAX_BACKFILL_LEADS,
} from '@/lib/integrations/backfillLeads';

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  let body: { lead_ids?: string[]; force_resend?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag' }, { status: 400 });
  }

  const leadIds = Array.isArray(body.lead_ids)
    ? body.lead_ids.filter((id) => typeof id === 'string' && id.trim())
    : [];

  if (leadIds.length === 0) {
    return NextResponse.json({ error: 'Selecteer minimaal één lead' }, { status: 400 });
  }

  if (leadIds.length > MAX_BACKFILL_LEADS) {
    return NextResponse.json(
      { error: `Maximaal ${MAX_BACKFILL_LEADS} leads per keer` },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const summary = await backfillLeadsToIntegration({
    supabase,
    customerId: session.customer.id,
    leadIds,
    customerBranches: session.customer.branches ?? [],
    forceResend: body.force_resend === true,
  });

  if (!summary.provider) {
    return NextResponse.json(
      {
        error:
          'Geen actieve CRM-koppeling. Stel eerst je integratie in onder Account → Integraties.',
        ...summary,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(summary);
}
