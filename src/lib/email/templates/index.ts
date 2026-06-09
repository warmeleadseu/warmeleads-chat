import type {
  EmailTemplate,
  RenderCtx,
  RenderedEmail,
  TemplateApplicableTo,
} from './types';
import { introProspectTemplate } from './intro_prospect';
import { pricingOverviewTemplate } from './pricing_overview';
import { proposalTemplate } from './proposal';
import { nicheResearchTemplate } from './niche_research';
import { followUpTemplate } from './follow_up';
import { meetingRequestTemplate } from './meeting_request';
import { welcomeCustomerTemplate } from './welcome_customer';
import { reEngageTemplate } from './re_engage';
import { customTemplate } from './custom';
import { neiBegunIntroTemplate } from './nei_begun_intro';
import { applyMergeTags } from './_helpers';

const TEMPLATES: EmailTemplate[] = [
  introProspectTemplate,
  pricingOverviewTemplate,
  proposalTemplate,
  nicheResearchTemplate,
  meetingRequestTemplate,
  followUpTemplate,
  welcomeCustomerTemplate,
  reEngageTemplate,
  neiBegunIntroTemplate,
  customTemplate,
];

const REGISTRY = new Map<string, EmailTemplate>(TEMPLATES.map(t => [t.key, t]));

/**
 * Sommige templates zijn alleen relevant wanneer de ontvanger een specifieke
 * branche-koppeling heeft (bv. de Nij Begun-template alleen voor prospects op
 * `nei_begun_partners`). De drawer mag de hele lijst van geselecteerde
 * recipient-branche-slugs meegeven; we tonen de template als minstens één van
 * de vereiste slugs in die set zit.
 */
const TEMPLATE_BRANCH_REQUIREMENTS: Record<string, readonly string[]> = {
  nei_begun_intro: ['nei_begun_partners'],
};

export function templateBranchRequirement(key: string): readonly string[] | undefined {
  return TEMPLATE_BRANCH_REQUIREMENTS[key];
}

/**
 * Server-side guard: gegeven een template-key en een lijst van resolved
 * recipients met hun originele branche-slugs, geeft de IDs terug van
 * recipients die niet aan de branche-eis voldoen. Lege array = alles oké.
 */
export function findRecipientsMissingBranchRequirement(
  templateKey: string,
  recipients: readonly { id: string; branchSlugs: readonly string[] }[],
): string[] {
  const required = TEMPLATE_BRANCH_REQUIREMENTS[templateKey];
  if (!required || required.length === 0) return [];
  const requiredSet = new Set(required);
  return recipients
    .filter(r => !r.branchSlugs.some(slug => requiredSet.has(slug)))
    .map(r => r.id);
}

export function listTemplates(
  applicableTo?: TemplateApplicableTo,
  recipientBranches?: readonly string[],
): EmailTemplate[] {
  const branchSet = recipientBranches ? new Set(recipientBranches) : null;
  return TEMPLATES.filter(t => {
    if (applicableTo && !t.applicableTo.includes(applicableTo)) return false;
    const required = TEMPLATE_BRANCH_REQUIREMENTS[t.key];
    if (required && required.length > 0) {
      if (!branchSet) return false;
      if (!required.some(slug => branchSet.has(slug))) return false;
    }
    return true;
  });
}

export function getTemplate(key: string): EmailTemplate | null {
  return REGISTRY.get(key) ?? null;
}

/**
 * Volledige render: kiest het juiste subject (override > template default),
 * past merge-tags toe op subject, en geeft het complete RenderedEmail terug.
 */
export function renderTemplate(
  template: EmailTemplate,
  ctx: RenderCtx,
  subjectOverride?: string,
): RenderedEmail {
  const rendered = template.render(ctx);
  const explicit = (subjectOverride || '').trim();
  const baseSubject = explicit || template.defaultSubject(ctx);
  const { text: subjectFinal, missing } = applyMergeTags(baseSubject, ctx);
  const warnings = [...(rendered.warnings || [])];
  if (missing.length > 0) {
    warnings.push(`Onbekende merge-tags in onderwerp: ${missing.join(', ')}`);
  }
  return { ...rendered, subject: subjectFinal, warnings };
}

export type { EmailTemplate } from './types';
