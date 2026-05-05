import type { SupabaseClient } from '@supabase/supabase-js';
import { mergeCustomTiers, type PricingTier } from '@/lib/pricing';
import { isAccountManagerScope } from '@/lib/prospects';
import { renderTemplate } from './templates';
import { resolveSignature } from './templates/_signature';
import { EMAIL_BASE_URL } from '@/lib/email';
import {
  buildUnsubscribeUrl,
  generateUnsubscribeToken,
} from './sendAsAdmin';
import type {
  AdminCtx,
  BranchCtx,
  RecipientCtx,
  RenderCtx,
  RenderedEmail,
  TemplateApplicableTo,
} from './templates/types';
import { asStringArray, pickFirstName } from './templates/_helpers';
import type { EmailTemplate } from './templates';
import { getTemplate } from './templates';

export interface ComposeRecipient {
  type: TemplateApplicableTo;
  id: string;
}

export interface ResolvedRecipient {
  recipient: RecipientCtx;
  unsubscribeToken: string;
  unsubscribeUrl: string;
}

export interface RecipientResolutionResult {
  resolved: ResolvedRecipient[];
  /** IDs die ontoegankelijk waren voor deze admin (AM-scope) */
  forbidden: ComposeRecipient[];
  /** IDs die niet bestonden of geen email-adres hadden */
  invalid: ComposeRecipient[];
}

interface ProspectRow {
  id: string;
  email: string | null;
  contact_person: string | null;
  company_name: string | null;
  branches: string[] | null;
  account_manager_id: string | null;
}

interface CustomerRow {
  id: string;
  email: string | null;
  contact_person: string | null;
  name: string | null;
  branches: string[] | null;
  account_manager_id: string | null;
}

interface BranchRow {
  slug: string;
  name: string;
  pricing_tiers: PricingTier[] | null;
  min_batch_size: number | null;
  nationwide_discount: number | null;
}

interface CustomerPricingRow {
  customer_id: string;
  branch_slug: string;
  pricing_tiers: PricingTier[] | null;
  nationwide_discount: number | null;
}

export interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  title: string | null;
  avatar_url: string | null;
  email_signature_html: string | null;
}

/** Laadt het volledige admin-record voor signature-rendering. */
export async function loadAdminFull(
  supabase: SupabaseClient,
  adminId: string,
): Promise<AdminRow | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role, phone, title, avatar_url, email_signature_html')
    .eq('id', adminId)
    .single();
  if (error || !data) return null;
  return data as AdminRow;
}

export function buildAdminCtx(admin: AdminRow): AdminCtx {
  return {
    id: admin.id,
    name: admin.name,
    firstName: pickFirstName(admin.name),
    email: admin.email,
    phone: admin.phone || undefined,
    title: admin.title || undefined,
    avatarUrl: admin.avatar_url || undefined,
    signatureHtmlOverride: admin.email_signature_html,
  };
}

/**
 * Resolve een lijst recipients vanuit de admin compose-call. Filtert
 * forbidden (AM-scope) en invalid (geen email/niet gevonden) eruit.
 */
export async function resolveRecipients(
  supabase: SupabaseClient,
  admin: { id: string; role: string },
  recipients: ComposeRecipient[],
): Promise<RecipientResolutionResult> {
  const prospectIds = recipients.filter(r => r.type === 'prospect').map(r => r.id);
  const customerIds = recipients.filter(r => r.type === 'customer').map(r => r.id);

  const [prospectsRes, customersRes, branchesRes] = await Promise.all([
    prospectIds.length > 0
      ? supabase
          .from('prospects')
          .select('id, email, contact_person, company_name, branches, account_manager_id')
          .in('id', prospectIds)
      : Promise.resolve({ data: [] as ProspectRow[], error: null }),
    customerIds.length > 0
      ? supabase
          .from('customers')
          .select('id, email, contact_person, name, branches, account_manager_id')
          .in('id', customerIds)
      : Promise.resolve({ data: [] as CustomerRow[], error: null }),
    supabase.from('branches').select('slug, name'),
  ]);

  const slugToName = new Map<string, string>();
  for (const b of (branchesRes.data || []) as { slug: string; name: string }[]) {
    slugToName.set(b.slug, b.name);
  }
  const branchLabel = (slug: string) => slugToName.get(slug) || slug;

  const resolved: ResolvedRecipient[] = [];
  const forbidden: ComposeRecipient[] = [];
  const invalid: ComposeRecipient[] = [];

  const prospects = (prospectsRes.data || []) as ProspectRow[];
  const prospectById = new Map(prospects.map(p => [p.id, p]));
  for (const r of recipients.filter(x => x.type === 'prospect')) {
    const p = prospectById.get(r.id);
    if (!p) {
      invalid.push(r);
      continue;
    }
    if (isAccountManagerScope(admin) && p.account_manager_id !== admin.id) {
      forbidden.push(r);
      continue;
    }
    if (!p.email || !p.email.includes('@')) {
      invalid.push(r);
      continue;
    }
    const token = generateUnsubscribeToken();
    resolved.push({
      recipient: {
        type: 'prospect',
        id: p.id,
        email: p.email,
        name: p.contact_person?.trim() || p.company_name || p.email,
        firstName: pickFirstName(p.contact_person || ''),
        companyName: p.company_name || '',
        branches: (p.branches || []).map(branchLabel),
      },
      unsubscribeToken: token,
      unsubscribeUrl: buildUnsubscribeUrl(token),
    });
  }

  const customers = (customersRes.data || []) as CustomerRow[];
  const customerById = new Map(customers.map(c => [c.id, c]));
  for (const r of recipients.filter(x => x.type === 'customer')) {
    const c = customerById.get(r.id);
    if (!c) {
      invalid.push(r);
      continue;
    }
    if (isAccountManagerScope(admin) && c.account_manager_id !== admin.id) {
      forbidden.push(r);
      continue;
    }
    if (!c.email || !c.email.includes('@')) {
      invalid.push(r);
      continue;
    }
    const token = generateUnsubscribeToken();
    resolved.push({
      recipient: {
        type: 'customer',
        id: c.id,
        email: c.email,
        name: c.contact_person?.trim() || c.name || c.email,
        firstName: pickFirstName(c.contact_person || ''),
        companyName: c.name || '',
        branches: (c.branches || []).map(branchLabel),
      },
      unsubscribeToken: token,
      unsubscribeUrl: buildUnsubscribeUrl(token),
    });
  }

  return { resolved, forbidden, invalid };
}

