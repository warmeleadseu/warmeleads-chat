import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { enrichLeadAddress } from '@/lib/pdok';
import { isPhoneValid } from '@/lib/phoneValidation';
import { checkLeadProfanity } from '@/lib/profanityFilter';
import { calculateQualityScore } from '@/lib/leadQuality';
import { logAudit } from '@/lib/audit';
import { parseImportDate } from '@/lib/parseImportDate';
import {
  buildPartnerProspectInsertRow,
  insertPartnerProspect,
  isPartnerProspectBranch,
  type PartnerProspectPayload,
} from '@/lib/partnerProspectIngest';
import { resolvePartnerProspectAccountManagerId } from '@/lib/partnerProspectAssignment';
import {
  normalizePartnerProspectBranchSlug,
  type PartnerProspectBranchSlug,
} from '@/lib/partnerProspectConstants';
import { partnerProspectIngestLabel } from '@/lib/partnerProspectIngest';

const ENRICH_CONCURRENCY = 8;

function normalizePhone(raw: string): string {
  if (!raw) return '';
  let p = raw.replace(/[\s\-().\/]/g, '');
  if (p.startsWith('+31')) p = '0' + p.slice(3);
  else if (p.startsWith('0031')) p = '0' + p.slice(4);
  else if (p.startsWith('+32')) p = '0' + p.slice(3);
  else if (p.startsWith('0032')) p = '0' + p.slice(4);
  return p;
}

function cleanPostcode(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\s+/g, '').toUpperCase().trim();
}


