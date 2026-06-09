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

  // `branches` mag herhaaldelijk meegegeven worden (?branches=a&branches=b) of
  // als komma-gescheiden lijst (?branches=a,b). Templates met een verplichte
  // branche-koppeling (bv. Nij Begun) worden alleen getoond wanneer minstens
  // één van die slugs in deze set zit.
  const rawBranches = request.nextUrl.searchParams.getAll('branches');
  const branchSet = new Set<string>();
  for (const raw of rawBranches) {
    for (const part of raw.split(',')) {
      const s = part.trim();
      if (s) branchSet.add(s);
    }
  }
  const recipientBranches = branchSet.size > 0 ? Array.from(branchSet) : undefined;

  const templates = listTemplates(filter, recipientBranches).map(t => ({
    key: t.key,
    label: t.label,
    description: t.description,
    applicable_to: t.applicableTo,
    scope: t.scope,
    options: t.options,
  }));

  return NextResponse.json({ templates });
}
