/**
 * Herstel `lead_assignments.assigned_at` voor leads die via de klantkaart
 * (reassign) zijn verplaatst, waarbij de ontvangstdatum per ongeluk op de
 * verplaatsdag werd gezet i.p.v. de oorspronkelijke datum.
 *
 * Bron: lead_activities.action = 'reassign' (gisteren + vandaag standaard).
 * Proxy voor ontbrekende bron-assigned_at: leads.created_at, anders wervingsdatum.
 *
 *   npx tsx scripts/backfill-reassign-assigned-at.ts --dry-run
 *   npx tsx scripts/backfill-reassign-assigned-at.ts
 *   npx tsx scripts/backfill-reassign-assigned-at.ts --from=2026-07-22 --to=2026-07-23
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createServerClient } from '../src/lib/supabase';

config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  config({ path: resolve(process.cwd(), '.env.vercel.prod.full') });
}

function argValue(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function startOfDayIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

function endOfDayExclusiveIso(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function todayAmsterdam(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function yesterdayAmsterdam(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);
  const local = new Date(Date.UTC(y, m - 1, d));
  local.setUTCDate(local.getUTCDate() - 1);
  return local.toISOString().slice(0, 10);
}

function proposedAssignedAt(lead: {
  created_at: string | null;
  wervingsdatum: string | null;
}): string | null {
  if (lead.created_at) return lead.created_at;
  if (lead.wervingsdatum) {
    // date-only → middag UTC zodat de kalenderdag stabiel blijft
    return `${lead.wervingsdatum}T12:00:00.000Z`;
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const fromDate = argValue('from') || yesterdayAmsterdam();
  const toDate = argValue('to') || todayAmsterdam();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig (.env.local).');
    process.exit(1);
  }

  const supabase = createServerClient();
  const fromIso = startOfDayIso(fromDate);
  const toIsoExclusive = endOfDayExclusiveIso(toDate);

  console.log(
    `Backfill reassign assigned_at (${fromDate} t/m ${toDate})` +
      `${dryRun ? ' — DRY RUN' : ''}`,
  );

  const activities: {
    id: string;
    lead_id: string;
    customer_id: string | null;
    created_at: string;
    details: Record<string, unknown> | null;
  }[] = [];

  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('lead_activities')
      .select('id, lead_id, customer_id, created_at, details')
      .eq('action', 'reassign')
      .gte('created_at', fromIso)
      .lt('created_at', toIsoExclusive)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error('Activities ophalen mislukt:', error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    activities.push(...(data as typeof activities));
    if (data.length < PAGE) break;
  }

  console.log(`Gevonden reassign-activities: ${activities.length}`);
  if (activities.length === 0) {
    console.log('Niets te doen.');
    return;
  }

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const act of activities) {
    const assignmentId =
      typeof act.details?.assignment_id === 'string' ? act.details.assignment_id : null;
    if (!assignmentId || !act.customer_id) {
      missing++;
      continue;
    }

    const { data: assignment, error: aErr } = await supabase
      .from('lead_assignments')
      .select('id, lead_id, customer_id, assigned_at, source')
      .eq('id', assignmentId)
      .maybeSingle();
    if (aErr || !assignment) {
      missing++;
      continue;
    }

    const { data: lead, error: lErr } = await supabase
      .from('leads')
      .select('id, created_at, wervingsdatum, naam_klant')
      .eq('id', assignment.lead_id)
      .maybeSingle();
    if (lErr || !lead) {
      missing++;
      continue;
    }

    const proposed = proposedAssignedAt(lead);
    if (!proposed) {
      skipped++;
      continue;
    }

    const current = assignment.assigned_at ? new Date(assignment.assigned_at) : null;
    const proposedDate = new Date(proposed);
    if (!current || Number.isNaN(current.getTime()) || Number.isNaN(proposedDate.getTime())) {
      skipped++;
      continue;
    }

    // Alleen corrigeren als assigned_at op (ongeveer) de reassign-dag staat
    // en duidelijk nieuwer is dan de lead zelf.
    const actDay = act.created_at.slice(0, 10);
    const assignedDay = assignment.assigned_at!.slice(0, 10);
    if (assignedDay !== actDay) {
      skipped++;
      continue;
    }
    if (proposedDate.getTime() >= current.getTime() - 60_000) {
      // proposed is niet ouder → geen zinvolle correctie
      skipped++;
      continue;
    }

    console.log(
      `${dryRun ? '[dry] ' : ''}${lead.naam_klant || lead.id.slice(0, 8)}: ` +
        `${assignment.assigned_at} → ${proposed}`,
    );

    if (!dryRun) {
      const { error: uErr } = await supabase
        .from('lead_assignments')
        .update({ assigned_at: proposed })
        .eq('id', assignment.id);
      if (uErr) {
        console.error('Update mislukt', assignment.id, uErr.message);
        skipped++;
        continue;
      }
    }
    updated++;
  }

  console.log(`Klaar: updated=${updated}, skipped=${skipped}, missing=${missing}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
