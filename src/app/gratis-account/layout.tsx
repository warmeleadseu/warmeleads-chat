import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gratis Account Aanmaken | Leadportaal | WarmeLeads',
  description:
    'Maak gratis een WarmeLeads account aan en krijg direct toegang tot je eigen leadportaal. Start met demo leads, ervaar het platform en bestel je eerste batch met 20% welkomstkorting.',
  alternates: { canonical: '/gratis-account' },
  openGraph: {
    title: 'Gratis Account Aanmaken | WarmeLeads',
    description:
      'Start direct met je eigen leadportaal. Gratis account, demo leads en 20% welkomstkorting op je eerste bestelling.',
    url: 'https://www.warmeleads.eu/gratis-account',
  },
};

export default function GratisAccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
