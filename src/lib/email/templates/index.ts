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
  customTemplate,
];

const REGISTRY = new Map<string, EmailTemplate>(TEMPLATES.map(t => [t.key, t]));

export function listTemplates(applicableTo?: TemplateApplicableTo): EmailTemplate[] {
  if (!applicableTo) return TEMPLATES.slice();
  return TEMPLATES.filter(t => t.applicableTo.includes(applicableTo));
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
