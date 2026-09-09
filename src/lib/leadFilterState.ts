/**
 * De filterstand van het Leads-CRM als één geheel, zodat "alle filters
 * verwijderen" niet zestien losse setters in een component van 1700 regels is.
 *
 * Bewust géén onderdeel hiervan: sortering, rijen per pagina, paginanummer en
 * de aangevinkte leads. Dat zijn weergavevoorkeuren en een werkselectie, geen
 * filters; die door elkaar halen kost de gebruiker werk in plaats van dat het
 * hem helpt.
 */

export type LeadFilterStand = {
  search: string;
  selBranches: string[];
  selCustomers: string[];
  selStatuses: string[];
  selProvinces: string[];
  selSources: string[];
  selCampaigns: string[];
  assignmentFilter: 'all' | 'assigned' | 'unassigned';
  phoneFilter: string;
  bulkFilter: string;
  dateFrom: string;
  dateTo: string;
  includeUnknownDate: boolean;
  plaatsFilter: string;
  plaatsRadiusKm: number | null;
  postcodeRanges: string;
};

/** De stand waarin niets gefilterd is. */
export const LEGE_LEADFILTERS: LeadFilterStand = {
  search: '',
  selBranches: [],
  selCustomers: [],
  selStatuses: [],
  selProvinces: [],
  selSources: [],
  selCampaigns: [],
  assignmentFilter: 'all',
  phoneFilter: 'all',
  bulkFilter: 'all',
  dateFrom: '',
  dateTo: '',
  includeUnknownDate: true,
  plaatsFilter: '',
  plaatsRadiusKm: null,
  postcodeRanges: '',
};

/**
 * Hoeveel filters staan er aan? Het getal komt op de knop te staan, zodat
 * zichtbaar is hoeveel er wordt opgeruimd.
 *
 * `includeUnknownDate` telt niet apart mee: dat is een verfijning van het
 * datumfilter en verschijnt alleen als er een datum is ingevuld. Losse straal
 * evenmin: die hoort bij de plaatsnaam.
 */
export function telActieveLeadFilters(stand: LeadFilterStand): number {
  let n = 0;
  if (stand.search.trim()) n++;
  if (stand.selBranches.length) n++;
  if (stand.selCustomers.length) n++;
  if (stand.selStatuses.length) n++;
  if (stand.selProvinces.length) n++;
  if (stand.selSources.length) n++;
  if (stand.selCampaigns.length) n++;
  if (stand.assignmentFilter !== 'all') n++;
  if (stand.phoneFilter !== 'all') n++;
  if (stand.bulkFilter !== 'all') n++;
  if (stand.dateFrom || stand.dateTo) n++;
  if (stand.plaatsFilter.trim()) n++;
  if (stand.postcodeRanges.trim()) n++;
  return n;
}
