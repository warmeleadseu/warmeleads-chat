import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { enrichLeadAddress } from '@/lib/pdok';
import { isPhoneValid } from '@/lib/phoneValidation';
import { checkLeadProfanity } from '@/lib/profanityFilter';
import { calculateQualityScore } from '@/lib/leadQuality';
import { logAudit } from '@/lib/audit';

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

function parseDateValue(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];

  // Excel serial date (number like 45678)
  const num = Number(raw);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + num);
    return epoch.toISOString().split('T')[0];
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  // YYYY-MM-DD (already ISO)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return new Date().toISOString().split('T')[0];
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

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
    const errorDetails: string[] = [];
    const BATCH_INSERT: Record<string, unknown>[] = [];

    for (const lead of leads) {
      const naam = (lead.naam_klant || '').trim();
      const email = (lead.email || '').trim();
      const phone = (lead.telefoonnummer || '').trim();

      if (!naam) { skipped++; continue; }
      if (!email && !phone) { skipped++; continue; }

      const normPhone = normalizePhone(phone);
      if (email && existingEmails.has(email.toLowerCase())) { duplicates++; continue; }
      if (normPhone && existingPhones.has(normPhone)) { duplicates++; continue; }

      try {
        const postcode = cleanPostcode(lead.postcode || '');
        const huisnummer = (lead.huisnummer || '').trim();

        const commonFields: Record<string, unknown> = {
          branch,
          naam_klant: naam,
          email: email || null,
          telefoonnummer: phone || null,
          phone_valid: phone ? isPhoneValid(phone) : null,
          postcode: postcode || null,
          huisnummer: huisnummer || null,
          plaatsnaam: (lead.plaatsnaam || '').trim() || null,
          provincie: (lead.provincie || '').trim() || null,
          wervingsdatum: parseDateValue(lead.wervingsdatum || ''),
          status: 'nieuw',
          bron: 'excel_import',
          notities: (lead.notities || '').trim() || null,
        };

        // Custom fields
        const customFields: Record<string, string> = {};
        const commonKeys = new Set([
          'naam_klant', 'email', 'telefoonnummer', 'postcode', 'huisnummer',
          'plaatsnaam', 'provincie', 'wervingsdatum', 'status', 'bron', 'notities',
        ]);
        for (const [key, value] of Object.entries(lead)) {
          if (!commonKeys.has(key) && value && String(value).trim()) {
            customFields[key] = String(value).trim();
          }
        }
        if (Object.keys(customFields).length > 0) {
          commonFields.custom_fields = customFields;
        }

        // Enrich address
        let enriched = commonFields;
        if (postcode && huisnummer) {
          try {
            enriched = await enrichLeadAddress(commonFields as Parameters<typeof enrichLeadAddress>[0]);
          } catch { /* use unenriched data */ }
        }

        // Profanity check
        if (checkLeadProfanity(enriched as Record<string, unknown>).blocked) {
          skipped++;
          continue;
        }

        enriched.quality_score = calculateQualityScore(enriched);

        BATCH_INSERT.push(enriched);

        if (email) existingEmails.add(email.toLowerCase());
        if (normPhone) existingPhones.add(normPhone);
        imported++;
      } catch (err) {
        errors++;
        if (errorDetails.length < 5) {
          errorDetails.push(`${err instanceof Error ? err.message : 'Onbekende fout'} (${naam})`);
        }
      }
    }

    // Bulk insert in chunks, collect inserted IDs
    let dbErrors = 0;
    const insertedIds: string[] = [];
    const CHUNK = 100;
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

    logAudit({
      adminId: admin.id,
      adminName: admin.name,
      action: 'spreadsheet_import',
      entityType: 'lead',
      details: { branch, imported, skipped, duplicates, errors },
    });

    return NextResponse.json({ imported, skipped, duplicates, errors, errorDetails, insertedIds });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json(
      { error: 'Import mislukt', details: err instanceof Error ? err.message : 'Onbekende fout' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { data: rows } = await supabase
    .from('app_settings')
    .select('key, value')
    .like('key', 'spreadsheet_import:%')
    .order('key', { ascending: false });

  const history = (rows || []).map(r => {
    try {
      const val = JSON.parse(r.value);
      return { run_id: r.key, ...val };
    } catch { return null; }
  }).filter(Boolean);

  return NextResponse.json({ history });
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

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
