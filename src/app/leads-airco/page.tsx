import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";
import { getBranchLeadContent } from "@/data/branchLeadContent";

const content = getBranchLeadContent("airco")!;

export const metadata: Metadata = {
  title: "Airco Leads Kopen | Exclusieve Prospects Nederland | WarmeLeads",
  description: "Koop verse airco leads in Nederland en België. Exclusieve prospects voor airco installateurs. Automatisch gekwalificeerd, realtime in jouw portaal.",
  keywords: "airco leads, airconditioning leads, airco prospects, airco installateur leads, exclusieve airco leads, klimaatbeheersing leads",
  alternates: { canonical: "/leads-airco" },
  openGraph: {
    title: "Airco Leads Kopen Nederland | Verse Prospects | WarmeLeads",
    description: "Exclusieve en gedeelde airco leads voor installateurs. Nederlandse prospects uit onze campagnes, realtime delivery.",
    url: "https://www.warmeleads.eu/leads-airco",
  },
};

export default function AircoLeadsPage() {
  return (
    <BranchLeadsPageContent
      branchName={content.branchName}
      metadata={{
        title: "Airco Leads Kopen Nederland - Exclusieve en Gedeelde Prospects",
        heroTitle: content.heroTitle,
        heroSubtitle: content.heroSubtitle,
        heroDescription: content.heroDescription,
        exclusivePrice: content.exclusivePrice,
        sharedPrice: content.sharedPrice,
      }}
    />
  );
}
