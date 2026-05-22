export const TEAMLEADER_API_BASE = 'https://api.focus.teamleader.eu';
export const TEAMLEADER_AUTH_BASE = 'https://focus.teamleader.eu';

export const DEFAULT_DEAL_TITLE_TEMPLATE = 'Warme Leads — {branch_name} — {naam_klant}';

export {
  getTeamleaderOAuthConfig,
  isTeamleaderConfigured,
  stripEnvValue,
} from './credentials';
export type { TeamleaderOAuthConfig } from './credentials';
