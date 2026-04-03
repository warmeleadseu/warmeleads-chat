import Image from 'next/image';
import Link from 'next/link';
import { EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';

const footerColumns = [
  {
    title: 'Oplossingen',
    links: [
      { label: 'Maatwerk leads', href: '/maatwerk-leads' },
      { label: 'Zonnepanelen leads', href: '/leads-zonnepanelen' },
      { label: 'Warmtepompen leads', href: '/leads-warmtepompen' },
      { label: 'Thuisbatterij leads', href: '/leads-thuisbatterijen' },
      { label: 'Airco leads', href: '/leads-airco' },
      { label: 'Financial Lease leads', href: '/leads-financial-lease' },
    ],
  },
  {
    title: 'Bedrijf',
    links: [
      { label: 'Hoe het werkt', href: '/hoe-het-werkt' },
      { label: 'Meer klanten nodig', href: '/meer-klanten-nodig' },
      { label: 'Blog & inzichten', href: '/blog' },
      { label: 'Leadgeneratie gids', href: '/leadgeneratie-gids' },
      { label: 'Klantportaal', href: '/portal' },
    ],
  },
  {
    title: 'Juridisch',
    links: [
      { label: 'Privacyverklaring', href: '/privacyverklaring' },
      { label: 'Algemene voorwaarden', href: '/algemene-voorwaarden' },
    ],
  },
];

export function Footer() {
  return (
    <>
      <div className="h-[3px] bg-warmeleads-gradient" />
      <footer className="bg-slate-950 text-slate-400">
        <div className="mx-auto max-w-7xl px-5 py-10 md:py-14 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-10">
            <div className="col-span-2 md:col-span-1">
              <Image src="/logo-wit.png" alt="WarmeLeads" width={180} height={54} className="h-8 w-auto md:h-10" />
              <p className="mt-3 max-w-xs text-[13px] leading-relaxed md:mt-4 md:text-sm">
                Moderne leadinfrastructuur voor teams die willen sturen op kwaliteit,
                snelheid en voorspelbare omzetgroei.
              </p>
              <div className="mt-5 space-y-2 md:mt-6">
                <a href="mailto:info@warmeleads.eu" className="flex items-center gap-2 text-[12px] text-slate-400 transition hover:text-white md:text-[13px]">
                  <EnvelopeIcon className="h-3.5 w-3.5 text-brand-orange" />
                  info@warmeleads.eu
                </a>
                <a href="tel:+31850477067" className="flex items-center gap-2 text-[12px] text-slate-400 transition hover:text-white md:text-[13px]">
                  <PhoneIcon className="h-3.5 w-3.5 text-brand-orange" />
                  +31 (0)85 047 7067
                </a>
              </div>
            </div>

            {footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className="text-[12px] font-semibold text-white md:text-[13px]">{column.title}</h3>
                <ul className="mt-3 space-y-2 md:mt-4 md:space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link href={link.href} className="text-[13px] text-slate-400 transition hover:text-white md:text-sm">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-800/60">
          <div className="mx-auto flex max-w-7xl flex-col gap-1.5 px-5 py-4 text-[11px] text-slate-600 md:flex-row md:items-center md:justify-between md:py-5 md:text-xs lg:px-8">
            <p>&copy; {new Date().getFullYear()} WarmeLeads.eu · Alle rechten voorbehouden.</p>
            <p>KvK: 88929280 &bull; Stavangerweg 21-1, 9723 JC Groningen</p>
          </div>
        </div>
      </footer>
    </>
  );
}
