export type CrmProviderId = 'teamleader' | 'hubspot' | 'pipedrive' | 'salesforce';

export type CrmProviderStatus = 'available' | 'coming_soon';

export type CrmProvider = {
  id: CrmProviderId;
  name: string;
  shortName: string;
  description: string;
  status: CrmProviderStatus;
  /** Korte uitleg voor de setup-stap */
  setupHint: string;
};

export const CRM_PROVIDERS: CrmProvider[] = [
  {
    id: 'teamleader',
    name: 'Teamleader Focus',
    shortName: 'Teamleader',
    description:
      'Leads automatisch als contact en deal in je Teamleader-account. Je gebruikt je eigen OAuth-app (BYOA).',
    status: 'available',
    setupHint: 'Registreer een private app in de Teamleader Marketplace en autoriseer de koppeling.',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    shortName: 'HubSpot',
    description: 'Synchroniseer leads naar HubSpot contacts en deals.',
    status: 'coming_soon',
    setupHint: 'Binnenkort beschikbaar.',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    shortName: 'Pipedrive',
    description: 'Zet leads direct om naar personen en deals in Pipedrive.',
    status: 'coming_soon',
    setupHint: 'Binnenkort beschikbaar.',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    shortName: 'Salesforce',
    description: 'Koppel leads aan Salesforce leads of opportunities.',
    status: 'coming_soon',
    setupHint: 'Binnenkort beschikbaar.',
  },
];

export const AVAILABLE_CRM_IDS = CRM_PROVIDERS.filter((p) => p.status === 'available').map(
  (p) => p.id,
);

export function getCrmProvider(id: string | null | undefined): CrmProvider | undefined {
  return CRM_PROVIDERS.find((p) => p.id === id);
}

export function isCrmProviderAvailable(id: string | null | undefined): boolean {
  const p = getCrmProvider(id);
  return p?.status === 'available';
}
