import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { listTemplates } from '@/lib/email/templates';
import type { TemplateApplicableTo } from '@/lib/email/templates/types';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const forParam = request.nextUrl.searchParams.get('for');
  const filter: TemplateApplicableTo | undefined =
    forParam === 'prospect' || forParam === 'customer' ? forParam : undefined;

  const templates = listTemplates(filter).map(t => ({
    key: t.key,
    label: t.label,
    description: t.description,
    applicable_to: t.applicableTo,
    scope: t.scope,
    options: t.options,
  }));

  return NextResponse.json({ templates });
}
