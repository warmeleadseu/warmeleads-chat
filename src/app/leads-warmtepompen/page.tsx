import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";

export const metadata: Metadata = {
  title: "Warmtepomp Leads Kopen | Heat Pump Installateur Prospects | WarmeLeads",
  description: "Koop verse warmtepomp leads in Nederland. Exclusieve en gedeelde prospects voor warmtepomp installateurs. Echte geïnteresseerde klanten uit onze campagnes, realtime delivery binnen 15 minuten.",
  keywords: "warmtepomp leads, heat pump leads, warmtepomp prospects, warmtepomp installateur leads, exclusieve warmtepomp leads, gedeelde warmtepomp leads",
  openGraph: {
    title: "Warmtepomp Leads Kopen Nederland | Heat Pump Prospects | WarmeLeads",
    description: "Exclusieve en gedeelde warmtepomp leads voor installateurs. Nederlandse prospects uit onze campagnes, realtime delivery binnen 15 minuten.",
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
