import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";
import { getBranchLeadContent } from "@/data/branchLeadContent";

const content = getBranchLeadContent("financial-lease")!;

export const metadata: Metadata = {
  title: "Financial Lease Leads Kopen | Zakelijke Klant Prospects | WarmeLeads",
  description: "Koop verse financial lease leads in Nederland en België. Exclusieve prospects voor financial lease aanbieders. Automatisch gekwalificeerd, realtime in jouw portaal.",
  keywords: "financial lease leads, zakelijke lease prospects, lease aanbieder leads, exclusieve financial lease leads, zakelijke klant leads",
  alternates: { canonical: "/leads-financial-lease" },
  openGraph: {
    title: "Financial Lease Leads Kopen Nederland | Exclusieve Prospects | WarmeLeads",
    description: "Exclusieve financial lease leads. Automatisch gekwalificeerd uit eigen campagnes, realtime in jouw portaal.",
    url: "https://www.warmeleads.eu/leads-financial-lease",
  },
};

export default function FinancialLeaseLeadsPage() {
  return (
    <BranchLeadsPageContent
      branchName={content.branchName}
      metadata={{
        title: "Financial Lease Leads Kopen Nederland - Zakelijke Klant Prospects",
        heroTitle: content.heroTitle,
        heroSubtitle: content.heroSubtitle,
        heroDescription: content.heroDescription,
        exclusivePrice: content.exclusivePrice,
        sharedPrice: content.sharedPrice,
      }}
    />
  );
}
