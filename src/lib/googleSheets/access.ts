import type { SupabaseClient } from '@supabase/supabase-js';
import { getGoogleServiceAccountEmail } from './config';
import {
  ensureValidGoogleAccessToken,
  getGoogleSheetsIntegration,
} from './integrationRepo';
import {
  getGoogleServiceAccountAccessToken,
  isGoogleServiceAccountConfigured,
} from './serviceAccount';

/** Foutmelding wanneer de spreadsheet niet met ons service account is gedeeld. */
export function googleSheetsAccessDeniedMessage(): string {
  const email = getGoogleServiceAccountEmail();
  return `Geen toegang tot deze spreadsheet. Deel het bestand in Google met ${email} als bewerker en probeer opnieuw.`;
}

/**
 * OAuth-token van de klant (legacy) heeft voorrang; anders service account van Warme Leads.
 */
export async function resolveGoogleSheetsAccessToken(
  supabase: SupabaseClient,
  customerId: string,
): Promise<string> {
  const oauthIntegration = await getGoogleSheetsIntegration(supabase, customerId);
  if (oauthIntegration) {
    return ensureValidGoogleAccessToken(supabase, oauthIntegration);
  }

  if (!isGoogleServiceAccountConfigured()) {
    throw new Error(
      'Google Spreadsheets is niet beschikbaar op de server. Neem contact op met Warme Leads.',
    );
  }

  return getGoogleServiceAccountAccessToken();
}
