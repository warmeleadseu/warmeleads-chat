import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogArticles } from "@/data/blogArticles";
import BlogPostClient from "@/components/BlogPostClient";

const NL_MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maart: '03', april: '04',
  mei: '05', juni: '06', juli: '07', augustus: '08',
  september: '09', oktober: '10', november: '11', december: '12',
};

function toISO(nlDate: string): string {
  const parts = nlDate.toLowerCase().trim().split(/\s+/);
  if (parts.length !== 3) return nlDate;
  const [day, month, year] = parts;
  const mm = NL_MONTHS[month];
  if (!mm) return nlDate;
  return `${year}-${mm}-${day.padStart(2, '0')}T00:00:00Z`;
}

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

// Generate static params for all blog articles
export async function generateStaticParams() {
  return blogArticles.map((article) => ({
    slug: article.slug,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const article = blogArticles.find((a) => a.slug === params.slug);
  
  if (!article) {
    return {
      title: "Artikel niet gevonden | WarmeLeads",
    };
  }

  return {
    title: `${article.title} | WarmeLeads Blog`,
    description: `${article.excerpt} | Lees meer over ${article.category.toLowerCase()} en krijg meer leads voor je bedrijf.`,
    keywords: `${article.keywords.join(", ")}, lead generatie, klanten werven, marketing, warme leads, ${article.category.toLowerCase()}`,
    authors: [{ name: article.author }],
    category: article.category,
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
      canonical: `https://www.warmeleads.eu/blog/${article.slug}`,
    },
    openGraph: {
      title: `${article.title} | WarmeLeads`,
      description: `${article.excerpt} | Ontdek hoe je meer leads krijgt voor ${article.category.toLowerCase()}.`,
      url: `https://www.warmeleads.eu/blog/${article.slug}`,
      siteName: "WarmeLeads",
      locale: "nl_NL",
      type: "article",
      publishedTime: toISO(article.date),
      modifiedTime: toISO(article.date),
      authors: [article.author],
      tags: article.keywords,
      section: article.category,
      images: [
        {
          url: `https://www.warmeleads.eu/api/og?title=${encodeURIComponent(article.title)}&category=${encodeURIComponent(article.category)}`,
          width: 1200,
          height: 630,
          alt: `${article.title} - WarmeLeads Blog`,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@warmeleads",
      creator: "@warmeleads",
      title: `${article.title} | WarmeLeads`,
      description: `${article.excerpt} | Meer leads voor ${article.category.toLowerCase()}.`,
      images: [`https://www.warmeleads.eu/api/og?title=${encodeURIComponent(article.title)}&category=${encodeURIComponent(article.category)}`],
    },
  };
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const article = blogArticles.find((a) => a.slug === params.slug);

  if (!article) {
    notFound();
  }

  // Find related articles (same category)
  const relatedArticles = blogArticles
    .filter((a) => a.category === article.category && a.slug !== article.slug)
    .slice(0, 3);

  return (
    <>
      <BlogPostClient article={article} relatedArticles={relatedArticles} />
      
      {/* Enhanced Schema.org JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": article.title,
            "description": article.excerpt,
            "image": [
              {
                "@type": "ImageObject",
                "url": `https://www.warmeleads.eu/api/og?title=${encodeURIComponent(article.title)}&category=${encodeURIComponent(article.category)}`,
                "width": 1200,
                "height": 630
              }
            ],
            "author": {
              "@type": "Organization",
              "name": article.author,
              "url": "https://www.warmeleads.eu"
            },
            "publisher": {
              "@type": "Organization",
              "name": "WarmeLeads",
              "url": "https://www.warmeleads.eu",
              "logo": {
                "@type": "ImageObject",
                "url": "https://www.warmeleads.eu/logo-1200x1200.png",
                "width": 1200,
                "height": 1200
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "+31-85-047-7067",
                "contactType": "customer service",
                "availableLanguage": "Dutch"
              }
            },
            "datePublished": toISO(article.date),
            "dateModified": toISO(article.date),
            "keywords": article.keywords.join(", "),
            "articleSection": article.category,
            "inLanguage": "nl-NL",
            "wordCount": article.content ? article.content.split(' ').length : 500,
            "timeRequired": `PT${article.readTime.replace(' min', 'M')}`,
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": `https://www.warmeleads.eu/blog/${article.slug}`
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://www.warmeleads.eu"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Blog",
                  "item": "https://www.warmeleads.eu/blog"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": article.category,
                  "item": `https://www.warmeleads.eu/blog?category=${article.category.toLowerCase()}`
                },
                {
                  "@type": "ListItem",
                  "position": 4,
                  "name": article.title,
                  "item": `https://www.warmeleads.eu/blog/${article.slug}`
                }
              ]
            },
            "potentialAction": {
              "@type": "ReadAction",
              "target": `https://www.warmeleads.eu/blog/${article.slug}`
            }
          })
        }}
      />
    </>
  );
}

