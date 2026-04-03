import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";

export const metadata: Metadata = {
  title: "Airco Leads Kopen | Exclusieve Prospects Nederland | WarmeLeads",
  description: "Koop verse airco leads in Nederland en België. Exclusieve prospects voor airco installateurs. Automatisch gekwalificeerd, realtime in jouw portaal.",
  keywords: "airco leads, airconditioning leads, airco prospects, airco installateur leads, exclusieve airco leads, klimaatbeheersing leads",
  openGraph: {
    title: "Airco Leads Kopen Nederland | Verse Prospects | WarmeLeads",
    description: "Exclusieve en gedeelde airco leads voor installateurs. Nederlandse prospects uit onze campagnes, realtime delivery.",
    url: "https://www.warmeleads.eu/leads-airco",
  },
};

export default function AircoLeadsPage() {
  return (
    <BranchLeadsPageContent
      metadata={{
        title: "Airco Leads Kopen Nederland - Exclusieve en Gedeelde Prospects",
        heroTitle: "Airco Leads",
        heroSubtitle: "Nederlandse prospects die op zoek zijn naar airconditioning",
        heroDescription: "Verse leads uit onze campagnes voor airco installateurs. Echte geïnteresseerde huiseigenaren en bedrijven die actief zoeken naar airconditioning en klimaatbeheersing.",
        exclusivePrice: "€30,00 - €37,50",
        sharedPrice: "€10,00",
      }}
    />
  );
}
