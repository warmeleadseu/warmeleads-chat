'use client';

import { BRANCH_LEAD_CONTENT } from '@/data/branchLeadContent';

export function StructuredData() {
  const offerItems = Object.values(BRANCH_LEAD_CONTENT).flatMap(b => ([
    {
      "@type": "Offer",
      "itemOffered": { "@type": "Service", "name": `Exclusieve Leads ${b.branchName}` },
      "priceSpecification": {
        "@type": "PriceSpecification",
        "price": b.exclusivePriceFrom.toFixed(2),
        "priceCurrency": "EUR",
        "unitText": "per lead",
      },
    },
    {
      "@type": "Offer",
      "itemOffered": { "@type": "Service", "name": `Volume Leads ${b.branchName}` },
      "priceSpecification": {
        "@type": "PriceSpecification",
        "price": b.sharedPriceValue.toFixed(2),
        "priceCurrency": "EUR",
        "unitText": "per lead",
      },
    },
  ]));
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.warmeleads.eu/#organization",
        "name": "WarmeLeads",
        "alternateName": "WarmeLeads Nederland",
        "description": "Leadgeneratie specialist voor thuisbatterijen, zonnepanelen, warmtepompen, airco's en financial lease in Nederland en België",
        "url": "https://www.warmeleads.eu",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.warmeleads.eu/logo-1200x1200.png",
          "width": 1200,
          "height": 1200
        },
        "contactPoint": [
          {
            "@type": "ContactPoint",
            "telephone": "+31-85-047-7067",
            "contactType": "customer service",
            "email": "info@warmeleads.eu",
            "availableLanguage": ["Dutch", "English"],
            "areaServed": ["NL", "BE"]
          }
        ],
        "address": {
          "@type": "PostalAddress",
          "addressCountry": "NL"
        },
        "sameAs": [
          "https://www.warmeleads.eu"
        ],
        "foundingDate": "2024",
        "knowsLanguage": ["nl", "en"]
      },
      {
        "@type": "WebSite",
        "@id": "https://www.warmeleads.eu/#website",
        "url": "https://www.warmeleads.eu",
        "name": "WarmeLeads - Leadgeneratie Nederland & België",
        "description": "Verse, kwalitatieve leads voor installatiebedrijven in duurzame energie",
        "publisher": { "@id": "https://www.warmeleads.eu/#organization" },
        "inLanguage": "nl-NL"
      },
      {
        "@type": "ProfessionalService",
        "@id": "https://www.warmeleads.eu/#service",
        "name": "WarmeLeads Leadgeneratie",
        "description": "Performance leadgeneratie voor installatiebedrijven. Verse leads voor thuisbatterijen, zonnepanelen, warmtepompen, airco's en meer.",
        "provider": { "@id": "https://www.warmeleads.eu/#organization" },
        "areaServed": [
          { "@type": "Country", "name": "Nederland" },
          { "@type": "Country", "name": "België" }
        ],
        "serviceType": "Lead Generation",
        "hasOfferCatalog": {
          "@type": "OfferCatalog",
          "name": "Lead Packages",
          "itemListElement": offerItems
        }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://www.warmeleads.eu"
          }
        ]
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
