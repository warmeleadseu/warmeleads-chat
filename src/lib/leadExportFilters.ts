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
    source: typeof body.source === 'string' ? body.source : null,
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
    bulk_status: typeof body.bulk_status === 'string' ? body.bulk_status : null,
    postcode_ranges: typeof body.postcode_ranges === 'string' ? body.postcode_ranges : null,
  };
}
