import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Algemene voorwaarden | Warmeleads.eu',
  description: 'Algemene voorwaarden voor leadgeneratie diensten van Warmeleads.eu voor zonnepanelen, warmtepompen, thuisbatterijen en financial lease.',
  alternates: { canonical: '/algemene-voorwaarden' },
};

export default function AlgemeneVoorwaardenPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white text-slate-900">

      {/* Hero Banner */}
      <section className="bg-brand-navy py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">Algemene voorwaarden</h1>
          <p className="mt-3 text-base text-white/70">Laatst gewijzigd op 13 oktober 2025</p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

        {/* Artikel 1 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 1: Definities</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">1.1 Warmeleads.eu:</span> De handelsnaam waaronder de dienstverlener opereert.</p>
            <p><span className="font-semibold text-slate-900">1.2 Klant:</span> Iedere natuurlijke of rechtspersoon die een overeenkomst aangaat met Warmeleads.eu.</p>
            <p><span className="font-semibold text-slate-900">1.3 Leads:</span> Gegevens van potentiële klanten die interesse hebben getoond in de aankoop van zonnepanelen, warmtepompen, thuisbatterijen, financial lease of andere energieoplossingen en die door Warmeleads.eu aan de Klant worden geleverd.</p>
            <p><span className="font-semibold text-slate-900">1.4 Exclusieve Leads:</span> Leads die uitsluitend worden geleverd aan één Klant en niet gedeeld worden met andere bedrijven.</p>
            <p><span className="font-semibold text-slate-900">1.5 Niet-exclusieve Leads:</span> Leads die aan meerdere klanten geleverd kunnen worden.</p>
            <p><span className="font-semibold text-slate-900">1.6 Overeenkomst:</span> Iedere overeenkomst tussen Warmeleads.eu en de Klant betreffende de levering van leads, die tot stand komt door acceptatie van een voorstel en/of betaling van de factuur door de Klant, of door aankoop via het online portaal.</p>
            <p><span className="font-semibold text-slate-900">1.7 Kwalitatieve Lead:</span> Een lead die voldoet aan de door Warmeleads.eu vastgestelde criteria, zoals juistheid van contactinformatie en aantoonbare interesse in zonnepanelen, warmtepompen, thuisbatterijen, financial lease of andere energieoplossingen.</p>
          </div>
        </section>

        {/* Artikel 2 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 2: Toepasselijkheid</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">2.1</span> Deze algemene voorwaarden zijn van toepassing op alle aanbiedingen, offertes en overeenkomsten tussen Warmeleads.eu en de Klant, tenzij uitdrukkelijk schriftelijk anders is overeengekomen.</p>
            <p><span className="font-semibold text-slate-900">2.2</span> Door het aangaan van een overeenkomst met Warmeleads.eu verklaart de Klant deze algemene voorwaarden te aanvaarden.</p>
          </div>
        </section>

        {/* Artikel 3 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 3: Totstandkoming van de Overeenkomst</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">3.1</span> De overeenkomst tussen Warmeleads.eu en de Klant komt tot stand op het moment dat de Klant de door Warmeleads.eu verstuurde factuur betaalt of een betaling doet via het online portaal van Warmeleads.eu.</p>
            <p><span className="font-semibold text-slate-900">3.2</span> Voor niet-exclusieve leads geldt dat deze aan meerdere klanten geleverd kunnen worden. De Klant verklaart zich hiermee akkoord door het aangaan van de overeenkomst.</p>
          </div>
        </section>

        {/* Artikel 4 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 4: Diensten</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">4.1</span> Warmeleads.eu verbindt zich ertoe om de Klant te voorzien van leads die overeenkomen met het type (exclusief of niet-exclusief) zoals overeengekomen in de overeenkomst.</p>
            <p><span className="font-semibold text-slate-900">4.2</span> De Klant kan vooraf bepalen hoeveel leads hij wenst af te nemen en voor hoeveel weken. De overeengekomen hoeveelheid leads en de duur van de levering worden vastgelegd bij de aankoop, waarna direct betaling plaatsvindt.</p>
            <p><span className="font-semibold text-slate-900">4.3</span> Warmeleads.eu biedt geen garantie op conversie van de geleverde leads, aangezien de uiteindelijke verkoop en klantrelatie afhankelijk zijn van de inspanningen van de Klant.</p>
            <p><span className="font-semibold text-slate-900">4.4</span> Leads worden geleverd binnen de termijn zoals afgesproken, maar levertermijnen zijn indicatief en kunnen variëren. Warmeleads.eu is niet aansprakelijk voor eventuele vertragingen. Vertragingen geven de Klant geen recht op annulering van de overeenkomst of op enige schadevergoeding.</p>
            <p><span className="font-semibold text-slate-900">4.5</span> Warmeleads.eu behoudt zich het recht voor om de levering van leads op te schorten of te vertragen in geval van onvoorziene omstandigheden, zoals technische storingen of marktschommelingen die de kwaliteit of beschikbaarheid van de leads kunnen beïnvloeden. In een dergelijk geval wordt de Klant zo spoedig mogelijk op de hoogte gebracht.</p>
            <p><span className="font-semibold text-slate-900">4.5a</span> Leads die op exclusieve basis worden geleverd, worden gedurende een periode van 30 dagen uitsluitend gekoppeld aan de betreffende Klant. Na afloop van deze periode kan Warmeleads.eu, mits relevant en conform haar gebruikelijke werkwijze, besluiten deze gegevens opnieuw in te zetten binnen haar dienstverlening.</p>
          </div>
        </section>

        {/* Artikel 4.6 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 4.6: Reclamatie van Leads</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">4.6.1</span> Warmeleads.eu biedt de mogelijkheid om een reclamatie in te dienen voor een geleverde lead, uitsluitend onder de volgende omstandigheden:</p>
            <ul className="list-disc pl-8 space-y-2">
              <li><span className="font-semibold text-slate-900">Onjuist Telefoonnummer:</span> De lead bevat een onjuist of onbereikbaar telefoonnummer, waardoor contact met de potentiële klant niet mogelijk is.</li>
              <li><span className="font-semibold text-slate-900">Dubbele Lead binnen 1 Maand:</span> Indien een lead binnen één maand na de initiële levering opnieuw wordt aangeleverd aan dezelfde Klant, wordt deze als dubbel beschouwd en kan een reclamatie worden ingediend.</li>
            </ul>
            <p><span className="font-semibold text-slate-900">4.6.2</span> Leads die opnieuw worden aangeleverd na één maand worden beschouwd als nieuwe leads en zijn niet reclamabel. De Klant verklaart zich akkoord met deze voorwaarden door het aangaan van de overeenkomst.</p>
            <p><span className="font-semibold text-slate-900">4.6.3 Procedure voor Reclamatie:</span> De Klant kan een reclamatie indienen door de betreffende lead in de gedeelde Google Spreadsheet rood te markeren en in de opmerkingen de reden voor de reclamatie te vermelden (bijvoorbeeld &ldquo;onjuist telefoonnummer&rdquo; of &ldquo;dubbele lead&rdquo;). Warmeleads.eu zal de reclamatie beoordelen binnen 5 werkdagen. Indien de reclamatie wordt goedgekeurd, zal Warmeleads.eu de gereclameerde lead vervangen door een nieuwe lead die voldoet aan de kwaliteitscriteria.</p>
            <p><span className="font-semibold text-slate-900">4.6.4</span> Het reclameren van een lead houdt in dat de oorspronkelijke lead door een nieuwe, kwalitatieve lead wordt vervangen. Een credit of terugbetaling wordt niet aangeboden, tenzij uitdrukkelijk anders overeengekomen.</p>
            <p><span className="font-semibold text-slate-900">4.6.5</span> Warmeleads.eu behoudt zich het recht voor om reclamatieclaims te verwerpen indien de lead voldoet aan de door Warmeleads.eu vastgestelde kwaliteitscriteria.</p>
          </div>
        </section>

        {/* Artikel 5 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 5: Gedragscode en Ethisch Gebruik</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">5.1</span> De Klant verbindt zich ertoe om de geleverde leads op een ethische en wettelijk verantwoorde manier te gebruiken.</p>
            <p><span className="font-semibold text-slate-900">5.2</span> Het is de Klant niet toegestaan de leads door te verkopen aan derden zonder uitdrukkelijke schriftelijke toestemming van Warmeleads.eu.</p>
            <p><span className="font-semibold text-slate-900">5.3</span> Bij misbruik van de leads, waaronder het overtreden van privacywetgeving of het gebruik van misleidende of agressieve verkooppraktijken, behoudt Warmeleads.eu zich het recht voor om de overeenkomst met onmiddellijke ingang te beëindigen en schadevergoeding te vorderen.</p>
          </div>
        </section>

        {/* Artikel 6 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 6: Aansprakelijkheid</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">6.1</span> Warmeleads.eu is niet aansprakelijk voor enige schade, direct of indirect, voortvloeiend uit het gebruik van de geleverde leads, tenzij er sprake is van opzet of grove nalatigheid.</p>
            <p><span className="font-semibold text-slate-900">6.2</span> De aansprakelijkheid van Warmeleads.eu is in alle gevallen beperkt tot het bedrag dat de Klant voor de betreffende leads heeft betaald. Warmeleads.eu is niet aansprakelijk voor indirecte schade, zoals gederfde inkomsten of reputatieschade van de Klant.</p>
            <p><span className="font-semibold text-slate-900">6.3</span> De Klant vrijwaart Warmeleads.eu voor alle aanspraken van derden die voortvloeien uit of verband houden met het gebruik van de geleverde leads, inclusief claims in verband met schending van privacy of onrechtmatig gebruik van gegevens.</p>
            <p><span className="font-semibold text-slate-900">6.4</span> Warmeleads.eu is niet aansprakelijk voor vertragingen of uitval van dienstverlening als gevolg van omstandigheden buiten haar controle, zoals technische storingen, cyberaanvallen, natuurrampen, of overheidsmaatregelen (force majeure).</p>
          </div>
        </section>

        {/* Artikel 7 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 7: Privacy en Gegevensbescherming</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">7.1</span> Warmeleads.eu verwerkt persoonsgegevens van de Klant en de leads in overeenstemming met de Algemene Verordening Gegevensbescherming (AVG).</p>
            <p><span className="font-semibold text-slate-900">7.2</span> Warmeleads.eu bewaart en verwerkt deze gegevens alleen voor zover noodzakelijk voor de uitvoering van de overeenkomst en bewaart deze gegevens niet langer dan nodig is voor het doel waarvoor ze zijn verzameld.</p>
            <p><span className="font-semibold text-slate-900">7.3</span> De Klant is eveneens verplicht om te voldoen aan de AVG bij de verwerking van de leads die door Warmeleads.eu worden geleverd.</p>
            <p><span className="font-semibold text-slate-900">7.4</span> De Klant heeft het recht op inzage, correctie en verwijdering van zijn persoonsgegevens. Verzoeken hiertoe kunnen schriftelijk worden ingediend.</p>
          </div>
        </section>

        {/* Artikel 8 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 8: Intellectuele Eigendomsrechten</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">8.1</span> Alle methodologieën, technieken en processen die door Warmeleads.eu worden gebruikt voor het genereren en kwalificeren van leads blijven eigendom van Warmeleads.eu.</p>
            <p><span className="font-semibold text-slate-900">8.2</span> De Klant verkrijgt geen enkele vorm van intellectueel eigendomsrecht op deze methodologieën, technieken en processen.</p>
          </div>
        </section>

        {/* Artikel 9 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 9: Overmacht</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">9.1</span> Warmeleads.eu is niet gehouden tot het nakomen van enige verplichting jegens de Klant indien zij daartoe verhinderd is als gevolg van overmacht.</p>
            <p><span className="font-semibold text-slate-900">9.2</span> Onder overmacht wordt verstaan elke van de wil van Warmeleads.eu onafhankelijke omstandigheid die nakoming van de overeenkomst tijdelijk of blijvend verhindert.</p>
          </div>
        </section>

        {/* Artikel 10 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 10: Communicatie en Kennisgeving</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">10.1</span> Kennisgevingen en andere belangrijke correspondentie tussen Warmeleads.eu en de Klant dienen schriftelijk te worden gedaan via e-mail of post, tenzij anders overeengekomen.</p>
            <p><span className="font-semibold text-slate-900">10.2</span> Kennisgevingen worden geacht te zijn ontvangen op de dag dat ze zijn verzonden, tenzij het tegendeel wordt bewezen.</p>
          </div>
        </section>

        {/* Artikel 11 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 11: Publicatie en Archivering</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">11.1</span> Deze algemene voorwaarden worden gepubliceerd op de website van Warmeleads.eu en zijn daar ten allen tijde toegankelijk voor de Klant.</p>
            <p><span className="font-semibold text-slate-900">11.2</span> Warmeleads.eu behoudt zich het recht voor om de algemene voorwaarden te wijzigen. Gewijzigde voorwaarden zullen ten minste 30 dagen voor inwerkingtreding op de website worden gepubliceerd.</p>
            <p><span className="font-semibold text-slate-900">11.3</span> Historische versies van de algemene voorwaarden worden door Warmeleads.eu gearchiveerd en zijn op verzoek beschikbaar voor de Klant.</p>
          </div>
        </section>

        {/* Artikel 12 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 12: Overdracht van Rechten en Verplichtingen</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">12.1</span> De Klant mag zijn rechten en verplichtingen onder de overeenkomst niet zonder voorafgaande schriftelijke toestemming van Warmeleads.eu overdragen aan derden.</p>
          </div>
        </section>

        {/* Artikel 13 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 13: Feedback en Verbetering</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">13.1</span> Warmeleads.eu verwelkomt feedback van klanten met betrekking tot de kwaliteit van de geleverde leads en de dienstverlening.</p>
            <p><span className="font-semibold text-slate-900">13.2</span> Feedback kan worden ingediend via de contactgegevens op de website. Warmeleads.eu zal deze feedback gebruiken om haar diensten continu te verbeteren en waar mogelijk de ervaring van de Klant te optimaliseren.</p>
          </div>
        </section>

        {/* Artikel 14 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 14: Toepasselijk Recht en Jurisdictie</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">14.1</span> Op alle overeenkomsten en geschillen tussen Warmeleads.eu en de Klant is Nederlands recht van toepassing.</p>
            <p><span className="font-semibold text-slate-900">14.2</span> Geschillen zullen in eerste instantie worden voorgelegd aan de bevoegde rechter in het arrondissement waar Warmeleads.eu is gevestigd.</p>
          </div>
        </section>

        {/* Artikel 15 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Artikel 15: Wijzigingen</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p><span className="font-semibold text-slate-900">15.1</span> Warmeleads.eu behoudt zich het recht voor om deze algemene voorwaarden eenzijdig te wijzigen.</p>
          </div>
        </section>

        {/* Contact Info */}
        <section className="mb-10 pt-8 border-t border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Contactgegevens</h2>
          <div className="text-sm leading-relaxed text-slate-600 space-y-2">
            <p className="font-semibold text-slate-900">Warmeleads.eu</p>
            <p>Voor vragen over deze algemene voorwaarden kunt u contact met ons opnemen via de contactgegevens op onze website.</p>
          </div>
        </section>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/privacyverklaring"
            className="text-sm text-brand-purple hover:text-brand-orange transition-colors"
          >
            Privacyverklaring
          </Link>
          <Link
            href="/"
            className="text-sm text-brand-purple hover:text-brand-orange transition-colors"
          >
            Terug naar home
          </Link>
        </div>
      </div>

      </main>
      <Footer />
    </>
  );
}
