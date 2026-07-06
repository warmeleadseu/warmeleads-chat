import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";
import { getBranchLeadContent } from "@/data/branchLeadContent";

const content = getBranchLeadContent("warmtepompen")!;

export const metadata: Metadata = {
  title: "Warmtepomp Leads Kopen | Heat Pump Installateur Prospects | WarmeLeads",
  description: "Koop verse warmtepomp leads in Nederland en België. Exclusieve prospects voor warmtepomp installateurs. Automatisch gekwalificeerd, realtime in jouw portaal.",
  keywords: "warmtepomp leads, heat pump leads, warmtepomp prospects, warmtepomp installateur leads, exclusieve warmtepomp leads, warmtepomp klanten",
  alternates: { canonical: "/leads-warmtepompen" },
  openGraph: {
    title: "Warmtepomp Leads Kopen Nederland | Exclusieve Prospects | WarmeLeads",
    description: "Exclusieve warmtepomp leads voor installateurs. Automatisch gekwalificeerd uit eigen campagnes, realtime in jouw portaal.",
    url: "https://www.warmeleads.eu/leads-warmtepompen",
  },
};

export default function WarmtepompenLeadsPage() {
  return (
    <BranchLeadsPageContent
      branchName={content.branchName}
      metadata={{
        title: "Warmtepomp Leads Kopen Nederland - Heat Pump Installateur Prospects",
        heroTitle: content.heroTitle,
        heroSubtitle: content.heroSubtitle,
        heroDescription: content.heroDescription,
        exclusivePrice: content.exclusivePrice,
        sharedPrice: content.sharedPrice,
      }}
    />
  );
}
