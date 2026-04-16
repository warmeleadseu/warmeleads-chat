'use client';

export function StructuredData() {
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
          "itemListElement": [
            {
              "@type": "Offer",
              "itemOffered": {
                "@type": "Service",
                "name": "Exclusieve Leads Thuisbatterijen"
              },
              "priceSpecification": {
                "@type": "PriceSpecification",
                "price": "37.50",
                "priceCurrency": "EUR",
                "unitText": "per lead"
              }
            },
            {
              "@type": "Offer",
              "itemOffered": {
                "@type": "Service",
                "name": "Gedeelde Leads Thuisbatterijen"
              },
              "priceSpecification": {
                "@type": "PriceSpecification",
                "price": "12.50",
                "priceCurrency": "EUR",
                "unitText": "per lead"
              }
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Hoe snel ontvang ik mijn eerste leads?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "De meeste klanten ontvangen hun eerste leads binnen 24 uur na het activeren van hun campagne. Leads worden direct doorgestuurd naar je portaal zodra ze binnenkomen."
            }
          },
          {
            "@type": "Question",
            "name": "Hoe worden de leads gegenereerd?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Wij gebruiken gerichte online campagnes op platforms zoals Google, Facebook en Instagram om potentiële klanten te bereiken die actief zoeken naar duurzame energieoplossingen."
            }
          },
          {
            "@type": "Question",
            "name": "Kan ik leads ontvangen voor een specifiek gebied?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Ja, je kunt targetgebieden instellen op basis van postcode, stad, provincie of zelfs heel Nederland of België. Je ontvangt alleen leads uit je gekozen werkgebied."
            }
          },
          {
            "@type": "Question",
            "name": "Zit ik vast aan een abonnement?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Nee, er is geen abonnement nodig. Je koopt leads per batch en bepaalt zelf hoeveel leads je wilt ontvangen en in welk tempo."
            }
          }
        ]
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
