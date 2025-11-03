import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ROI Berekenen van Leadgeneratie: Complete Formule Gids | WarmeLeads Blog",
  description: "Leer hoe u de ROI van leadgeneratie correct berekent. Complete gids met formules, voorbeelden en tips voor optimalisatie van uw marketing investeringen.",
  keywords: "ROI leadgeneratie berekenen, lead generation ROI, marketing ROI formule, leadgeneratie rendement, ROI optimalisatie",
};

export default function ROIBerekeningPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      <div className="relative py-20 overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-white">
          <div className="text-center mb-12">
            <div className="text-6xl mb-6">📊</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              ROI Berekenen van Leadgeneratie
            </h1>
            <p className="text-xl text-white/90 mb-4">Complete gids met formules en voorbeelden</p>
            <div className="text-sm text-white/70">22 september 2025 • 8 min leestijd • Strategie</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <div className="prose prose-lg max-w-none text-white">
              <h2 className="text-2xl font-bold mb-4 text-white">De ROI Formule</h2>
              <div className="bg-white/10 rounded-xl p-6 mb-6 text-center">
                <div className="text-2xl font-bold text-green-300 mb-2">
                  ROI = (Omzet - Kosten) / Kosten × 100%
                </div>
                <div className="text-sm text-white/70">Basis formule voor leadgeneratie ROI</div>
              </div>

              <h3 className="text-xl font-bold mb-3 text-white">🧮 Praktijk Voorbeeld</h3>
              <div className="bg-white/10 rounded-xl p-6 mb-6">
                <h4 className="font-bold mb-3 text-blue-300">Zonnepanelen Installateur</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="font-semibold mb-2 text-green-300">Investering:</h5>
                    <ul className="space-y-1 text-white/90 text-sm">
                      <li>• 50 leads × €42,50 = €2.125</li>
                      <li>• Verkoopkosten = €500</li>
                      <li>• <strong>Totaal: €2.625</strong></li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold mb-2 text-blue-300">Resultaat:</h5>
                    <ul className="space-y-1 text-white/90 text-sm">
                      <li>• 9 verkopen (18% conversie)</li>
                      <li>• €12.000 gem. projectwaarde</li>
                      <li>• <strong>Omzet: €108.000</strong></li>
                    </ul>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-green-500/20 rounded-lg border border-green-400/30">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-300">ROI: 4.014%</div>
                    <div className="text-sm text-white/70">€40,14 return per €1 geïnvesteerd</div>
                  </div>
                </div>
              </div>

              <h3 className="text-xl font-bold mb-3 text-white">📈 ROI Optimalisatie Tips</h3>
              <div className="space-y-4 mb-6">
                <div className="bg-white/10 rounded-xl p-4">
                  <h4 className="font-bold mb-2 text-yellow-300">1. Verhoog Conversiekans</h4>
                  <p className="text-white/90 text-sm">Snelle opvolging, professionele presentatie, en goede kwalificatie verhogen conversie van 15% naar 25%.</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <h4 className="font-bold mb-2 text-blue-300">2. Optimaliseer Lead Kosten</h4>
                  <p className="text-white/90 text-sm">Kies de juiste mix van exclusieve en gedeelde leads voor uw situatie en budget.</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <h4 className="font-bold mb-2 text-purple-300">3. Verhoog Projectwaarde</h4>
                  <p className="text-white/90 text-sm">Up-sell en cross-sell mogelijkheden kunnen gemiddelde projectwaarde met 30% verhogen.</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-6 border border-purple-400/30">
                <h4 className="font-bold mb-3 text-purple-300">🎯 WarmeLeads ROI</h4>
                <p className="text-white/90">
                  Onze klanten behalen gemiddeld 300-500% ROI op hun leadgeneratie investering. Door onze 
                  kwaliteitsgarantie en verse leads uit campagnes minimaliseren we uw risico en maximaliseren uw return.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Bereken Uw ROI met Onze Leads</h2>
            <p className="text-white/80 mb-6">Start vandaag en zie uw ROI groeien</p>
            <Link href="/" className="inline-block bg-white text-brand-purple px-8 py-4 rounded-xl font-semibold hover:scale-105 transition-transform mr-4">
              🧮 ROI Calculator
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






