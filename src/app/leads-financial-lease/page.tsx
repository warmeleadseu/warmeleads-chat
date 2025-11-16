import type { Metadata } from "next";
import { BranchLeadsPageContent } from "@/components/BranchLeadsPage";

export const metadata: Metadata = {
  title: "Financial Lease Leads Kopen | Zakelijke Klant Prospects | WarmeLeads",
  description: "Koop verse financial lease leads in Nederland. Exclusieve en gedeelde prospects voor financial lease aanbieders. Echte zakelijke geïnteresseerden uit onze campagnes, realtime delivery binnen 15 minuten.",
  keywords: "financial lease leads, zakelijke lease prospects, lease aanbieder leads, exclusieve financial lease leads, gedeelde lease leads, zakelijke klant leads",
  openGraph: {
    title: "Financial Lease Leads Kopen Nederland | Zakelijke Prospects | WarmeLeads",
    description: "Exclusieve en gedeelde financial lease leads. Nederlandse zakelijke prospects uit onze campagnes, realtime delivery binnen 15 minuten.",
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
