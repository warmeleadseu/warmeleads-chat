import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { distributeUnassignedLeads } from '@/lib/distribution';

export async function POST(request: NextRequest) {
  const { error } = await requireSuperAdmin(request);
  if (error) return error;

  try {
    const result = await distributeUnassignedLeads();
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Onbekende fout';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
