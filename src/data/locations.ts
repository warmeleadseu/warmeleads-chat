/**
 * Local SEO Data - Nederlandse Provincies en Steden
 * Voor dynamische generatie van lokale landing pages
 */
import { getBranchLeadContent } from './branchLeadContent';

export interface Province {
  name: string;
  slug: string;
}

export interface City {
  name: string;
  slug: string;
  province: string;
}

export const provinces: Province[] = [
  { name: 'Groningen', slug: 'groningen' },
  { name: 'Friesland', slug: 'friesland' },
  { name: 'Drenthe', slug: 'drenthe' },
  { name: 'Overijssel', slug: 'overijssel' },
  { name: 'Flevoland', slug: 'flevoland' },
  { name: 'Gelderland', slug: 'gelderland' },
  { name: 'Utrecht', slug: 'utrecht' },
  { name: 'Noord-Holland', slug: 'noord-holland' },
  { name: 'Zuid-Holland', slug: 'zuid-holland' },
  { name: 'Zeeland', slug: 'zeeland' },
  { name: 'Noord-Brabant', slug: 'noord-brabant' },
  { name: 'Limburg', slug: 'limburg' },
];

export const cities: City[] = [
  { name: 'Amsterdam', slug: 'amsterdam', province: 'Noord-Holland' },
  { name: 'Rotterdam', slug: 'rotterdam', province: 'Zuid-Holland' },
  { name: 'Den Haag', slug: 'den-haag', province: 'Zuid-Holland' },
  { name: 'Utrecht', slug: 'utrecht', province: 'Utrecht' },
  { name: 'Eindhoven', slug: 'eindhoven', province: 'Noord-Brabant' },
  { name: 'Groningen', slug: 'groningen', province: 'Groningen' },
  { name: 'Tilburg', slug: 'tilburg', province: 'Noord-Brabant' },
  { name: 'Almere', slug: 'almere', province: 'Flevoland' },
  { name: 'Breda', slug: 'breda', province: 'Noord-Brabant' },
  { name: 'Nijmegen', slug: 'nijmegen', province: 'Gelderland' },
  { name: 'Enschede', slug: 'enschede', province: 'Overijssel' },
  { name: 'Apeldoorn', slug: 'apeldoorn', province: 'Gelderland' },
  { name: 'Haarlem', slug: 'haarlem', province: 'Noord-Holland' },
  { name: 'Arnhem', slug: 'arnhem', province: 'Gelderland' },
  { name: 'Zaanstad', slug: 'zaanstad', province: 'Noord-Holland' },
  { name: 'Amersfoort', slug: 'amersfoort', province: 'Utrecht' },
  { name: 'Haarlemmermeer', slug: 'haarlemmermeer', province: 'Noord-Holland' },
  { name: "'s-Hertogenbosch", slug: 's-hertogenbosch', province: 'Noord-Brabant' },
  { name: 'Zoetermeer', slug: 'zoetermeer', province: 'Zuid-Holland' },
  { name: 'Zwolle', slug: 'zwolle', province: 'Overijssel' },
  { name: 'Leiden', slug: 'leiden', province: 'Zuid-Holland' },
  { name: 'Maastricht', slug: 'maastricht', province: 'Limburg' },
  { name: 'Dordrecht', slug: 'dordrecht', province: 'Zuid-Holland' },
  { name: 'Ede', slug: 'ede', province: 'Gelderland' },
  { name: 'Alphen aan den Rijn', slug: 'alphen-aan-den-rijn', province: 'Zuid-Holland' },
];

export interface Branch {
  name: string;
  slug: string;
  emoji: string;
  keywords: string;
}

