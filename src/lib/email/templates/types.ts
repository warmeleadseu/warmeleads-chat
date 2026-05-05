import type { PricingTier } from '@/lib/pricing';
import type { EmailScope } from '@/lib/email/sendAsAdmin';

export type TemplateOptionType =
  | 'boolean'
  | 'multiselect'
  | 'select'
  | 'text'
  | 'textarea'
  | 'number'
  | 'richtext';

export interface TemplateOption {
  key: string;
  label: string;
  type: TemplateOptionType;
  description?: string;
  default?: unknown;
  placeholder?: string;
  /** Voor multiselect: 'branches' = haal de lijst dynamisch op */
  source?: 'branches';
  /** Conditioneel tonen: deze optie moet truthy zijn */
  showWhen?: string;
  /** Voor static select */
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

export type TemplateApplicableTo = 'prospect' | 'customer';

export interface RecipientCtx {
  type: 'prospect' | 'customer';
  id: string;
  email: string;
  /** Aanspreeknaam: contact_person als die er is, anders bedrijfsnaam */
  name: string;
  /** Voornaam afgeleid van contact_person (eerste woord) */
  firstName: string;
  /** Bedrijfsnaam */
  companyName: string;
  /** Branche-slugs die aan deze ontvanger gekoppeld zijn */
  branches: string[];
}

export interface AdminCtx {
  id: string;
  name: string;
  firstName: string;
  email: string;
  phone?: string;
  title?: string;
  avatarUrl?: string;
  /** Eventuele HTML override op admin_users.email_signature_html */
  signatureHtmlOverride?: string | null;
}

export interface BranchCtx {
  slug: string;
  name: string;
  pricingTiers: PricingTier[];
  /** Effectieve tiers voor deze ontvanger (na merge met customer_pricing) */
  effectiveTiers: PricingTier[];
  minBatchSize: number;
  nationwideDiscount: number;
}

export interface RenderCtx {
  recipient: RecipientCtx;
  admin: AdminCtx;
  /** Branches die de AM in de opties heeft geselecteerd, met pricing-data */
  branchesSelected: BranchCtx[];
  optionValues: Record<string, unknown>;
  /** Volledige unsubscribe-URL (null voor transactionele) */
  unsubscribeUrl: string | null;
  /** Reeds gerenderde signature HTML (override of auto) */
  signatureHtml: string;
  baseUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  warnings?: string[];
}

export interface EmailTemplate {
  key: string;
  label: string;
  description: string;
  applicableTo: TemplateApplicableTo[];
  scope: EmailScope;
  options: TemplateOption[];
  defaultSubject: (ctx: RenderCtx) => string;
  render: (ctx: RenderCtx) => RenderedEmail;
}
