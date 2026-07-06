import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hoe Het Werkt | Van Intake tot Leads in Je Portaal | WarmeLeads',
  description:
    'Ontdek hoe WarmeLeads werkt: van strategiegesprek en campagne op maat, tot automatische quality checks en realtime leads in jouw portaal.',
  keywords:
    'hoe werkt warmeleads, leadgeneratie proces, exclusieve leads, lead kwalificatie, klantportaal, lead quality checks',
  alternates: { canonical: '/hoe-het-werkt' },
  openGraph: {
    title: 'Hoe Het Werkt | WarmeLeads Leadgeneratie Proces',
    description:
      'Van intake naar een voorspelbare leadstroom. Ontdek ons 4-stappen proces voor exclusieve, gekwalificeerde leads.',
    url: 'https://www.warmeleads.eu/hoe-het-werkt',
    type: 'website',
  },
};

export default function HoeHetWerktLayout({ children }: { children: React.ReactNode }) {
  return children;
}
