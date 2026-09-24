import type { LeadFilterStand } from './leadFilterState';

/**
 * Van filterstand naar queryparameters, op één plek.
 *
 * Dit stond viermaal met de hand uitgeschreven: in de lijst, in de facetten,
 * in de parameters die aan het exportvenster worden doorgegeven, en nog eens
 * in dat venster zelf. Vier kopieën van dezelfde zestien regels, en precies
 * wat je dan verwacht ging ook mis: het exportvenster miste `assignment`.
 * Stond het scherm op "niet uitgedeeld" en filterde de lijst naar 32 leads,
 * dan telde en exporteerde het venster er 74, inclusief de 42 die allang aan
 * een klant waren geleverd.
 *
 * Eén functie voor alle vier de plekken haalt die klasse fout weg. Komt er een
 * filter bij, dan krijgt elk scherm hem tegelijk, en `LeadFilterStand` dwingt
 * via de typecontrole af dat het veld nergens vergeten wordt.
 */
export function standNaarFilterParams(stand: LeadFilterStand): Record<string, string> {
  const p: Record<string, string> = {};
  if (stand.selBranches.length > 0) p.branch = stand.selBranches.join(',');
  if (stand.selCustomers.length > 0) p.customer_id = stand.selCustomers.join(',');
  if (stand.selStatuses.length > 0) p.status = stand.selStatuses.join(',');
  if (stand.selProvinces.length > 0) p.province = stand.selProvinces.join(',');
  if (stand.selProvinces.length > 0 && stand.provincieMargeKm != null && stand.provincieMargeKm > 0) {
    p.province_margin_km = String(stand.provincieMargeKm);
  }
  if (stand.selSources.length > 0) p.source = stand.selSources.join(',');
  if (stand.selCampaigns.length > 0) p.meta_campaign_id = stand.selCampaigns.join(',');
  if (stand.assignmentFilter !== 'all') p.assignment = stand.assignmentFilter;
  if (stand.phoneFilter !== 'all') p.phone_valid = stand.phoneFilter;
  if (stand.bulkFilter !== 'all') p.bulk_status = stand.bulkFilter;
  if (stand.dateFrom) p.date_from = stand.dateFrom;
  if (stand.dateTo) p.date_to = stand.dateTo;
  if ((stand.dateFrom || stand.dateTo) && !stand.includeUnknownDate) p.include_unknown_date = 'false';
  if (stand.search.trim()) p.search = stand.search.trim();
  if (stand.plaatsFilter.trim()) p.plaats = stand.plaatsFilter.trim();
  if (stand.plaatsFilter.trim() && stand.plaatsRadiusKm != null) {
    p.plaats_radius_km = String(stand.plaatsRadiusKm);
  }
  if (stand.postcodeRanges.trim()) p.postcode_ranges = stand.postcodeRanges.trim();
  return p;
}

/**
 * De weg terug: van queryparameters naar een filterstand.
 *
 * Het exportvenster begint met wat er op het scherm staat en laat je dat
 * daarna vrij bijstellen. Door dat via deze functie te doen in plaats van veld
 * voor veld over te tikken, kan er niets meer tussenuit vallen: wat hier niet
 * wordt gelezen, valt bij de heenweg meteen door de mand in de rondgangtest.
 */
export function filterParamsNaarStand(params: Record<string, string | undefined>): LeadFilterStand {
  const lijst = (v: string | undefined) => (v ? v.split(',').filter(Boolean) : []);
  const getal = (v: string | undefined) => {
    if (v == null || v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const uitdeling = params.assignment;

  return {
    search: params.search ?? '',
    selBranches: lijst(params.branch),
    selCustomers: lijst(params.customer_id),
    selStatuses: lijst(params.status),
    selProvinces: lijst(params.province),
    selSources: lijst(params.source),
    selCampaigns: lijst(params.meta_campaign_id),
    assignmentFilter: uitdeling === 'assigned' || uitdeling === 'unassigned' ? uitdeling : 'all',
    phoneFilter: params.phone_valid ?? 'all',
    bulkFilter: params.bulk_status ?? 'all',
    dateFrom: params.date_from ?? '',
    dateTo: params.date_to ?? '',
    includeUnknownDate: params.include_unknown_date !== 'false',
    plaatsFilter: params.plaats ?? '',
    plaatsRadiusKm: getal(params.plaats_radius_km),
    postcodeRanges: params.postcode_ranges ?? '',
    provincieMargeKm: getal(params.province_margin_km),
  };
}