export async function POST(request: NextRequest) {
  const { admin, error } = await requireSuperAdmin(request);
  if (error || !admin) return error!;

  try {
    const { branch, leads } = await request.json();

    if (!branch || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'branch en leads zijn verplicht' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Pre-fetch existing emails + phones for dedup
    const existingEmails = new Set<string>();
    const existingPhones = new Set<string>();

    const emails = leads.map(l => (l.email || '').toLowerCase().trim()).filter(Boolean);
    if (emails.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < emails.length; i += CHUNK) {
        const chunk = emails.slice(i, i + CHUNK);
        const { data } = await supabase
          .from('leads')
          .select('email')
          .eq('branch', branch)
          .in('email', chunk);
        (data || []).forEach(r => { if (r.email) existingEmails.add(r.email.toLowerCase()); });
      }
    }

    if (isPartnerProspectBranch(branch) && emails.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < emails.length; i += CHUNK) {
        const chunk = emails.slice(i, i + CHUNK);
        const { data } = await supabase
          .from('prospects')
          .select('email')
          .contains('branches', [branch])
          .in('email', chunk);
        (data || []).forEach(r => { if (r.email) existingEmails.add(r.email.toLowerCase()); });
      }
    }

    const phones = leads.map(l => normalizePhone(l.telefoonnummer || '')).filter(Boolean);
    if (phones.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < phones.length; i += CHUNK) {
        const chunk = phones.slice(i, i + CHUNK);
        const { data } = await supabase
          .from('leads')
          .select('telefoonnummer')
          .eq('branch', branch)
          .in('telefoonnummer', chunk);
        (data || []).forEach(r => {
          if (r.telefoonnummer) existingPhones.add(normalizePhone(r.telefoonnummer));
        });
      }
    }

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    let errors = 0;
    let unparseableDates = 0;
    const errorDetails: string[] = [];

    // Pass 1: Validate, dedup, build lead objects (fast, no API calls)
    const commonKeys = new Set([
      'naam_klant', 'email', 'telefoonnummer', 'postcode', 'huisnummer',
      'plaatsnaam', 'provincie', 'wervingsdatum', 'status', 'bron', 'notities',
    ]);

    const prepared: Record<string, unknown>[] = [];

    for (const lead of leads) {
      const naam = (lead.naam_klant || '').trim();
      const email = (lead.email || '').trim();
      const phone = (lead.telefoonnummer || '').trim();

      if (!naam) { skipped++; continue; }

      // If phone field is filled but doesn't look like a phone number, clear it
      const looksLikePhone = phone && /\d{6,}/.test(phone.replace(/[\s\-().+\/]/g, ''));
      const cleanPhone = looksLikePhone ? phone : '';

      if (!email && !cleanPhone) { skipped++; continue; }

      const normPhone = normalizePhone(cleanPhone);
      if (email && existingEmails.has(email.toLowerCase())) { duplicates++; continue; }
      if (normPhone && existingPhones.has(normPhone)) { duplicates++; continue; }

      const postcode = cleanPostcode(lead.postcode || '');
      const huisnummer = (lead.huisnummer || '').trim();

      const parsedWervingsdatum = parseImportDate(lead.wervingsdatum);
      if (parsedWervingsdatum === null) unparseableDates++;

      // Status uit het bestand respecteren als die op een geldige
      // CRM-waarde matcht (Nederlands of Engels). Onbekende waarden vallen
      // terug op 'nieuw' zodat we nooit met een illegale enum-status in
      // de database belanden.
      const validStatuses = new Set([
        'nieuw', 'gecontacteerd', 'geen_gehoor', 'offerte', 'afspraak', 'verkocht', 'afgewezen',
      ]);
      const statusAlias: Record<string, string> = {
        nieuw: 'nieuw', new: 'nieuw', open: 'nieuw', instroom: 'nieuw', initial: 'nieuw',
        gecontacteerd: 'gecontacteerd', contacted: 'gecontacteerd',
        'geen gehoor': 'geen_gehoor', geengehoor: 'geen_gehoor', nopickup: 'geen_gehoor',
        offerte: 'offerte', quote: 'offerte', proposal: 'offerte',
        afspraak: 'afspraak', appointment: 'afspraak',
        verkocht: 'verkocht', won: 'verkocht', sold: 'verkocht', closed: 'verkocht',
        afgewezen: 'afgewezen', lost: 'afgewezen', rejected: 'afgewezen',
      };
      const rawStatus = (lead.status || '').trim().toLowerCase().replace(/[^a-z\s]/g, '');
      const mappedStatus = rawStatus
        ? (statusAlias[rawStatus] || (validStatuses.has(rawStatus) ? rawStatus : 'nieuw'))
        : 'nieuw';

      // Bron-tag uit het bestand behouden mits aanwezig; anders houden we
      // de import-tag 'excel_import' zodat audit-rapportages onveranderd
      // blijven werken.
      const rawBron = (lead.bron || '').trim();
      const bron = rawBron || 'excel_import';

      const fields: Record<string, unknown> = {
        branch,
        naam_klant: naam,
        email: email || null,
        telefoonnummer: cleanPhone || null,
        phone_valid: cleanPhone ? isPhoneValid(cleanPhone) : null,
        postcode: postcode || null,
        huisnummer: huisnummer || null,
        plaatsnaam: (lead.plaatsnaam || '').trim() || null,
        provincie: (lead.provincie || '').trim() || null,
        wervingsdatum: parsedWervingsdatum,
        wervingsdatum_unknown: parsedWervingsdatum === null,
        status: mappedStatus,
        bron,
        notities: (lead.notities || '').trim() || null,
      };

      const customFields: Record<string, string> = {};
      for (const [key, value] of Object.entries(lead)) {
        if (!commonKeys.has(key) && value && String(value).trim()) {
          customFields[key] = String(value).trim();
        }
      }
      if (Object.keys(customFields).length > 0) {
        fields.custom_fields = customFields;
      }

      if (checkLeadProfanity(fields as Record<string, unknown>).blocked) {
        skipped++;
        continue;
      }

      if (email) existingEmails.add(email.toLowerCase());
      if (normPhone) existingPhones.add(normPhone);
      prepared.push(fields);
    }

    // Pass 2: Enrich addresses in parallel batches (the slow part, now concurrent)
    const BATCH_INSERT: Record<string, unknown>[] = [];
    let prospectsInserted = 0;

    for (let i = 0; i < prepared.length; i += ENRICH_CONCURRENCY) {
      const batch = prepared.slice(i, i + ENRICH_CONCURRENCY);
      const enriched = await Promise.all(
        batch.map(async (fields) => {
          if (fields.postcode && fields.huisnummer) {
            try {
              return await enrichLeadAddress(fields as Parameters<typeof enrichLeadAddress>[0]);
            } catch { return fields; }
          }
          return fields;
        })
      );

      for (const e of enriched) {
        const row = e as Record<string, unknown>;
        if (isPartnerProspectBranch(branch)) {
          const cf =
            row.custom_fields &&
            typeof row.custom_fields === 'object' &&
            !Array.isArray(row.custom_fields)
              ? (row.custom_fields as Record<string, string>)
              : {};
          const partnerBranch =
            normalizePartnerProspectBranchSlug(branch) as PartnerProspectBranchSlug;
          const accountManagerId = await resolvePartnerProspectAccountManagerId(
            supabase,
            partnerBranch,
          );
          const insRow = buildPartnerProspectInsertRow(
            partnerBranch,
            row as unknown as PartnerProspectPayload,
            cf,
            {
              plaatsnaam: row.plaatsnaam as string | undefined,
              provincie: row.provincie as string | undefined,
              postcode: row.postcode as string | undefined,
              land: row.land as string | undefined,
            },
            accountManagerId,
          );
          const pr = await insertPartnerProspect(supabase, insRow, {
            title: `Spreadsheet import (${partnerProspectIngestLabel(partnerBranch)})`,
            body: 'Geïmporteerd via admin spreadsheet-import.',
            type: 'import',
            adminUserId: admin.id,
          });
          if (pr) prospectsInserted++;
          else {
            errors++;
            if (errorDetails.length < 5) errorDetails.push('Prospect-insert mislukt');
          }
          continue;
        }
        row.quality_score = calculateQualityScore(row);
        BATCH_INSERT.push(row);
        imported++;
      }
    }

    // Bulk insert in chunks, collect inserted IDs (alleen consumentenleads)
    let dbErrors = 0;
    const insertedIds: string[] = [];
    const CHUNK = 100;
    if (!isPartnerProspectBranch(branch)) {
      for (let i = 0; i < BATCH_INSERT.length; i += CHUNK) {
        const chunk = BATCH_INSERT.slice(i, i + CHUNK);
        const { data: inserted, error: insertError } = await supabase.from('leads').insert(chunk).select('id');
        if (insertError) {
          dbErrors += chunk.length;
          if (errorDetails.length < 5) {
            errorDetails.push(`DB insert fout: ${insertError.message}`);
          }
        } else if (inserted) {
          insertedIds.push(...inserted.map(r => r.id));
        }
      }

      if (dbErrors > 0) {
        imported = Math.max(0, imported - dbErrors);
        errors += dbErrors;
      }
    }

    const totalImported = isPartnerProspectBranch(branch) ? prospectsInserted : imported;

    logAudit({
      adminId: admin.id,
      adminName: admin.name,
      action: 'spreadsheet_import',
      entityType: isPartnerProspectBranch(branch) ? 'prospect' : 'lead',
      details: { branch, imported: totalImported, skipped, duplicates, errors },
    });

    return NextResponse.json({
      imported: totalImported,
      skipped,
      duplicates,
      errors,
      unparseableDates,
      errorDetails,
      insertedIds,
      ...(isPartnerProspectBranch(branch) ? { ingest: 'prospect' as const } : {}),
    });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json(
      { error: 'Import mislukt', details: err instanceof Error ? err.message : 'Onbekende fout' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const { error } = await requireSuperAdmin(request);
  if (error) return error;

  const supabase = createServerClient();
  const { data: rows } = await supabase
    .from('app_settings')
    .select('key, value')
    .like('key', 'spreadsheet_import:%');

  // De keys hebben format `spreadsheet_import:${branch}:${Date.now()}`. Sorteren
  // op de hele key levert een alfabetische sort op branch-naam (Zonnepanelen
  // staat dan altijd bovenaan, terwijl Thuisbatterij-imports verstopt blijven).
  // Daarom sorteren we expliciet op de timestamp uit de value (`date`), met
  // fallback op de trailing numerieke component uit de key zelf.
  const history = (rows || [])
    .map(r => {
      try {
        const val = JSON.parse(r.value);
        const dateMs = val?.date ? Date.parse(val.date) : NaN;
        const tail = r.key.split(':').pop() || '';
        const tailMs = /^\d+$/.test(tail) ? Number(tail) : NaN;
        const sortKey = Number.isFinite(dateMs) ? dateMs : Number.isFinite(tailMs) ? tailMs : 0;
        return { run_id: r.key, sortKey, ...val };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => (b!.sortKey as number) - (a!.sortKey as number))
    .map(({ sortKey: _ignored, ...rest }) => rest);

  return NextResponse.json({ history });
}

export async function DELETE(request: NextRequest) {
  const { admin, error } = await requireSuperAdmin(request);
  if (error || !admin) return error!;

  const { run_id } = await request.json();
  if (!run_id) return NextResponse.json({ error: 'run_id is verplicht' }, { status: 400 });

  const supabase = createServerClient();
  const { data: row } = await supabase.from('app_settings').select('value').eq('key', run_id).single();
  if (!row) return NextResponse.json({ error: 'Import run niet gevonden' }, { status: 404 });

  let leadIds: string[] = [];
  try { leadIds = JSON.parse(row.value).lead_ids || []; } catch {
    return NextResponse.json({ error: 'Ongeldige run data' }, { status: 400 });
  }

  if (leadIds.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < leadIds.length; i += CHUNK) {
      const chunk = leadIds.slice(i, i + CHUNK);
      await supabase.from('lead_feedback').delete().in('lead_id', chunk);
      await supabase.from('leads').delete().in('id', chunk);
    }
  }

  await supabase.from('app_settings').delete().eq('key', run_id);

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'spreadsheet_import_undo',
    entityType: 'lead',
    details: { run_id, deleted: leadIds.length },
  });

  return NextResponse.json({ ok: true, deleted: leadIds.length });
}
