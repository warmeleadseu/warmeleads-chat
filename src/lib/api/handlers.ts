import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { verifyCustomer } from '@/lib/portalAuth';
import type { PortalSession } from '@/lib/portalPermissions';
import { apiError } from './response';
import { captureServerException } from '@/lib/monitoring';

type AdminUser = NonNullable<Awaited<ReturnType<typeof verifyAdmin>>>;

type RouteContext = { params?: Record<string, string> };

/** Route-handler die extra context (auth) meekrijgt. */
type AdminHandler = (
  request: NextRequest,
  ctx: { admin: AdminUser; params: Record<string, string> },
) => Promise<Response> | Response;

type PortalHandler = (
  request: NextRequest,
  ctx: { session: PortalSession; params: Record<string, string> },
) => Promise<Response> | Response;

type BasicHandler = (
  request: NextRequest,
  ctx: { params: Record<string, string> },
) => Promise<Response> | Response;

function routeName(request: NextRequest): string {
  try {
    return request.nextUrl?.pathname ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Wikkelt een admin-route: verifieert de sessie, vangt fouten centraal af en
 * rapporteert ze (i.p.v. stil wegslikken). Vervangt de per-route herhaalde
 * `const admin = await verifyAdmin(...)`-boilerplate.
 */
export function withAdmin(handler: AdminHandler) {
  return async (request: NextRequest, context?: RouteContext): Promise<Response> => {
    try {
      const admin = await verifyAdmin(request);
      if (!admin) return apiError('unauthorized');
      return await handler(request, { admin, params: context?.params ?? {} });
    } catch (err) {
      captureServerException(err, { route: routeName(request), scope: 'admin' });
      return apiError('internal_error');
    }
  };
}

/** Wikkelt een portal-route met sessie-verificatie + centrale foutafhandeling. */
export function withPortal(handler: PortalHandler) {
  return async (request: NextRequest, context?: RouteContext): Promise<Response> => {
    try {
      const session = await verifyCustomer(request);
      if (!session) return apiError('unauthorized');
      return await handler(request, { session, params: context?.params ?? {} });
    } catch (err) {
      captureServerException(err, { route: routeName(request), scope: 'portal' });
      return apiError('internal_error');
    }
  };
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Wikkelt een cron-route. Faalt gesloten: als `CRON_SECRET` ontbreekt of niet
 * (constant-time) matcht, volgt 401. Vervangt de losse, timing-onveilige
 * `authHeader !== \`Bearer ${CRON_SECRET}\``-checks.
 */
export function withCron(handler: BasicHandler) {
  return async (request: NextRequest, context?: RouteContext): Promise<Response> => {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 16) {
      captureServerException(new Error('CRON_SECRET ontbreekt of te kort'), {
        route: routeName(request),
        scope: 'cron',
      });
      return apiError('internal_error', 'Cron niet correct geconfigureerd');
    }
    const header = request.headers.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token || !safeEqual(token, secret)) {
      return apiError('unauthorized');
    }
    try {
      return await handler(request, { params: context?.params ?? {} });
    } catch (err) {
      captureServerException(err, { route: routeName(request), scope: 'cron' });
      return apiError('internal_error');
    }
  };
}

/**
 * Wikkelt een webhook-route met centrale foutafhandeling. De authenticatie
 * (signature/secret) blijft per webhook in de handler, omdat die per provider
 * verschilt. Retourneert bij een onverwachte fout 200 als `swallow` aan staat
 * (sommige providers hammeren bij 5xx), anders 500.
 */
export function withWebhook(handler: BasicHandler, opts?: { swallow?: boolean }) {
  return async (request: NextRequest, context?: RouteContext): Promise<Response> => {
    try {
      return await handler(request, { params: context?.params ?? {} });
    } catch (err) {
      captureServerException(err, { route: routeName(request), scope: 'webhook' });
      if (opts?.swallow) return NextResponse.json({ received: true });
      return apiError('internal_error');
    }
  };
}