/**
 * Laadt branches + customer-specifieke pricing zodat we per ontvanger de
 * effectieve tarieven hebben.
 */
export async function loadBranchContexts(
  supabase: SupabaseClient,
  branchSlugs: string[],
  customerIds: string[],
): Promise<{
  branches: Map<string, BranchRow>;
  customerPricing: Map<string, Map<string, CustomerPricingRow>>;
}> {
  const slugs = Array.from(new Set(branchSlugs)).filter(Boolean);
  if (slugs.length === 0) {
    return { branches: new Map(), customerPricing: new Map() };
  }
  const [branchesRes, pricingRes] = await Promise.all([
    supabase
      .from('branches')
      .select('slug, name, pricing_tiers, min_batch_size, nationwide_discount')
      .in('slug', slugs),
    customerIds.length > 0
      ? supabase
          .from('customer_pricing')
          .select('customer_id, branch_slug, pricing_tiers, nationwide_discount')
          .in('customer_id', customerIds)
          .in('branch_slug', slugs)
      : Promise.resolve({ data: [] as CustomerPricingRow[], error: null }),
  ]);

  const branches = new Map<string, BranchRow>();
  for (const b of (branchesRes.data || []) as BranchRow[]) {
    branches.set(b.slug, b);
  }

  const customerPricing = new Map<string, Map<string, CustomerPricingRow>>();
  for (const cp of (pricingRes.data || []) as CustomerPricingRow[]) {
    if (!customerPricing.has(cp.customer_id)) {
      customerPricing.set(cp.customer_id, new Map());
    }
    customerPricing.get(cp.customer_id)!.set(cp.branch_slug, cp);
  }
  return { branches, customerPricing };
}

export function buildBranchCtx(
  branch: BranchRow,
  customerOverride?: CustomerPricingRow | null,
): BranchCtx {
  const branchTiers = branch.pricing_tiers || [];
  const customTiers = customerOverride?.pricing_tiers || [];
  const effective =
    customTiers.length > 0 ? mergeCustomTiers(branchTiers, customTiers) : branchTiers;
  const discount =
    customerOverride?.nationwide_discount != null
      ? Number(customerOverride.nationwide_discount)
      : Number(branch.nationwide_discount || 0);
  return {
    slug: branch.slug,
    name: branch.name,
    pricingTiers: branchTiers,
    effectiveTiers: effective,
    minBatchSize: branch.min_batch_size || 10,
    nationwideDiscount: discount,
  };
}

export interface ComposeRenderInput {
  template: EmailTemplate;
  optionValues: Record<string, unknown>;
  subjectOverride?: string;
}

export interface ComposeRenderResult {
  recipient: ResolvedRecipient;
  subject: string;
  html: string;
  text: string;
  warnings: string[];
}

/**
 * Hoog-niveau helper: gegeven een template + opties + admin + lijst van
 * resolved recipients, render alles en geef per recipient een
 * RenderedEmail terug. Laadt branch- en customer-pricing waar nodig.
 */
export async function renderForRecipients(
  supabase: SupabaseClient,
  admin: AdminRow,
  resolved: ResolvedRecipient[],
  input: ComposeRenderInput,
): Promise<ComposeRenderResult[]> {
  const branchSlugs = asStringArray(input.optionValues.branches);
  const customerIds = resolved
    .filter(r => r.recipient.type === 'customer')
    .map(r => r.recipient.id);

  const { branches, customerPricing } = await loadBranchContexts(
    supabase,
    branchSlugs,
    customerIds,
  );

  const adminCtx = buildAdminCtx(admin);
  const signatureHtml = resolveSignature(adminCtx, EMAIL_BASE_URL);

  return resolved.map(r => {
    const branchesSelected: BranchCtx[] = branchSlugs
      .map(slug => {
        const b = branches.get(slug);
        if (!b) return null;
        const override =
          r.recipient.type === 'customer'
            ? customerPricing.get(r.recipient.id)?.get(slug) || null
            : null;
        return buildBranchCtx(b, override);
      })
      .filter((b): b is BranchCtx => b !== null);

    const ctx: RenderCtx = {
      recipient: r.recipient,
      admin: adminCtx,
      branchesSelected,
      optionValues: input.optionValues,
      unsubscribeUrl: r.unsubscribeUrl,
      signatureHtml,
      baseUrl: EMAIL_BASE_URL,
    };
    const out: RenderedEmail = renderTemplate(input.template, ctx, input.subjectOverride);
    return {
      recipient: r,
      subject: out.subject,
      html: out.html,
      text: out.text,
      warnings: out.warnings || [],
    };
  });
}

export { getTemplate };
