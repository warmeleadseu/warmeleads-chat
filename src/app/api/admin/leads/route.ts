import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { enrichLeadAddress, enrichLeadsAddress } from '@/lib/pdok';
import { distributeLead, distributeLeads } from '@/lib/distribution';
import { isPhoneValid } from '@/lib/phoneValidation';
import { checkLeadProfanity } from '@/lib/profanityFilter';
import { calculateQualityScore } from '@/lib/leadQuality';
import { fireLeadCapi } from '@/lib/aiCapiHooks';
import { logAudit } from '@/lib/audit';
import {
  findRecentPartnerProspectByEmail,
  insertPartnerProspectFromEnrichedLeadRow,
  isPartnerProspectBranch,
} from '@/lib/partnerProspectIngest';
import {
  normalizePartnerProspectBranchSlug,
  PARTNER_PROSPECT_BRANCH_SLUGS,
} from '@/lib/partnerProspectConstants';
import { buildPhoneSearchIlikeClauses, sanitizePostgrestIlike } from '@/lib/phoneSearch';
import { buildPostcodeRangeOrFilter, parsePostcodeRanges } from '@/lib/postcodeRanges';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = request.nextUrl.searchParams;
  const branch = url.get('branch');
  const customerId = url.get('customer_id');
  const excludeCustomerId = url.get('exclude_customer_id');
  const assignment = url.get('assignment');
  const status = url.get('status');
  const province = url.get('province');
  const source = url.get('source');
  const dateFrom = url.get('date_from');
  const dateTo = url.get('date_to');
  // Bij datum-range filters: als true/onbeperkt (default), neem ook leads
  // mee waarvan de wervingsdatum onbekend is (bv. via een import zonder
  // datum-kolom). Voorkomt dat ze onzichtbaar worden in date-range views.
  const includeUnknownDate = url.get('include_unknown_date') !== 'false';
  const search = url.get('search');
  const phoneValid = url.get('phone_valid');
  const page = parseInt(url.get('page') || '1');
  const perPage = Math.min(parseInt(url.get('per_page') || '25'), 200);
  const sortBy = url.get('sort_by') || 'created_at';
  const sortDir = url.get('sort_dir') === 'asc' ? true : false;

  const supabase = createServerClient();
  let query = supabase
    .from('leads')
    .select('*, customers(id, name)', { count: 'exact' });

  if (!branch) {
    query = query.not(
      'branch',
      'in',
      `(${PARTNER_PROSPECT_BRANCH_SLUGS.map(s => `"${s}"`).join(',')})`,
    );
  }

  if (branch) {
    const vals = branch.split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('branch', vals[0]);
    else if (vals.length > 1) query = query.in('branch', vals);
  }
  if (customerId) {
    // assigned_customer_ids wordt door trigger uit lead_assignments gevuld en
    // bevat dus zowel directe owner als alle uitgedeelde toewijzingen.
    const vals = customerId.split(',').filter(Boolean);
    if (vals.length > 0) query = query.overlaps('assigned_customer_ids', vals);
  }
  if (excludeCustomerId) {
    const vals = excludeCustomerId.split(',').filter(Boolean);
    if (vals.length > 0) {
      query = query.not('assigned_customer_ids', 'ov', `{${vals.join(',')}}`);
    }
  }
  if (assignment === 'assigned') query = query.eq('is_assigned', true);
  else if (assignment === 'unassigned') query = query.eq('is_assigned', false);
  if (status) {
    const vals = status.split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('status', vals[0]);
    else if (vals.length > 1) query = query.in('status', vals);
  }
  if (province) {
    const vals = province.split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('provincie', vals[0]);
    else if (vals.length > 1) query = query.in('provincie', vals);
  }
  if (source) {
    const vals = source.split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('bron', vals[0]);
    else if (vals.length > 1) query = query.in('bron', vals);
  }
  if (phoneValid === 'false') query = query.eq('phone_valid', false);
  if (phoneValid === 'true') query = query.eq('phone_valid', true);
  if (dateFrom || dateTo) {
    if (includeUnknownDate) {
      // OR-clause: binnen de range OF wervingsdatum_unknown=true.
      const conds: string[] = [];
      if (dateFrom && dateTo) conds.push(`and(wervingsdatum.gte.${dateFrom},wervingsdatum.lte.${dateTo})`);
      else if (dateFrom) conds.push(`wervingsdatum.gte.${dateFrom}`);
      else if (dateTo) conds.push(`wervingsdatum.lte.${dateTo}`);
      conds.push('wervingsdatum_unknown.eq.true');
      query = query.or(conds.join(','));
    } else {
      if (dateFrom) query = query.gte('wervingsdatum', dateFrom);
      if (dateTo) query = query.lte('wervingsdatum', dateTo);
    }
  }
  if (search) {
    const s = sanitizePostgrestIlike(search);
    const parts = [
      `naam_klant.ilike.%${s}%`,
      `email.ilike.%${s}%`,
      ...buildPhoneSearchIlikeClauses('telefoonnummer', search),
      `postcode.ilike.%${s}%`,
    ];
    query = query.or(parts.join(','));
  }

  if (admin.role === 'accountmanager') {
    const { data: myCustomers } = await supabase.from('customers').select('id').eq('account_manager_id', admin.id);
    const ids = (myCustomers || []).map(c => c.id);
    if (ids.length === 0) return NextResponse.json({ leads: [], total: 0, page, perPage });
    query = query.overlaps('assigned_customer_ids', ids);
  }

  const bulkStatus = url.get('bulk_status');
  if (bulkStatus === 'never') query = query.eq('bulk_export_count', 0);
  else if (bulkStatus === 'once') query = query.eq('bulk_export_count', 1);
  else if (bulkStatus === 'multiple') query = query.gte('bulk_export_count', 2);

  const pcOr = buildPostcodeRangeOrFilter(parsePostcodeRanges(url.get('postcode_ranges')));
  if (pcOr) query = query.or(pcOr);

  const allowedSorts = [
    'created_at', 'naam_klant', 'email', 'status', 'wervingsdatum', 'plaatsnaam', 'provincie', 'branch', 'bulk_export_count',
  ];
  const col = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
  query = query.order(col, { ascending: sortDir });

  const from = (page - 1) * perPage;
  query = query.range(from, from + perPage - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Leads fetch error:', error);
    return NextResponse.json({ error: 'Leads ophalen mislukt' }, { status: 500 });
  }

  const leads = data || [];
  if (leads.length > 0) {
    const leadIds = leads.map((l: { id: string }) => l.id);
    const { data: assignments } = await supabase
      .from('lead_assignments')
      .select('lead_id, customer_id, customers(name), distance_km')
      .in('lead_id', leadIds);

    const assignMap: Record<string, { count: number; customers: string[] }> = {};
    (assignments || []).forEach((a: any) => {
      if (!assignMap[a.lead_id]) assignMap[a.lead_id] = { count: 0, customers: [] };
      assignMap[a.lead_id].count++;
      if (a.customers?.name) assignMap[a.lead_id].customers.push(a.customers.name);
    });

    leads.forEach((l: any) => {
      l.assignment_count = assignMap[l.id]?.count || 0;
      l.assigned_customers = assignMap[l.id]?.customers || [];
    });
  }

  return NextResponse.json({ leads, total: count || 0, page, perPage });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const body = await request.json();
    const supabase = createServerClient();

    if (Array.isArray(body.leads)) {
      const enriched = await enrichLeadsAddress(body.leads);
      let profanitySkipped = 0;
      const clean = enriched.filter((l: any) => {
        l.phone_valid = isPhoneValid(l.telefoonnummer);
        if (checkLeadProfanity(l).blocked) { profanitySkipped++; return false; }
        l.quality_score = calculateQualityScore(l);
        return true;
      });
      if (clean.length === 0) {
        return NextResponse.json({ success: true, count: 0, profanitySkipped });
      }

      const partnerRows = clean.filter((l: any) => isPartnerProspectBranch(l.branch)) as any[];
      const leadRows = clean.filter((l: any) => !isPartnerProspectBranch(l.branch)) as any[];

      let prospectCount = 0;
      const prospectIds: string[] = [];
      let deduplicatedPartner = 0;

      for (const l of partnerRows) {
        if (!l.naam_klant) continue;
        const cf = (l.custom_fields as Record<string, string>) || {};
        const partnerBranch = normalizePartnerProspectBranchSlug(l.branch as string);
        if (!partnerBranch) continue;
        if (l.email) {
          const dup = await findRecentPartnerProspectByEmail(supabase, l.email as string, partnerBranch);
          if (dup) {
            deduplicatedPartner++;
            continue;
          }
        }
        const pr = await insertPartnerProspectFromEnrichedLeadRow(
          supabase,
          l as Record<string, unknown>,
          cf,
          { title: 'Bulk import (partner)', adminUserId: admin.id, type: 'import' },
        );
        if (pr) {
          prospectCount++;
          prospectIds.push(pr.id);
        }
      }

      let insertedLeads: any[] = [];
      if (leadRows.length > 0) {
        const { data, error } = await supabase.from('leads').insert(leadRows).select();
        if (error) {
          console.error('Bulk insert error:', error);
          return NextResponse.json({ error: 'Import mislukt', details: error.message }, { status: 500 });
        }
        insertedLeads = data || [];
        const withCoords = insertedLeads.filter((l: { lat?: number; lng?: number }) => l.lat && l.lng);
        if (withCoords.length > 0) {
          try { await distributeLeads(withCoords); } catch { /* non-blocking */ }
        }
      }

      const total = insertedLeads.length + prospectCount;
      logAudit({
        adminId: admin.id,
        adminName: admin.name,
        action: 'import_leads',
        entityType: 'lead',
        details: {
          count: total,
          profanitySkipped,
          prospect_count: prospectCount,
          lead_count: insertedLeads.length,
          prospect_ids: prospectIds.length ? prospectIds : undefined,
        },
      });
      return NextResponse.json({
        success: true,
        count: total,
        profanitySkipped,
        prospect_count: prospectCount,
        lead_count: insertedLeads.length,
        deduplicated_partner: deduplicatedPartner,
        ingest:
          partnerRows.length && leadRows.length ? 'mixed' : partnerRows.length ? 'prospect' : 'lead',
      });
    }

    const enriched = await enrichLeadAddress(body);
    enriched.phone_valid = isPhoneValid(enriched.telefoonnummer);

    const profanity = checkLeadProfanity(enriched as Record<string, unknown>);
    if (profanity.blocked) {
      return NextResponse.json({ error: `Lead bevat ongepaste taal in veld "${profanity.field}"` }, { status: 422 });
    }

    if (isPartnerProspectBranch(enriched.branch)) {
      if (!enriched.naam_klant) {
        return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 });
      }
      const cf = (enriched.custom_fields as Record<string, string>) || {};
      const partnerBranch = normalizePartnerProspectBranchSlug(enriched.branch);
      if (!partnerBranch) {
        return NextResponse.json({ error: 'Ongeldige partner-branch' }, { status: 400 });
      }
      if (enriched.email) {
        const dup = await findRecentPartnerProspectByEmail(supabase, enriched.email, partnerBranch);
        if (dup) {
          logAudit({
            adminId: admin.id,
            adminName: admin.name,
            action: 'create_lead',
            entityType: 'prospect',
            entityId: dup.id,
            details: { deduplicated: true, branch: enriched.branch, ingest: 'prospect' },
          });
          return NextResponse.json({
            success: true,
            prospect_id: dup.id,
            deduplicated: true,
            ingest: 'prospect',
          });
        }
      }
      const pr = await insertPartnerProspectFromEnrichedLeadRow(
        supabase,
        enriched as Record<string, unknown>,
        cf,
        { title: 'Handmatig aangemaakt (partner)', adminUserId: admin.id, type: 'created' },
      );
      if (!pr?.id) {
        return NextResponse.json({ error: 'Prospect aanmaken mislukt' }, { status: 500 });
      }
      logAudit({
        adminId: admin.id,
        adminName: admin.name,
        action: 'create_lead',
        entityType: 'prospect',
        entityId: pr.id,
        details: { naam: enriched.naam_klant, branch: enriched.branch, ingest: 'prospect' },
      });
      return NextResponse.json({ success: true, prospect: { id: pr.id }, ingest: 'prospect' });
    }

    const quality_score = calculateQualityScore(enriched);

    const { data, error } = await supabase.from('leads').insert({ ...enriched, quality_score }).select().single();
    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: 'Lead aanmaken mislukt', details: error.message }, { status: 500 });
    }
    if (data.lat && data.lng) {
      try { await distributeLead({ id: data.id, branch: data.branch, lat: data.lat, lng: data.lng }); } catch { /* non-blocking */ }
    }
    fireLeadCapi(data.id);
    logAudit({ adminId: admin.id, adminName: admin.name, action: 'create_lead', entityType: 'lead', entityId: data.id, details: { naam: data.naam_klant, branch: data.branch } });
    return NextResponse.json({ success: true, lead: data });
  } catch (err) {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });

    if (updates.telefoonnummer !== undefined) {
      updates.phone_valid = isPhoneValid(updates.telefoonnummer);
    }

    const supabase = createServerClient();

    // AM-scoping: een accountmanager mag alleen leads bewerken die aan een
    // eigen klant zijn toegewezen, en mag een lead niet naar een klant buiten
    // zijn scope (her)toewijzen.
    if (admin.role === 'accountmanager') {
      const { data: myCustomers } = await supabase
        .from('customers').select('id').eq('account_manager_id', admin.id);
      const myIds = (myCustomers || []).map(c => c.id);
      const { data: leadRow } = await supabase
        .from('leads').select('assigned_customer_ids').eq('id', id)
        .maybeSingle<{ assigned_customer_ids: string[] | null }>();
      if (!leadRow) return NextResponse.json({ error: 'Lead niet gevonden' }, { status: 404 });
      const assigned = leadRow.assigned_customer_ids || [];
      if (!myIds.some(cid => assigned.includes(cid))) return forbidden();
      if (updates.customer_id && !myIds.includes(updates.customer_id)) return forbidden();
    }

    const prevCustomerId = updates.customer_id !== undefined
      ? (await supabase.from('leads').select('customer_id').eq('id', id).single()).data?.customer_id
      : undefined;

    const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select().single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 });
    }

    if (updates.customer_id !== undefined && updates.customer_id !== prevCustomerId) {
      if (prevCustomerId) {
        await supabase
          .from('lead_assignments')
          .delete()
          .eq('lead_id', id)
          .eq('customer_id', prevCustomerId);
      }
      if (updates.customer_id) {
        await supabase
          .from('lead_assignments')
          .upsert(
            { lead_id: id, customer_id: updates.customer_id },
            { onConflict: 'lead_id,customer_id' }
          );
      }
    }

    return NextResponse.json({ success: true, lead: data });
  } catch (err) {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs zijn verplicht' }, { status: 400 });
    }

    const supabase = createServerClient();

    // AM-scoping: een accountmanager mag alleen leads (hard) verwijderen die
    // uitsluitend binnen zijn eigen klantenscope vallen. Een globale delete zou
    // anders leads van andere klanten meenemen.
    if (admin.role === 'accountmanager') {
      const { data: myCustomers } = await supabase
        .from('customers').select('id').eq('account_manager_id', admin.id);
      const myIds = new Set((myCustomers || []).map(c => c.id));
      const { data: leadRows } = await supabase
        .from('leads').select('id, assigned_customer_ids').in('id', ids);
      const rows = (leadRows || []) as Array<{ id: string; assigned_customer_ids: string[] | null }>;
      if (rows.length !== ids.length) return forbidden();
      const allWithinScope = rows.every(r => {
        const assigned = r.assigned_customer_ids || [];
        return assigned.length > 0 && assigned.every(cid => myIds.has(cid));
      });
      if (!allWithinScope) return forbidden();
    }

    const { error } = await supabase.from('leads').delete().in('id', ids);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
    }
    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (err) {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
