export const TEAMLEADER_API_BASE = 'https://api.focus.teamleader.eu';
export const TEAMLEADER_AUTH_BASE = 'https://focus.teamleader.eu';

export const DEFAULT_DEAL_TITLE_TEMPLATE = 'Warme Leads — {branch_name} — {naam_klant}';

/** Tag op elk contact/deal uit Warme Leads (test én productie). */
export const WARME_LEADS_CONTACT_TAG = 'Warme Leads';

export {
  getGlobalOAuthConfig,
  getCustomerOAuthConfig,
  getEffectiveOAuthConfig,
  saveCustomerOAuthCredentials,
  clearCustomerOAuthCredentials,
  isTeamleaderConfiguredForCustomer,
  isTeamleaderConfigured,
  getTeamleaderOAuthConfig,
  getCallbackRedirectUri,
  stripEnvValue,
} from './credentials';
export type { TeamleaderOAuthConfig } from './credentials';
