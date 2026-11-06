import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { isMaandagmailAan, verstuurAanIedereen } from '@/lib/extraLeadsMailVerzenden';

/**
 * Maandagochtend: elke klant met een portaalaccount krijgt het aanbod van
 * Extra leads in zijn branches, per regio. Alleen als de schakelaar op
 * /admin/extra-leads-mail aan staat. Opnieuw draaien is veilig: wie de mail
 * deze week al kreeg, slaan we over.
 */

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();
  if (!(await isMaandagmailAan(supabase))) {
    return NextResponse.json({ overgeslagen: 'De maandagmail staat uit' });
  }

  const res = await verstuurAanIedereen(supabase, 'maandag', { deadlineMs: 270_000 });
  void logAudit({
    adminName: 'Systeem',
    action: 'extra_leads_maandagmail',
    entityType: 'email',
    entityId: res.week,
    details: { ...res, mislukt: res.mislukt.length },
  });
  return NextResponse.json(res);
}
