import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Financial Lease Trends 2025: Nieuwe Kansen voor Adviseurs | WarmeLeads Blog",
  description: "Ontdek de financial lease trends voor 2025. Nieuwe kansen voor lease adviseurs, marktveranderingen en effectieve B2B leadgeneratie strategieën.",
  keywords: "financial lease trends 2025, lease adviseur leads, B2B financial lease, lease markt Nederland, financial lease leadgeneratie",
};

export default function FinancialLeaseTrendsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      <div className="relative py-20 overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-white">
          <div className="text-center mb-12">
            <div className="text-6xl mb-6">💼</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-green-300 to-blue-300 bg-clip-text text-transparent">
              Financial Lease Trends 2025
            </h1>
            <p className="text-xl text-white/90 mb-4">Nieuwe kansen en uitdagingen voor lease adviseurs</p>
            <div className="text-sm text-white/70">21 september 2025 • 6 min leestijd • B2B</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <div className="prose prose-lg max-w-none text-white">
              <h2 className="text-2xl font-bold mb-4 text-white">MKB Financieringsbehoefte Groeit</h2>
              <p className="text-white/90 mb-6">
                De financial lease markt in Nederland evolueert snel. MKB bedrijven zoeken steeds vaker naar 
                flexibele financieringsoplossingen voor investeringen in technologie, voertuigen en apparatuur.
              </p>

              <h3 className="text-xl font-bold mb-3 text-white">📊 Markttrends 2025</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white/10 rounded-xl p-6">
                  <h4 className="font-bold mb-3 text-green-300">🔥 Groeiende Sectoren</h4>
                  <ul className="space-y-2 text-white/90 text-sm">
                    <li>• IT & Technologie (35% groei)</li>
                    <li>• Elektrische voertuigen (50% groei)</li>
                    <li>• Productie apparatuur (25% groei)</li>
                    <li>• Kantoor inrichting (20% groei)</li>
                  </ul>
                </div>
                <div className="bg-white/10 rounded-xl p-6">
                  <h4 className="font-bold mb-3 text-blue-300">💰 Gemiddelde Lease Bedragen</h4>
                  <ul className="space-y-2 text-white/90 text-sm">
                    <li>• IT Equipment: €25.000 - €100.000</li>
                    <li>• Voertuigen: €30.000 - €80.000</li>
                    <li>• Machines: €50.000 - €250.000</li>
                    <li>• Kantoor: €15.000 - €50.000</li>
                  </ul>
                </div>
              </div>

              <h3 className="text-xl font-bold mb-3 text-white">🎯 B2B Leadgeneratie Strategieën</h3>
              <p className="text-white/90 mb-4">
                Financial lease leadgeneratie vereist een andere aanpak dan B2C. Bedrijven hebben langere 
                beslissingscycli maar hogere waarden. Focus op de juiste targeting en messaging is cruciaal.
              </p>

              <div className="bg-white/10 rounded-xl p-6 mb-6">
                <h4 className="font-bold mb-3 text-purple-300">🎯 Targeting Criteria</h4>
                <ul className="space-y-2 text-white/90">
                  <li>• <strong>Bedrijfsomvang:</strong> 10-500 werknemers (MKB)</li>
                  <li>• <strong>Groei fase:</strong> Bedrijven in uitbreiding</li>
                  <li>• <strong>Sector focus:</strong> Tech, transport, productie</li>
                  <li>• <strong>Beslissingsbevoegdheid:</strong> CFO, CEO, operations manager</li>
                </ul>
              </div>

              <div className="bg-gradient-to-r from-blue-500/20 to-green-500/20 rounded-xl p-6 border border-blue-400/30">
                <h4 className="font-bold mb-3 text-blue-300">💡 Expert Tip</h4>
                <p className="text-white/90">
                  Financial lease leads hebben de hoogste waarde maar vereisen professionele follow-up. 
                  Investeer in een goede CRM en train uw sales team in B2B verkoop voor maximale conversie.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Start met B2B Lease Leads</h2>
            <p className="text-white/80 mb-6">Nederlandse bedrijven zoeken financieringsoplossingen</p>
            <Link href="/leads-financial-lease" className="inline-block bg-white text-brand-purple px-8 py-4 rounded-xl font-semibold hover:scale-105 transition-transform mr-4">
              💼 Financial Lease Leads
            </Link>
            <Link href="/blog" className="inline-block bg-white/20 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/30 transition-colors">
              ← Alle Artikelen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}






