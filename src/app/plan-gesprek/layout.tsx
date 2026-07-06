import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Plan een Gratis Strategiegesprek | WarmeLeads',
  description: 'Plan direct een gratis strategiegesprek met WarmeLeads. Kies een datum en tijd die jou uitkomt. We bespreken vrijblijvend hoe we jouw leadgeneratie kunnen optimaliseren.',
  alternates: { canonical: '/plan-gesprek' },
  openGraph: {
    title: 'Plan een Gratis Strategiegesprek | WarmeLeads',
    description: 'Plan direct een gratis strategiegesprek met WarmeLeads. Kies een moment dat jou uitkomt.',
    url: 'https://www.warmeleads.eu/plan-gesprek',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
