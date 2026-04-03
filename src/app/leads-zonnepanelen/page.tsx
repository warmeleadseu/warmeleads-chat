import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";

export const metadata: Metadata = {
  title: "Zonnepanelen Leads Kopen | Solar Installateur Prospects Nederland | WarmeLeads",
  description: "Koop verse zonnepanelen leads in Nederland en België. Exclusieve prospects voor solar installateurs. Automatisch gekwalificeerd, realtime in jouw portaal.",
  keywords: "zonnepanelen leads, solar leads, zonnepaneel prospects, solar installateur leads, exclusieve zonnepanelen leads, zonnepanelen klanten",
  openGraph: {
    title: "Zonnepanelen Leads Kopen Nederland | Exclusieve Prospects | WarmeLeads",
    description: "Exclusieve zonnepanelen leads voor solar installateurs. Automatisch gekwalificeerd uit eigen campagnes, realtime in jouw portaal.",
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
