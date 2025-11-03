import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conversie Optimalisatie: Van Lead naar Klant | Proven Technieken | WarmeLeads Blog",
  description: "Leer hoe u leadconversie maximaliseert met proven technieken. Tips voor follow-up, kwalificatie en closing van leads voor maximale ROI.",
  keywords: "lead conversie optimalisatie, leadconversie verhogen, sales funnel optimalisatie, lead nurturing, conversie tips",
};

export default function ConversieOptimalisatiePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      <div className="relative py-20 overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-white">
          <div className="text-center mb-12">
            <div className="text-6xl mb-6">🎯</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Conversie Optimalisatie
            </h1>
            <p className="text-xl text-white/90 mb-4">Van lead naar klant: proven technieken</p>
            <div className="text-sm text-white/70">20 september 2025 • 9 min leestijd • Conversie</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <div className="prose prose-lg max-w-none text-white">
              <h2 className="text-2xl font-bold mb-4 text-white">De 5-Minuten Regel</h2>
              <p className="text-white/90 mb-6">
                Studies tonen aan dat leads die binnen 5 minuten worden benaderd een 9x hogere conversiekans hebben. 
                Snelheid is de nummer 1 factor voor succesvolle leadconversie.
              </p>

              <div className="bg-red-500/20 rounded-xl p-6 mb-6 border border-red-400/30">
                <h4 className="font-bold mb-3 text-red-300">⚠️ Conversie Killers</h4>
                <ul className="space-y-2 text-white/90">
                  <li>• Langzame opvolging (meer dan 1 uur = 60% minder conversie)</li>
                  <li>• Generieke emails in plaats van persoonlijk contact</li>
                  <li>• Geen kwalificatie van de lead</li>
                  <li>• Te agressieve verkoop in eerste contact</li>
                  <li>• Geen follow-up systeem</li>
                </ul>
              </div>

              <h3 className="text-xl font-bold mb-3 text-white">🏆 Proven Conversie Framework</h3>
              <div className="space-y-4 mb-6">
                <div className="bg-white/10 rounded-xl p-4">
                  <h4 className="font-bold mb-2 text-green-300">1. Snelle Response (0-5 min)</h4>
                  <p className="text-white/90 text-sm">Bel direct na lead ontvangst. SMS als backup. Wees de eerste die contact maakt.</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <h4 className="font-bold mb-2 text-blue-300">2. Kwalificatie (5-10 min)</h4>
                  <p className="text-white/90 text-sm">Stel de juiste vragen: budget, tijdlijn, beslissingsbevoegdheid, specifieke behoeften.</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <h4 className="font-bold mb-2 text-purple-300">3. Waarde Demonstratie</h4>
                  <p className="text-white/90 text-sm">Toon concrete voordelen specifiek voor hun situatie. Gebruik case studies en voorbeelden.</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <h4 className="font-bold mb-2 text-yellow-300">4. Soft Close</h4>
                  <p className="text-white/90 text-sm">Vraag naar volgende stap: offerte, bezichtiging, demo. Maak concrete afspraken.</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <h4 className="font-bold mb-2 text-pink-300">5. Gestructureerde Follow-up</h4>
                  <p className="text-white/90 text-sm">Automatische follow-up sequentie met waardevolle content en zachte herinneringen.</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl p-6 border border-green-400/30">
                <h4 className="font-bold mb-3 text-green-300">🎯 WarmeLeads Voordeel</h4>
                <p className="text-white/90">
                  Onze leads komen met interesse-niveau en beste contact tijden, waardoor uw eerste contact 
                  al geoptimaliseerd is voor maximale conversiekans. Dit geeft u een voorsprong op de concurrentie.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Optimaliseer Uw Conversie</h2>
            <p className="text-white/80 mb-6">Start met kwaliteitsleads die klaar zijn om te converteren</p>
            <Link href="/" className="inline-block bg-white text-brand-purple px-8 py-4 rounded-xl font-semibold hover:scale-105 transition-transform mr-4">
              🚀 Start met Leads
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
