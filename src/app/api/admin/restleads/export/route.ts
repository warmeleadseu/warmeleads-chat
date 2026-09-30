import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { buildLeadExportTable } from '@/lib/leadExportTable';
import { leadExportWerkboek } from '@/lib/leadExportWerkboek';

/**
 * Excel-export van de leads die op de Restleads-pagina zichtbaar zijn.
 *
 * Dezelfde kolommen als de export uit het Leads CRM: alle kernvelden plus
 * elk branchespecifiek veld (jaarverbruik, zonnepanelen enzovoort). Daarachter
 * wat alleen hier betekenis heeft: hoe oud, hoe vaak uitgedeeld, en naar wie
 * hij nog kan.
 *
 * Bewust zonder bijwerkingen. De export uit het Leads CRM telt als bulkverkoop
 * en komt in de exportgeschiedenis; dit is een werklijst om naar te kijken,
 * geen verkoop.
 */

const MAX_LEADS = 5000;
const CHUNK = 200;

interface Extra {
  dagen_oud?: number;
  uitgedeeld?: number;
  kan_naar?: string[];
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  /* Een accountmanager ziet in het Leads CRM alleen leads van eigen klanten;
     deze lijst kent die afbakening niet, dus geen volledige contactgegevens. */
  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan restleads exporteren' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.lead_ids)
    ? [...new Set((body.lead_ids as unknown[]).filter((v): v is string => typeof v === 'string'))]
    : [];
  const extra: Record<string, Extra> = body.extra && typeof body.extra === 'object' ? body.extra : {};

  if (ids.length === 0) return NextResponse.json({ error: 'Geen leads om te exporteren' }, { status: 400 });
  if (ids.length > MAX_LEADS) {
    return NextResponse.json({ error: `Maximaal ${MAX_LEADS} leads per export` }, { status: 400 });
  }

  const supabase = createServerClient();
  const perId = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('leads')
      .select('*, customers(id, name)')
      .in('id', ids.slice(i, i + CHUNK));
    if (error) {
      console.error('[restleads/export]', error.message);
      return NextResponse.json({ error: 'Leads ophalen mislukt' }, { status: 500 });
    }
    for (const l of data || []) perId.set(l.id as string, l);
  }

  /* In de volgorde van het scherm. */
  const leads = ids.map(id => perId.get(id)).filter((l): l is Record<string, unknown> => !!l);
  const { headers, rows } = buildLeadExportTable(leads);

  const kop = [...headers, 'Dagen oud', 'Uitgedeeld', 'Kan naar'];
  const regels = rows.map((r, i) => {
    const e = extra[leads[i].id as string] ?? {};
    return [
      ...r,
      e.dagen_oud != null ? String(e.dagen_oud) : '',
      e.uitgedeeld != null ? `${e.uitgedeeld}x` : '',
      Array.isArray(e.kan_naar) ? e.kan_naar.join(' | ') : '',
    ];
  });

  const bestand = leadExportWerkboek(kop, regels);
  const lijst = typeof body.lijst === 'string' ? body.lijst.replace(/[^a-z]/g, '') : 'restleads';
  const stamp = new Date().toISOString().split('T')[0];

  return new NextResponse(new Uint8Array(bestand), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="restleads-${lijst}-${stamp}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
