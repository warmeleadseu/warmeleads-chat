import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";

export const metadata: Metadata = {
  title: "Thuisbatterij Leads Kopen | Exclusieve Prospects Nederland | WarmeLeads",
  description: "Koop verse thuisbatterij leads in Nederland en België. Exclusieve prospects voor thuisbatterij installateurs. Automatisch gekwalificeerd, realtime in jouw portaal.",
  keywords: "thuisbatterij leads, thuisbatterij prospects, battery storage leads, energie opslag leads, thuisbatterij installateur leads, exclusieve thuisbatterij leads",
  openGraph: {
    title: "Thuisbatterij Leads Kopen Nederland | Exclusieve Prospects | WarmeLeads",
    description: "Exclusieve thuisbatterij leads voor installateurs. Automatisch gekwalificeerd uit eigen campagnes, realtime in jouw portaal.",
    url: "https://www.warmeleads.eu/leads-thuisbatterijen",
  },
};

export default function ThuisbatterijLeadsPage() {
  return (
    <BranchLeadsPageContent 
      metadata={{
        title: "Thuisbatterij Leads Kopen Nederland - Exclusieve en Gedeelde Prospects",
        heroTitle: "Thuisbatterij Leads",
        heroSubtitle: "Nederlandse prospects die energie-onafhankelijkheid zoeken",
        heroDescription: "Verse leads uit onze campagnes voor thuisbatterij installateurs. Echte geïnteresseerde huiseigenaren met zonnepanelen die hun energieopslag willen uitbreiden.",
        exclusivePrice: "€37,50 - €42,50",
        sharedPrice: "€12,50",
      }}
    />
  );
}
