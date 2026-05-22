import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  ensureValidAccessToken,
  getTeamleaderIntegration,
  resolvePhaseIdForPipeline,
} from '@/lib/teamleader/integrationRepo';
import { findOrCreateContact } from '@/lib/teamleader/contacts';
import { createDeal } from '@/lib/teamleader/deals';
import { DEFAULT_DEAL_TITLE_TEMPLATE } from '@/lib/teamleader/config';

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const integration = await getTeamleaderIntegration(supabase, session.customer.id);
  if (!integration?.settings.pipeline_id) {
    return NextResponse.json(
      { error: 'Kies en bewaar eerst een pipeline.' },
      { status: 400 },
    );
  }

  try {
    const accessToken = await ensureValidAccessToken(supabase, integration);
    const phaseId = await resolvePhaseIdForPipeline(
      supabase,
      integration,
      accessToken,
      integration.settings.pipeline_id,
    );
    if (!phaseId) {
      return NextResponse.json(
        { error: 'Geen deal-fase gevonden voor deze pipeline.' },
        { status: 400 },
      );
    }

    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const contactId = await findOrCreateContact(accessToken, {
      naam_klant: 'Warme Leads Test',
      email: `test+${session.customer.id.slice(0, 8)}@warmeleads.test`,
      telefoonnummer: null,
      postcode: null,
      huisnummer: null,
      plaatsnaam: null,
    });

    const template =
      integration.settings.deal_title_template || DEFAULT_DEAL_TITLE_TEMPLATE;
    const title = template
      .replace(/\{branch_name\}/g, 'Test')
      .replace(/\{naam_klant\}/g, 'Warme Leads Test')
      .replace(/\{branch\}/g, 'test');

    const dealId = await createDeal(accessToken, {
      contactId,
      title: `[TEST ${stamp}] ${title}`,
      summary:
        'Testdeal aangemaakt vanuit het Warme Leads portaal om de Teamleader-koppeling te verifiëren. Je kunt deze deal en bijbehorend contact veilig verwijderen.',
      phaseId,
    });

    return NextResponse.json({
      ok: true,
      teamleader_contact_id: contactId,
      teamleader_deal_id: dealId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Test mislukt';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
