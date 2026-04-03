import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";

export const metadata: Metadata = {
  title: "Financial Lease Leads Kopen | Zakelijke Klant Prospects | WarmeLeads",
  description: "Koop verse financial lease leads in Nederland en België. Exclusieve prospects voor financial lease aanbieders. Automatisch gekwalificeerd, realtime in jouw portaal.",
  keywords: "financial lease leads, zakelijke lease prospects, lease aanbieder leads, exclusieve financial lease leads, zakelijke klant leads",
  openGraph: {
    title: "Financial Lease Leads Kopen Nederland | Exclusieve Prospects | WarmeLeads",
    description: "Exclusieve financial lease leads. Automatisch gekwalificeerd uit eigen campagnes, realtime in jouw portaal.",
    url: "https://www.warmeleads.eu/leads-financial-lease",
  },
};

export default function FinancialLeaseLeadsPage() {
  return (
    <BranchLeadsPageContent 
      metadata={{
        title: "Financial Lease Leads Kopen Nederland - Zakelijke Klant Prospects",
        heroTitle: "Financial Lease Leads",
        heroSubtitle: "Nederlandse zakelijke prospects voor lease",
        heroDescription: "Verse leads uit onze campagnes voor financial lease aanbieders. Echte zakelijke geïnteresseerden die actief zoeken naar lease mogelijkheden voor bedrijfsmiddelen.",
        exclusivePrice: "€35,00 - €40,00",
        sharedPrice: "€12,50",
      }}
    />
  );
}
