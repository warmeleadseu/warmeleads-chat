/**
 * SEO Optimizer Component
 * Adds critical SEO meta tags and structured data to pages
 */

import { Metadata } from 'next';

interface SeoConfig {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  author?: string;
}

export function generateSeoMetadata(config: SeoConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    canonical,
    image = 'https://www.warmeleads.eu/og-default.jpg',
    type = 'website',
    publishedTime,
    author = 'WarmeLeads Expert Team'
  } = config;

  return {
    title: `${title} | WarmeLeads`,
    description,
    keywords: keywords.join(', '),
    authors: [{ name: author }],
    creator: 'WarmeLeads',
    publisher: 'WarmeLeads',
    metadataBase: new URL('https://www.warmeleads.eu'),
    alternates: {
      canonical: canonical || '/',
    },
    openGraph: {
      title,
      description,
      url: canonical ? `https://www.warmeleads.eu${canonical}` : 'https://www.warmeleads.eu',
      siteName: 'WarmeLeads',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'nl_NL',
      type,
      ...(publishedTime && { publishedTime }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
      creator: '@WarmeLeads',
      site: '@WarmeLeads',
    },
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
    verification: {
      google: 'warmeleads-google-verification',
      yandex: 'warmeleads-yandex-verification',
      yahoo: 'warmeleads-yahoo-verification',
    },
  };
}

/**
 * Generate structured data for Organization
 */
export function generateOrganizationStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'WarmeLeads',
    legalName: 'Warmeleads.eu',
    url: 'https://www.warmeleads.eu',
    logo: 'https://www.warmeleads.eu/logo.png',
    foundingDate: '2024',
    founders: [
      {
        '@type': 'Person',
        name: 'WarmeLeads Founders',
      },
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Kattegat 50a',
      addressLocality: 'Groningen',
      postalCode: '9723 JP',
      addressCountry: 'NL',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      availableLanguage: ['Dutch', 'Nederlands'],
      email: 'info@warmeleads.eu',
    },
    sameAs: [
      'https://www.linkedin.com/company/warmeleads',
      'https://twitter.com/warmeleads',
    ],
    description: 'Dé specialist in hoogwaardige leadgeneratie voor thuisbatterijen, zonnepanelen, warmtepompen en financial lease in Nederland.',
  };
}

/**
 * Generate breadcrumb structured data
 */
export function generateBreadcrumbStructuredData(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `https://www.warmeleads.eu${item.url}`,
    })),
  };
}

/**
 * Generate FAQ structured data
 */
export function generateFAQStructuredData(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate Product/Service structured data
 */
export function generateServiceStructuredData(service: {
  name: string;
  description: string;
  price: string;
  category: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: service.category,
    name: service.name,
    description: service.description,
    provider: {
      '@type': 'Organization',
      name: 'WarmeLeads',
      url: 'https://www.warmeleads.eu',
    },
    areaServed: {
      '@type': 'Country',
      name: 'Netherlands',
    },
    availableLanguage: 'Dutch',
    offers: {
      '@type': 'Offer',
      price: service.price,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: 'https://www.warmeleads.eu',
    },
  };
}


