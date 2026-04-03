import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";

export const metadata: Metadata = {
  title: "Warmtepomp Leads Kopen | Heat Pump Installateur Prospects | WarmeLeads",
  description: "Koop verse warmtepomp leads in Nederland en België. Exclusieve prospects voor warmtepomp installateurs. Automatisch gekwalificeerd, realtime in jouw portaal.",
  keywords: "warmtepomp leads, heat pump leads, warmtepomp prospects, warmtepomp installateur leads, exclusieve warmtepomp leads, warmtepomp klanten",
  openGraph: {
    title: "Warmtepomp Leads Kopen Nederland | Exclusieve Prospects | WarmeLeads",
    description: "Exclusieve warmtepomp leads voor installateurs. Automatisch gekwalificeerd uit eigen campagnes, realtime in jouw portaal.",
    url: "https://www.warmeleads.eu/leads-warmtepompen",
  },
};

export default function WarmtepompenLeadsPage() {
  return (
    <BranchLeadsPageContent 
      metadata={{
        title: "Warmtepomp Leads Kopen Nederland - Heat Pump Installateur Prospects",
        heroTitle: "Warmtepomp Leads",
        heroSubtitle: "Nederlandse prospects die duurzaam willen verwarmen",
        heroDescription: "Verse leads uit onze campagnes voor warmtepomp installateurs. Echte geïnteresseerde huiseigenaren die zoeken naar energie-efficiënte verwarmingsoplossingen.",
        exclusivePrice: "€40,00 - €45,00",
        sharedPrice: "€12,50",
      }}
    />
  );
}
