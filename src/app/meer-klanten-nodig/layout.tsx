import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Meer Klanten Nodig? | Directe Leads voor Installateurs | WarmeLeads',
  description:
    'Meer klanten nodig voor je installatiebedrijf? Krijg verse, exclusieve leads voor thuisbatterijen, zonnepanelen, warmtepompen en airco\'s. Plan een gratis strategiegesprek.',
  keywords:
    'meer klanten nodig, klanten werven, nieuwe klanten krijgen, klanten vinden, meer opdrachten, installateur leads, duurzame energie klanten',
  alternates: { canonical: '/meer-klanten-nodig' },
  openGraph: {
    title: 'Meer Klanten Nodig? | Verse Leads Binnen 24 Uur',
    description:
      'Direct nieuwe klanten voor je installatiebedrijf. Exclusieve leads voor thuisbatterijen, zonnepanelen, warmtepompen en airco\'s.',
    url: 'https://www.warmeleads.eu/meer-klanten-nodig',
    type: 'website',
  },
};

export default function MeerKlantenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
