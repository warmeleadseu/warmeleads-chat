import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";

export const metadata: Metadata = {
  title: "Zonnepanelen Leads Kopen | Solar Installateur Prospects Nederland | WarmeLeads",
  description: "Koop verse zonnepanelen leads in Nederland. Exclusieve en gedeelde prospects voor solar installateurs. Echte geïnteresseerde klanten uit onze campagnes, realtime delivery binnen 15 minuten.",
  keywords: "zonnepanelen leads, solar leads, zonnepaneel prospects, solar installateur leads, exclusieve zonnepanelen leads, gedeelde solar leads, photovoltaic leads",
  openGraph: {
    title: "Zonnepanelen Leads Kopen Nederland | Solar Prospects | WarmeLeads",
    description: "Exclusieve en gedeelde zonnepanelen leads voor installateurs. Nederlandse prospects uit onze campagnes, realtime delivery binnen 15 minuten.",
    url: "https://www.warmeleads.eu/leads-zonnepanelen",
  },
};

export default function ZonnepanelenLeadsPage() {
  return (
    <BranchLeadsPageContent 
      metadata={{
        title: "Zonnepanelen Leads Kopen Nederland - Solar Installateur Prospects",
        heroTitle: "Zonnepanelen Leads",
        heroSubtitle: "Nederlandse prospects die solar energie willen",
        heroDescription: "Verse leads uit onze campagnes voor solar installateurs. Echte geïnteresseerde huiseigenaren die actief zoeken naar zonnepaneel installatie en duurzame energie oplossingen.",
        exclusivePrice: "€40,00 - €42,50",
        sharedPrice: "€12,50",
      }}
    />
  );
}
