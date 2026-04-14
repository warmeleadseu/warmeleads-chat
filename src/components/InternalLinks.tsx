/**
 * Internal Links Component
 * Automatically adds contextual internal links for SEO
 */

import Link from 'next/link';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface InternalLink {
  text: string;
  url: string;
  description: string;
}

export const internalLinks: Record<string, InternalLink[]> = {
  leadgeneratie: [
    {
      text: 'Thuisbatterij Leads',
      url: '/leads-thuisbatterijen',
      description: 'Exclusieve en gedeelde leads voor thuisbatterijen',
    },
    {
      text: 'Zonnepanelen Leads',
      url: '/leads-zonnepanelen',
      description: 'Verse zonnepanelen leads uit eigen campagnes',
    },
    {
      text: 'Warmtepomp Leads',
      url: '/leads-warmtepompen',
      description: 'Hoogwaardige warmtepomp leads voor installateurs',
    },
    {
      text: 'Financial Lease Leads',
      url: '/leads-financial-lease',
      description: 'B2B leads voor financial lease',
    },
  ],
  blog: [
    {
      text: 'Leadgeneratie Blog',
      url: '/blog',
      description: '40+ expert artikelen over leadgeneratie en marketing',
    },
    {
      text: 'ROI Berekenen',
      url: '/blog/roi-berekenen-leadgeneratie',
      description: 'Leer hoe u ROI correct berekent',
    },
    {
      text: 'Conversie Optimalisatie',
      url: '/blog/conversie-optimalisatie-leads',
      description: 'Van lead naar klant met proven technieken',
    },
  ],
  seo: [
    {
      text: 'SEO voor Leadgeneratie',
      url: '/blog/seo-voor-leadgeneratie-2025',
      description: 'Organische traffic = gratis leads',
    },
    {
      text: 'Content Marketing',
      url: '/blog/content-marketing-lead-generatie',
      description: 'Content die converteert',
    },
  ],
  automation: [
    {
      text: 'Marketing Automation',
      url: '/blog/marketing-automation-leadgeneratie',
      description: 'Automatiseer uw leadgeneratie',
    },
    {
      text: 'AI Chatbots',
      url: '/blog/ai-chatbots-leadgeneratie-2025',
      description: 'AI voor leadgeneratie',
    },
  ],
};

interface InternalLinksGridProps {
  category?: keyof typeof internalLinks;
  title?: string;
  maxLinks?: number;
}

export function InternalLinksGrid({ 
  category = 'leadgeneratie', 
  title = 'Ontdek ook',
  maxLinks = 4 
}: InternalLinksGridProps) {
  const links = internalLinks[category]?.slice(0, maxLinks) || [];

  if (links.length === 0) return null;

  return (
    <div className="my-12 bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
      <h3 className="text-2xl font-bold text-white mb-6">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {links.map((link) => (
          <Link
            key={link.url}
            href={link.url}
            className="group bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all duration-300 hover:scale-105"
          >
            <div className="flex items-start space-x-3">
              <ArrowTopRightOnSquareIcon className="h-6 w-6 shrink-0 text-white/70 group-hover:scale-110 group-hover:text-brand-orange transition-all" />
              <div className="flex-1">
                <h4 className="text-white font-semibold mb-1 group-hover:text-brand-orange transition-colors">
                  {link.text} →
                </h4>
                <p className="text-white/70 text-sm">
                  {link.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Footer Internal Links for every page
 */
export function FooterInternalLinks() {
  return (
    <div className="bg-gradient-to-r from-brand-purple/20 to-brand-pink/20 backdrop-blur-sm border-t border-white/10 py-12 mt-20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h4 className="text-white font-bold mb-4">Leads per Branche</h4>
            <ul className="space-y-2">
              {internalLinks.leadgeneratie.map((link) => (
                <li key={link.url}>
                  <Link
                    href={link.url}
                    className="text-white/70 hover:text-white text-sm transition-colors"
                  >
                    {link.text}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Blog & Resources</h4>
            <ul className="space-y-2">
              {internalLinks.blog.map((link) => (
                <li key={link.url}>
                  <Link
                    href={link.url}
                    className="text-white/70 hover:text-white text-sm transition-colors"
                  >
                    {link.text}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">SEO & Marketing</h4>
            <ul className="space-y-2">
              {internalLinks.seo.map((link) => (
                <li key={link.url}>
                  <Link
                    href={link.url}
                    className="text-white/70 hover:text-white text-sm transition-colors"
                  >
                    {link.text}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Automation</h4>
            <ul className="space-y-2">
              {internalLinks.automation.map((link) => (
                <li key={link.url}>
                  <Link
                    href={link.url}
                    className="text-white/70 hover:text-white text-sm transition-colors"
                  >
                    {link.text}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/leadgeneratie-gids"
                  className="text-white/70 hover:text-white text-sm transition-colors"
                >
                  Leadgeneratie Gids
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}


