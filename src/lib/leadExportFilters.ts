import type { LeadFilterParams } from './leadFilters';

/** Map bulk-export POST body fields to shared LeadFilterParams. */
export function bodyToLeadFilterParams(body: Record<string, unknown>): LeadFilterParams {
  return {
    branch: typeof body.branch === 'string' ? body.branch : null,
    customer_id: typeof body.customer_id === 'string' ? body.customer_id : null,
    exclude_customer_id: typeof body.exclude_customer_id === 'string' ? body.exclude_customer_id : null,
    assignment: typeof body.assignment === 'string' ? body.assignment : null,
    status: typeof body.status === 'string' ? body.status : null,
    province: typeof body.province === 'string' ? body.province : null,
    /* Marge rond de provincie moet meelopen tot in de export, anders zie je in
       het scherm meer leads staan dan er in het bestand belanden. */
    province_margin_km:
      typeof body.province_margin_km === 'string' || typeof body.province_margin_km === 'number'
        ? body.province_margin_km
        : null,
    source: typeof body.source === 'string' ? body.source : null,
    meta_campaign_id: typeof body.meta_campaign_id === 'string' ? body.meta_campaign_id : null,
    phone_valid:
      typeof body.phone_valid === 'string' || typeof body.phone_valid === 'boolean'
        ? (body.phone_valid as string | boolean)
        : null,
    date_from: typeof body.date_from === 'string' ? body.date_from : null,
    date_to: typeof body.date_to === 'string' ? body.date_to : null,
    include_unknown_date:
      typeof body.include_unknown_date === 'string' || typeof body.include_unknown_date === 'boolean'
        ? (body.include_unknown_date as string | boolean)
        : null,
    search: typeof body.search === 'string' ? body.search : null,
    plaats: typeof body.plaats === 'string' ? body.plaats : null,
    plaats_radius_km:
      typeof body.plaats_radius_km === 'string' || typeof body.plaats_radius_km === 'number'
        ? String(body.plaats_radius_km)
        : null,
    bulk_status: typeof body.bulk_status === 'string' ? body.bulk_status : null,
    postcode_ranges: typeof body.postcode_ranges === 'string' ? body.postcode_ranges : null,
  };
}
