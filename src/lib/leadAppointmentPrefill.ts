/** Velden om BookAppointmentModal te vullen vanuit een portal-lead. */
export type LeadAppointmentPrefill = {
  lead_id?: string;
  lead_assignment_id?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  street?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  branch?: string;
};

export function leadRowToAppointmentPrefill(lead: Record<string, unknown>): LeadAppointmentPrefill {
  const cf =
    lead.custom_fields && typeof lead.custom_fields === 'object' && !Array.isArray(lead.custom_fields)
      ? (lead.custom_fields as Record<string, string>)
      : {};
  const straat = cf.straat || cf.street || cf.adres || '';
  return {
    lead_id: typeof lead.id === 'string' ? lead.id : undefined,
    lead_assignment_id:
      typeof lead.assignment_id === 'string'
        ? lead.assignment_id
        : typeof lead.lead_assignment_id === 'string'
          ? lead.lead_assignment_id
          : undefined,
    contact_name: typeof lead.naam_klant === 'string' ? lead.naam_klant : undefined,
    contact_phone: typeof lead.telefoonnummer === 'string' ? lead.telefoonnummer : undefined,
    contact_email: typeof lead.email === 'string' ? lead.email : undefined,
    street: straat ? String(straat) : undefined,
    house_number: typeof lead.huisnummer === 'string' ? lead.huisnummer : undefined,
    postcode: typeof lead.postcode === 'string' ? lead.postcode : undefined,
    city: typeof lead.plaatsnaam === 'string' ? lead.plaatsnaam : undefined,
    branch: typeof lead.branch === 'string' ? lead.branch : undefined,
  };
}