export const branches: Branch[] = [
  {
    name: 'Thuisbatterij',
    slug: 'thuisbatterijen',
    emoji: '🔋',
    keywords: 'thuisbatterij leads, energie opslag leads, thuisbatterij installateurs, batterij opslag leads'
  },
  {
    name: 'Zonnepaneel',
    slug: 'zonnepanelen',
    emoji: '☀️',
    keywords: 'zonnepaneel leads, zonnepanelen leads, solar leads, zonnepaneel installateurs'
  },
  {
    name: 'Warmtepomp',
    slug: 'warmtepompen',
    emoji: '🌡️',
    keywords: 'warmtepomp leads, warmtepompen leads, heat pump leads, warmtepomp installateurs'
  },
  {
    name: 'Airco',
    slug: 'airco',
    emoji: '❄️',
    keywords: 'airco leads, airconditioning leads, airco installateurs, klimaat leads'
  },
  {
    name: 'Financial Lease',
    slug: 'financial-lease',
    emoji: '💼',
    keywords: 'financial lease leads, zakelijke financiering leads, lease leads, financial lease adviseurs'
  },
];

/**
 * Generate all location combinations for SEO
 */
export function generateLocationCombinations() {
  const combinations: Array<{ branch: Branch; location: City | Province; type: 'city' | 'province' }> = [];

  // City combinations
  branches.forEach(branch => {
    cities.forEach(city => {
      combinations.push({ branch, location: city, type: 'city' });
    });
  });

  // Province combinations
  branches.forEach(branch => {
    provinces.forEach(province => {
      combinations.push({ branch, location: province, type: 'province' });
    });
  });

  return combinations;
}

/**
 * Generate URL slug for a location page
 */
export function generateLocationSlug(branchSlug: string, locationSlug: string): string {
  return `leads-${branchSlug}-${locationSlug}`;
}

/**
 * Get location metadata for SEO
 */
export function getLocationMetadata(
  branch: Branch,
  location: City | Province,
  type: 'city' | 'province'
) {
  const locationName = location.name;
  const branchName = branch.name;
  const isCity = type === 'city';
  const province = isCity ? (location as City).province : '';

  // Prijs komt uit de centrale branche-config (single source of truth) i.p.v.
  // een hardcoded bedrag; "15 minuten delivery" is bewust vervangen door de
  // realistische, verifieerbare claim "realtime in je portaal".
  const content = getBranchLeadContent(branch.slug);
  const priceFrom = content ? `€${content.exclusivePriceFrom.toFixed(2).replace('.', ',')}` : null;
  const priceZin = priceFrom ? ` Vanaf ${priceFrom} per lead.` : '';

  return {
    title: `${branchName} Leads ${locationName} | Exclusieve & Gedeelde Leads | WarmeLeads`,
    description: `Krijg meer ${branchName.toLowerCase()} klanten in ${locationName}! Exclusieve en gedeelde leads voor installateurs, realtime in je portaal.${priceZin}`,
    keywords: `${branch.keywords}, ${locationName.toLowerCase()}, warme leads ${locationName.toLowerCase()}, exclusieve leads ${locationName.toLowerCase()}, gedeelde leads ${locationName.toLowerCase()}, energie leads ${locationName.toLowerCase()}`,
    ogTitle: `${branchName} Leads ${locationName} | WarmeLeads`,
    ogDescription: `Krijg meer ${branchName.toLowerCase()} klanten in ${locationName}! Exclusieve en gedeelde leads voor installateurs, realtime in je portaal.`,
    ogImage: `https://www.warmeleads.eu/api/og?title=${encodeURIComponent(`${branchName} Leads ${locationName}`)}&location=${encodeURIComponent(locationName)}`,
    schemaName: `${branchName} Leads ${locationName}`,
    schemaDescription: `Exclusieve en gedeelde ${branchName.toLowerCase()} leads voor installateurs in ${locationName}`,
    schemaAreaServed: {
      type: isCity ? 'City' : 'State',
      name: locationName,
      containedInPlace: isCity ? {
        type: 'AdministrativeArea',
        name: province
      } : {
        type: 'Country',
        name: 'Nederland'
      }
    }
  };
}
