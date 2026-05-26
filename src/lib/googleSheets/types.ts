export const GOOGLE_SHEETS_PROVIDER = 'google_sheets' as const;

export type GoogleSheetsTokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

/** branch slug → portaalveld → kolomindex (0-based, als string) */
export type SheetBranchFieldMapping = Record<string, string>;

export type GoogleSheetsFieldMappings = Record<string, SheetBranchFieldMapping>;

export type GoogleSheetsConnectionMode = 'service_account' | 'oauth';

export type GoogleSheetsIntegrationSettings = {
  enabled?: boolean;
  connection_mode?: GoogleSheetsConnectionMode;
  spreadsheet_id?: string | null;
  spreadsheet_url?: string | null;
  sheet_gid?: number | null;
  sheet_name?: string | null;
  field_mappings?: GoogleSheetsFieldMappings;
};

/** Integratie-instellingen zonder OAuth-tokens (standaard URL + service account). */
export type GoogleSheetsIntegrationPublic = {
  id: string;
  customer_id: string;
  settings: GoogleSheetsIntegrationSettings;
  connected_at: string | null;
  connection_mode: GoogleSheetsConnectionMode | null;
};
