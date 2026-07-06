import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  cities,
  provinces,
  branches,
  getLocationMetadata,
  type City,
  type Province,
} from "@/data/locations";
import { getBranchLeadContent } from "@/data/branchLeadContent";
import { BranchLeadsPageContent, type BranchLeadsLocationLink } from "@/components/BranchLeadsPage";

interface LocalLeadsPageProps {
  params: {
    branch: string;
    location: string;
  };
}

// Generate all possible combinations for static generation
export async function generateStaticParams() {
  const params: Array<{ branch: string; location: string }> = [];

  branches.forEach(branch => {
    cities.forEach(city => {
      params.push({ branch: branch.slug, location: city.slug });
    });
    provinces.forEach(province => {
      params.push({ branch: branch.slug, location: province.slug });
    });
  });

  return params;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: LocalLeadsPageProps): Promise<Metadata> {
  const branch = branches.find(b => b.slug === params.branch);
  const city = cities.find(c => c.slug === params.location);
  const province = provinces.find(p => p.slug === params.location);

  const location = city || province;

  if (!branch || !location) {
    return {
      title: "Pagina niet gevonden | WarmeLeads",
      robots: { index: false, follow: false },
    };
  }

  const locationType = city ? 'city' : 'province';
  const metadata = getLocationMetadata(branch, location, locationType);

  return {
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      // Canonical exact gelijk aan de sitemap-URL voor deze pagina.
      canonical: `/leads/${params.branch}/${params.location}`,
    },
    openGraph: {
      title: metadata.ogTitle,
      description: metadata.ogDescription,
      url: `https://www.warmeleads.eu/leads/${params.branch}/${params.location}`,
      siteName: "WarmeLeads",
      locale: "nl_NL",
      type: "website",
      images: [
        {
          url: metadata.ogImage,
          width: 1200,
          height: 630,
          alt: `${metadata.schemaName} - WarmeLeads`,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@warmeleads",
      creator: "@warmeleads",
      title: metadata.ogTitle,
      description: metadata.ogDescription,
      images: [metadata.ogImage],
    },
  };
}

export default function LocalLeadsPage({ params }: LocalLeadsPageProps) {
  const branch = branches.find(b => b.slug === params.branch);
  const city = cities.find(c => c.slug === params.location);
  const province = provinces.find(p => p.slug === params.location);
  const location = city || province;
  const content = branch ? getBranchLeadContent(branch.slug) : undefined;

  if (!branch || !location || !content) {
    notFound();
  }

  const isCity = Boolean(city);
  const provinceName = isCity ? (location as City).province : (location as Province).name;

  // Interne links: zelfde branche in nabije steden (zelfde provincie) + de provinciepagina,
  // en dezelfde locatie voor andere branches. Verbetert crawlbaarheid en relevantie.
  const relatedLocations: BranchLeadsLocationLink[] = [];
  if (isCity) {
    cities
      .filter(c => c.province === provinceName && c.slug !== location.slug)
      .slice(0, 6)
      .forEach(c => relatedLocations.push({ name: c.name, href: `/leads/${branch.slug}/${c.slug}` }));
    const prov = provinces.find(p => p.name === provinceName);
    if (prov) {
      relatedLocations.push({ name: `Heel ${prov.name}`, href: `/leads/${branch.slug}/${prov.slug}` });
    }
  } else {
    cities
      .filter(c => c.province === (location as Province).name)
      .slice(0, 8)
      .forEach(c => relatedLocations.push({ name: c.name, href: `/leads/${branch.slug}/${c.slug}` }));
  }

  const relatedBranches: BranchLeadsLocationLink[] = branches
    .filter(b => b.slug !== branch.slug)
    .map(b => ({
      name: `${b.name} leads`,
      href: `/leads/${b.slug}/${location.slug}`,
    }));

  return (
    <BranchLeadsPageContent
      branchName={content.branchName}
      metadata={{
        title: `${content.branchName} Leads ${location.name}`,
        heroTitle: content.heroTitle,
        heroSubtitle: content.heroSubtitle,
        heroDescription: content.heroDescription,
        exclusivePrice: content.exclusivePrice,
        sharedPrice: content.sharedPrice,
      }}
      location={{
        name: location.name,
        type: isCity ? 'city' : 'province',
        province: isCity ? provinceName : undefined,
        relatedLocations,
        relatedBranches,
      }}
    />
  );
}
