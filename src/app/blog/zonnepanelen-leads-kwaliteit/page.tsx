import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hoe Herken je Kwaliteit Zonnepanelen Leads? | Expert Tips | WarmeLeads Blog",
  description: "Leer hoe je kwaliteit zonnepanelen leads herkent. Expert tips voor solar installateurs over lead verificatie, kwaliteitsindicatoren en ROI optimalisatie.",
  keywords: "zonnepanelen leads kwaliteit, solar leads verificatie, kwaliteitsleads herkennen, zonnepaneel prospects, lead kwaliteit beoordelen",
};

export default function ZonnepanelenLeadsKwaliteitPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      <div className="relative py-20 overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-white">
          <div className="text-center mb-12">
            <div className="text-6xl mb-6">☀️</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
              Hoe Herken je Kwaliteit Zonnepanelen Leads?
            </h1>
            <p className="text-xl text-white/90 mb-4">
              Expert tips voor solar installateurs
            </p>
            <div className="text-sm text-white/70">
              24 september 2025 • 7 min leestijd • Tips & Tricks
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <div className="prose prose-lg max-w-none text-white">
              <h2 className="text-2xl font-bold mb-4 text-white">Kwaliteitsindicatoren voor Solar Leads</h2>
              <p className="text-white/90 mb-6">
                Niet alle zonnepanelen leads zijn gelijk. Als solar installateur is het cruciaal om kwaliteitsleads 
                te herkennen voordat u tijd en geld investeert in follow-up. Hier zijn de belangrijkste indicatoren.
              </p>

              <h3 className="text-xl font-bold mb-3 text-white">🎯 Primaire Kwaliteitsfactoren</h3>
              <div className="bg-white/10 rounded-xl p-6 mb-6">
                <ul className="space-y-3 text-white/90">
                  <li><strong className="text-green-300">Huiseigenaarschap:</strong> Alleen eigenaren kunnen beslissen over installatie</li>
                  <li><strong className="text-green-300">Dakgeschiktheid:</strong> Zuid/zuidwest oriëntatie, geen schaduw</li>
                  <li><strong className="text-green-300">Budget indicatie:</strong> Realistische investeringsbereidheid</li>
                  <li><strong className="text-green-300">Tijdlijn:</strong> Concrete plannen binnen 6 maanden</li>
                  <li><strong className="text-green-300">Contact bereidheid:</strong> Telefonisch bereikbaar</li>
                </ul>
              </div>

              <h3 className="text-xl font-bold mb-3 text-white">🔍 Verificatie Checklist</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-green-500/20 rounded-xl p-4 border border-green-400/30">
                  <h4 className="font-bold mb-3 text-green-300">✅ Goede Leads</h4>
                  <ul className="space-y-2 text-sm text-white/90">
                    <li>• Volledige contactgegevens</li>
                    <li>• Specifieke interesse in solar</li>
                    <li>• Budget tussen €8.000-€25.000</li>
                    <li>• Eigen woning, geen huur</li>
                    <li>• Actieve zoekfase (binnen 3 maanden)</li>
                  </ul>
                </div>
                <div className="bg-red-500/20 rounded-xl p-4 border border-red-400/30">
                  <h4 className="font-bold mb-3 text-red-300">❌ Slechte Leads</h4>
                  <ul className="space-y-2 text-sm text-white/90">
                    <li>• Incomplete gegevens</li>
                    <li>• Alleen "informatie" interesse</li>
                    <li>• Geen budget genoemd</li>
                    <li>• Huurwoning of onzeker</li>
                    <li>• Vage tijdlijn of "ooit"</li>
                  </ul>
                </div>
              </div>

              <h3 className="text-xl font-bold mb-3 text-white">📊 WarmeLeads Kwaliteitsgarantie</h3>
              <p className="text-white/90 mb-4">
                Bij WarmeLeads screenen wij alle leads op deze kwaliteitsfactoren voordat ze naar u worden gestuurd. 
                Onze leads hebben een gemiddelde conversiekans van 18-25% omdat we alleen prospects doorsturen die 
                voldoen aan strenge kwaliteitscriteria.
              </p>

              <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-6 border border-blue-400/30">
                <h4 className="font-bold mb-3 text-blue-300">💡 Expert Tip</h4>
                <p className="text-white/90">
                  Bel zonnepanelen leads binnen 5 minuten na ontvangst. Studies tonen aan dat de conversiekans 
                  met 80% daalt na de eerste 10 minuten. Snelheid is cruciaal in de solar markt.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Klaar voor Kwaliteit Solar Leads?</h2>
            <p className="text-white/80 mb-6">Ontvang alleen gescreende, hoogwaardige zonnepanelen prospects</p>
            <Link href="/leads-zonnepanelen" className="inline-block bg-white text-brand-purple px-8 py-4 rounded-xl font-semibold hover:scale-105 transition-transform mr-4">
              ☀️ Zonnepanelen Leads
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






