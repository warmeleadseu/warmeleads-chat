export const TEAMLEADER_PROVIDER = 'teamleader' as const;

import type { TeamleaderFieldMappings } from './fieldMappingLogic';

export type TeamleaderIntegrationSettings = {
  enabled?: boolean;
  pipeline_id?: string | null;
  pipeline_name?: string | null;
  deal_title_template?: string | null;
  /** Cached first phase id for selected pipeline */
  phase_id?: string | null;
  /** Per branche: portaalveld → Teamleader custom field id */
  field_mappings?: TeamleaderFieldMappings;
};

export type TeamleaderTokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

export type TeamleaderPipeline = {
  id: string;
  name: string;
  isDefault?: boolean;
};
