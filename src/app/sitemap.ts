import { MetadataRoute } from 'next'
import { blogArticles } from '@/data/blogArticles'
import { cities, provinces, branches } from '@/data/locations'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.warmeleads.eu'

  // Main pages
  const mainPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/meer-klanten-nodig`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.95,
    },
    {
      url: `${baseUrl}/plan-gesprek`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.95,
    },
    {
      url: `${baseUrl}/leads-thuisbatterijen`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/leads-zonnepanelen`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/leads-warmtepompen`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/leads-airco`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/leads-financial-lease`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/maatwerk-leads`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/leadgeneratie-gids`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/algemene-voorwaarden`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/hoe-het-werkt`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    },
    {
      url: `${baseUrl}/gratis-account`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacyverklaring`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
  ];

  // Local SEO landing pages - Dynamically generated for all cities and provinces
  const localPages: MetadataRoute.Sitemap = [];
  
  branches.forEach(branch => {
    // Add city pages
    cities.forEach(city => {
      localPages.push({
        url: `${baseUrl}/leads/${branch.slug}/${city.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      });
    });
    
    // Add province pages
    provinces.forEach(province => {
      localPages.push({
        url: `${baseUrl}/leads/${branch.slug}/${province.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.82,
      });
    });
  });

  // Blog articles - dynamically from blogArticles
  const blogPages = blogArticles.map((article) => ({
    url: `${baseUrl}/blog/${article.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...mainPages, ...localPages, ...blogPages];
}
