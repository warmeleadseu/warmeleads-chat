export const TEAMLEADER_PROVIDER = 'teamleader' as const;

export type TeamleaderIntegrationSettings = {
  enabled?: boolean;
  pipeline_id?: string | null;
  pipeline_name?: string | null;
  deal_title_template?: string | null;
  /** Cached first phase id for selected pipeline */
  phase_id?: string | null;
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
