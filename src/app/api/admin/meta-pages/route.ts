import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { listMetaPages } from '@/lib/meta';

/**
 * GET /api/admin/meta-pages
 *
 * Lijst alle Facebook-pages waar onze geconfigureerde Meta-token
 * MANAGE/CREATE_CONTENT/ADVERTISE rechten op heeft. Gebruikt door de
 * AI Lead Form Creator om de admin een page-picker te tonen wanneer
 * er voor een branche nog geen Lead Forms bestaan.
 *
 * We sturen het pagina-specifieke access_token NIET mee terug naar
 * de browser — dat blijft alleen server-side bekend (via getPageAccessToken
 * in de create-route). De UI heeft genoeg aan id/name/category/picture/tasks.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const force = request.nextUrl.searchParams.get('force') === '1';
    const pages = await listMetaPages({ force });
    const sanitized = pages.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      picture_url: p.picture_url ?? null,
      tasks: p.tasks,
    }));
    return NextResponse.json({ pages: sanitized });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Onbekende fout';
    /**
     * Veelvoorkomende oorzaak: token mist `pages_show_list` / `pages_manage_metadata`.
     * We tonen de admin een actiongerichte hint i.p.v. de rauwe Meta-foutmelding.
     */
    const isPermErr = /permission|pages_show_list|pages_manage|access_token/i.test(msg);
    return NextResponse.json(
      {
        pages: [],
        error: isPermErr
          ? 'Meta token mist de vereiste page-scopes (pages_show_list + pages_manage_ads). Update de token in Koppelingen.'
          : `Kon Meta-pages niet ophalen: ${msg}`,
      },
      { status: isPermErr ? 403 : 500 },
    );
  }
}
