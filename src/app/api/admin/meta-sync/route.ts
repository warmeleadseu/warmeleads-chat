import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { syncMetaAdSpend, verifyMetaToken, getMetaCredentials } from '@/lib/meta';

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const days = body.days || 7;

  const now = new Date();
  const dateTo = now.toISOString().split('T')[0];
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  const dateFrom = from.toISOString().split('T')[0];

  const result = await syncMetaAdSpend(dateFrom, dateTo);

  return NextResponse.json({
    ok: result.errors.length === 0,
    dateFrom,
    dateTo,
    adRowsSynced: result.synced,
    leadsUpdated: result.leadsUpdated,
    errors: result.errors,
  });
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const credentials = await getMetaCredentials();
  if (!credentials) {
    return NextResponse.json({ configured: false });
  }

  const tokenCheck = await verifyMetaToken(credentials.accessToken);
  return NextResponse.json({
    configured: true,
    tokenValid: tokenCheck.valid,
    tokenName: tokenCheck.name,
    tokenError: tokenCheck.error,
    adAccountId: credentials.adAccountId,
  });
}
