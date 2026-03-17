import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/_next/',
        '/private/',
        '/admin/',
        '/portal/',
        '*.json',
      ],
    },
    sitemap: 'https://www.warmeleads.eu/sitemap.xml',
    host: 'https://www.warmeleads.eu',
  }
}
