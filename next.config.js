/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose Supabase env vars to client-side code
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  // Stability optimizations
  experimental: {
    // Reduce memory usage
    optimizePackageImports: ['framer-motion', '@heroicons/react'],
  },
  
  // Optimize compilation
  swcMinify: true,
  
  // Better error handling
  onDemandEntries: {
    // Reduce memory usage by limiting cached pages
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  
  // Webpack optimizations for stability
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Reduce memory usage in development
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
      
      // Prevent memory leaks
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules', '**/.git', '**/.next'],
      };
    }
    
    return config;
  },
  
  // Redirects for SEO - old URLs to new structure
  async redirects() {
    const redirects = [];
    
    // Old city-specific URLs to new structure
    const oldCityUrls = [
      { from: 'leads-thuisbatterijen-amsterdam', to: 'leads/thuisbatterijen/amsterdam' },
      { from: 'leads-zonnepanelen-rotterdam', to: 'leads/zonnepanelen/rotterdam' },
      { from: 'leads-warmtepompen-utrecht', to: 'leads/warmtepompen/utrecht' },
    ];
    
    oldCityUrls.forEach(({ from, to }) => {
      redirects.push({
        source: `/${from}`,
        destination: `/${to}`,
        permanent: true,
      });
    });
    
    return redirects;
  },
  
  // Security headers to prevent SSL warnings on mobile
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
