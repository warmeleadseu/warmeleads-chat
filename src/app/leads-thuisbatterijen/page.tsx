import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";
import { getBranchLeadContent } from "@/data/branchLeadContent";

const content = getBranchLeadContent("thuisbatterijen")!;

export const metadata: Metadata = {
  title: "Thuisbatterij Leads Kopen | Exclusieve Prospects Nederland | WarmeLeads",
  description: "Koop verse thuisbatterij leads in Nederland en België. Exclusieve prospects voor thuisbatterij installateurs. Automatisch gekwalificeerd, realtime in jouw portaal.",
  keywords: "thuisbatterij leads, thuisbatterij prospects, battery storage leads, energie opslag leads, thuisbatterij installateur leads, exclusieve thuisbatterij leads",
  alternates: { canonical: "/leads-thuisbatterijen" },
  openGraph: {
    title: "Thuisbatterij Leads Kopen Nederland | Exclusieve Prospects | WarmeLeads",
    description: "Exclusieve thuisbatterij leads voor installateurs. Automatisch gekwalificeerd uit eigen campagnes, realtime in jouw portaal.",
    url: "https://www.warmeleads.eu/leads-thuisbatterijen",
  },
};

export default function ThuisbatterijLeadsPage() {
  return (
    <BranchLeadsPageContent
      branchName={content.branchName}
      metadata={{
        title: "Thuisbatterij Leads Kopen Nederland - Exclusieve en Gedeelde Prospects",
        heroTitle: content.heroTitle,
        heroSubtitle: content.heroSubtitle,
        heroDescription: content.heroDescription,
        exclusivePrice: content.exclusivePrice,
        sharedPrice: content.sharedPrice,
      }}
    />
  );
}
