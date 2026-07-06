import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";
import { getBranchLeadContent } from "@/data/branchLeadContent";

const content = getBranchLeadContent("zonnepanelen")!;

export const metadata: Metadata = {
  title: "Zonnepanelen Leads Kopen | Solar Installateur Prospects Nederland | WarmeLeads",
  description: "Koop verse zonnepanelen leads in Nederland en België. Exclusieve prospects voor solar installateurs. Automatisch gekwalificeerd, realtime in jouw portaal.",
  keywords: "zonnepanelen leads, solar leads, zonnepaneel prospects, solar installateur leads, exclusieve zonnepanelen leads, zonnepanelen klanten",
  alternates: { canonical: "/leads-zonnepanelen" },
  openGraph: {
    title: "Zonnepanelen Leads Kopen Nederland | Exclusieve Prospects | WarmeLeads",
    description: "Exclusieve zonnepanelen leads voor solar installateurs. Automatisch gekwalificeerd uit eigen campagnes, realtime in jouw portaal.",
    url: "https://www.warmeleads.eu/leads-zonnepanelen",
  },
};

export default function ZonnepanelenLeadsPage() {
  return (
    <BranchLeadsPageContent
      branchName={content.branchName}
      metadata={{
        title: "Zonnepanelen Leads Kopen Nederland - Solar Installateur Prospects",
        heroTitle: content.heroTitle,
        heroSubtitle: content.heroSubtitle,
        heroDescription: content.heroDescription,
        exclusivePrice: content.exclusivePrice,
        sharedPrice: content.sharedPrice,
      }}
    />
  );
}
