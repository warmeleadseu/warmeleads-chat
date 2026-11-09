import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Privacyverklaring | WarmeLeads',
  description: 'Privacyverklaring van WarmeLeads over de verwerking van persoonsgegevens conform de AVG.',
  alternates: { canonical: '/privacyverklaring' },
};

export default function PrivacyverklaringPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white text-slate-900">

      {/* Hero Banner */}
      <section className="bg-brand-navy py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">Privacyverklaring</h1>
          <p className="mt-3 text-base text-white/70">Versie 2.0 &middot; laatst gewijzigd op 9 november 2026</p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

        {/* Introductie */}
        <section className="mb-10">
          <p className="text-sm leading-relaxed text-slate-600">
            Warmeleads.eu, hierna te noemen &ldquo;wij&rdquo; of &ldquo;ons&rdquo;, hecht grote waarde aan de bescherming van je persoonsgegevens. In deze privacyverklaring leggen wij uit welke persoonsgegevens wij verzamelen, waarom wij deze verzamelen, hoe wij deze gebruiken en wat je rechten zijn. Deze privacyverklaring is van toepassing op alle diensten die wij aanbieden via onze website en andere kanalen.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Heb je via een formulier van WarmeLeads een aanvraag gedaan, bijvoorbeeld via Facebook of Instagram? Lees dan vooral het hoofdstuk <a href="#aanvragers" className="font-medium text-brand-purple underline decoration-brand-purple/30">&ldquo;Heb je een aanvraag gedaan?&rdquo;</a> hieronder.
          </p>
        </section>

        {/* Aanvragers */}
        <section id="aanvragers" className="mb-10 scroll-mt-24 rounded-2xl border border-brand-purple/20 bg-brand-purple/[0.03] p-5 sm:p-7">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Heb je een aanvraag gedaan? Zo gaan wij met je gegevens om</h2>
          <p className="mb-5 text-sm text-slate-500">Dit hoofdstuk geldt voor iedereen die via een formulier van WarmeLeads een aanvraag doet voor informatie of een offerte.</p>
          <div className="space-y-5 text-sm leading-relaxed text-slate-600">
            <div>
              <h3 className="font-semibold text-slate-900">A.1 Wat er gebeurt met je aanvraag</h3>
              <p className="mt-1">Als je via een formulier van WarmeLeads (bijvoorbeeld op Facebook of Instagram) een aanvraag doet voor informatie of een offerte, brengen wij je in contact met vakspecialisten die het product of de dienst leveren waarvoor je interesse hebt. Denk aan installateurs van warmtepompen, thuisbatterijen, zonnepanelen of airco&rsquo;s.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">A.2 Met hoeveel vakspecialisten wij je gegevens delen</h3>
              <p className="mt-1">Wij delen je gegevens met <span className="font-semibold text-slate-900">maximaal drie (3) vakspecialisten</span>. Dit maximum geldt voor de volledige periode waarin wij je aanvraag gebruiken (zie A.5), ongeacht de manier waarop de gegevens worden verstrekt. Wij selecteren deze vakspecialisten op basis van je regio en je wensen. Het gebruik van je gegevens binnen onze eigen organisatie, bijvoorbeeld voor administratie, kwaliteitscontrole of analyse, geldt niet als delen met een vakspecialist.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">A.3 Welke gegevens wij delen</h3>
              <p className="mt-1">Je naam, telefoonnummer, e-mailadres, adres of woonplaats, en de antwoorden die je in het formulier hebt gegeven, zoals het type woning, je wensen en je budget.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">A.4 Grondslag: jouw toestemming</h3>
              <p className="mt-1">Door het formulier te versturen geef je ons toestemming om je gegevens te delen met maximaal drie vakspecialisten. Je geeft deze vakspecialisten daarbij toestemming om je over je aanvraag te benaderen, telefonisch, per e-mail of via WhatsApp (artikel 6 lid 1 sub a AVG en artikel 11.7 Telecommunicatiewet). Je toestemming is vrijwillig: zonder deze toestemming kunnen wij je aanvraag niet in behandeling nemen.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">A.5 Hoe lang wij je aanvraag gebruiken</h3>
              <p className="mt-1">Wij gebruiken je aanvraag en mogen deze aan vakspecialisten verstrekken <span className="font-semibold text-slate-900">tot twaalf (12) maanden na de datum van je aanvraag</span>. Een aanvraag voor bijvoorbeeld een warmtepomp of thuisbatterij is vaak een beslissing van langere adem; zo kun je ook later nog goed geholpen worden. Na deze termijn delen wij je gegevens niet meer.</p>
              <p className="mt-2">Daarna bewaren wij je gegevens alleen, met beperkte toegang, voor zover dat nodig is om aan te tonen dat je toestemming hebt gegeven, om vragen, klachten en reclamaties af te handelen en om aan onze wettelijke verplichtingen te voldoen. Uiterlijk <span className="font-semibold text-slate-900">36 maanden</span> na je aanvraag verwijderen of anonimiseren wij je gegevens, tenzij een wettelijke verplichting of een lopend geschil langer bewaren noodzakelijk maakt.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">A.6 Toestemming intrekken</h3>
              <p className="mt-1">Je kunt je toestemming altijd intrekken door een e-mail te sturen naar <a href="mailto:info@warmeleads.eu" className="text-brand-purple underline decoration-brand-purple/30">info@warmeleads.eu</a> of te bellen naar +31 85 047 7067. Wij delen je gegevens dan vanaf dat moment niet meer, ook niet binnen de termijn van twaalf maanden. Wij informeren de vakspecialisten die je gegevens al hebben ontvangen dat zij je niet meer mogen benaderen en je gegevens moeten verwijderen. Intrekken heeft geen gevolgen voor wat er v&oacute;&oacute;r je intrekking rechtmatig is gebeurd. Doe je later opnieuw een aanvraag, dan geldt dat als nieuwe toestemming.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">A.7 De vakspecialist is zelf verantwoordelijk</h3>
              <p className="mt-1">Een vakspecialist die je gegevens van ons ontvangt, is daarna zelf verantwoordelijk voor de verwerking ervan (zelfstandig verwerkingsverantwoordelijke in de zin van de AVG). Wij verplichten vakspecialisten contractueel om je gegevens alleen voor jouw aanvraag te gebruiken, ze niet door te verkopen en een verzoek tot verwijdering of het intrekken van je toestemming op te volgen.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">A.8 Je rechten en klachten</h3>
              <p className="mt-1">Je hebt de rechten die in hoofdstuk 9 staan, zoals inzage, correctie en verwijdering. Heb je een klacht, neem dan eerst contact met ons op. Je kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens (zie hoofdstuk 10) of, als je in Belgi&euml; woont, bij de Gegevensbeschermingsautoriteit (GBA).</p>
            </div>
          </div>
        </section>

        {/* Artikel 1 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">1. Wie is verantwoordelijk voor de verwerking van je gegevens?</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Warmeleads.eu is verantwoordelijk voor de verwerking van persoonsgegevens zoals beschreven in deze privacyverklaring.</p>
            <p className="font-semibold text-slate-900">Contactgegevens:</p>
            <ul className="list-none space-y-1 ml-4">
              <li>Website: www.warmeleads.eu</li>
              <li>E-mail: info@warmeleads.eu</li>
              <li>Telefoon: +31 85 047 7067</li>
            </ul>
          </div>
        </section>

        {/* Artikel 2 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">2. Welke persoonsgegevens verwerken wij?</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Wij kunnen de volgende categorieën persoonsgegevens van je verwerken:</p>

            <h3 className="font-semibold text-slate-900 mt-4">2.1 Contactgegevens</h3>
            <ul className="list-disc pl-8 space-y-1">
              <li>Voor- en achternaam</li>
              <li>E-mailadres</li>
              <li>Telefoonnummer</li>
              <li>Bedrijfsnaam en functie</li>
              <li>Postadres en factuuradres</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-4">2.2 Accountgegevens</h3>
            <ul className="list-disc pl-8 space-y-1">
              <li>Gebruikersnaam en wachtwoord (versleuteld)</li>
              <li>Accountvoorkeuren en instellingen</li>
              <li>Communicatievoorkeuren</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-4">2.3 Transactiegegevens</h3>
            <ul className="list-disc pl-8 space-y-1">
              <li>Bestelgeschiedenis en ordergegevens</li>
              <li>Betaalgegevens (via beveiligde betaalproviders)</li>
              <li>Factuurgegevens en betalingsstatus</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-4">2.4 Leadgegevens</h3>
            <ul className="list-disc pl-8 space-y-1">
              <li>Gegevens van geleverde leads (namen, contactgegevens, interesse)</li>
              <li>Branche- en doelgroepinformatie</li>
              <li>Leadkwalificatie en -status</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-4">2.5 Technische en gebruiksgegevens</h3>
            <ul className="list-disc pl-8 space-y-1">
              <li>IP-adres en locatiegegevens</li>
              <li>Browser- en apparaatinformatie</li>
              <li>Cookies en vergelijkbare technologieën</li>
              <li>Websitegebruik en navigatiegedrag</li>
              <li>Klik- en scrollgedrag</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-4">2.6 Communicatiegegevens</h3>
            <ul className="list-disc pl-8 space-y-1">
              <li>E-mailcorrespondentie</li>
              <li>Chatgesprekken en WhatsApp-communicatie</li>
              <li>Telefoongesprekken (indien opgenomen, met je toestemming)</li>
              <li>Feedback en enquêtes</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-4">2.7 Marketing en analysegegevens</h3>
            <ul className="list-disc pl-8 space-y-1">
              <li>Marketingvoorkeuren</li>
              <li>Interactie met marketingcampagnes</li>
              <li>Social media interacties</li>
              <li>Remarketing en retargeting data</li>
            </ul>
          </div>
        </section>

        {/* Artikel 3 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">3. Waarom en op welke grondslag verwerken wij je gegevens?</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Wij verwerken je persoonsgegevens voor de volgende doeleinden en op de volgende grondslagen:</p>

            <h3 className="font-semibold text-slate-900 mt-4">3.1 Uitvoering van de overeenkomst</h3>
            <ul className="list-disc pl-8 space-y-1">
              <li>Verwerken van je bestellingen en leveren van leads</li>
              <li>Beheren van je account en klantenportaal</li>
              <li>Klantenservice en ondersteuning</li>
              <li>Facturatie en betalingsverwerking</li>
              <li>Afhandeling van reclamaties</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-4">3.2 Wettelijke verplichtingen</h3>
            <ul className="list-disc pl-8 space-y-1">
              <li>Voldoen aan boekhoudkundige verplichtingen</li>
              <li>Belastingaangiften</li>
              <li>Naleving van toepasselijke wet- en regelgeving</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-4">3.3 Gerechtvaardigd belang</h3>
            <ul className="list-disc pl-8 space-y-1">
              <li>Verbeteren van onze dienstverlening en gebruikerservaring</li>
              <li>Analyseren van websitegebruik en optimalisatie</li>
              <li>Fraudepreventie en beveiliging</li>
              <li>Directe marketing naar bestaande klanten</li>
              <li>Marktonderzoek en productverbeteringen</li>
              <li>Netwerkbeveiliging en systeemonderhoud</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-4">3.4 Toestemming</h3>
            <ul className="list-disc pl-8 space-y-1">
              <li>Marketing en nieuwsbrieven naar prospects</li>
              <li>Plaatsen van niet-functionele cookies</li>
              <li>Gepersonaliseerde advertenties en remarketing</li>
              <li>Delen van gegevens met derde partijen voor marketingdoeleinden</li>
              <li>Gebruik van chat- en communicatietools zoals WhatsApp</li>
            </ul>
            <p className="italic text-xs">Je kunt je toestemming te allen tijde intrekken zonder dat dit afbreuk doet aan de rechtmatigheid van de verwerking vóór de intrekking.</p>
          </div>
        </section>

        {/* Artikel 4 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">4. Cookies en vergelijkbare technologieën</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Onze website maakt gebruik van cookies en vergelijkbare technologieën om de functionaliteit te waarborgen, het gebruik te analyseren en te verbeteren, en om gerichte advertenties te tonen.</p>

            <h3 className="font-semibold text-slate-900 mt-4">4.1 Soorten cookies</h3>
            <ul className="list-disc pl-8 space-y-2">
              <li><span className="font-semibold text-slate-900">Functionele cookies:</span> Noodzakelijk voor de basisfunctionaliteit van de website</li>
              <li><span className="font-semibold text-slate-900">Analytische cookies:</span> Voor het analyseren van websitegebruik (Google Analytics, etc.)</li>
              <li><span className="font-semibold text-slate-900">Marketing cookies:</span> Voor het tonen van relevante advertenties en remarketing</li>
              <li><span className="font-semibold text-slate-900">Social media cookies:</span> Voor integratie met social media platforms</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-4">4.2 Third-party diensten</h3>
            <p>Wij maken gebruik van de volgende third-party diensten die cookies kunnen plaatsen:</p>
            <ul className="list-disc pl-8 space-y-1">
              <li>Google Analytics - voor website analyse</li>
              <li>Google Ads - voor online advertenties</li>
              <li>Facebook Pixel - voor social media marketing</li>
              <li>LinkedIn Insights - voor B2B marketing</li>
              <li>Hotjar of vergelijkbare tools - voor gebruikersgedrag analyse</li>
              <li>Stripe - voor betalingsverwerking</li>
            </ul>

            <p className="mt-4">Je kunt cookies beheren via je browserinstellingen. Let op: het uitschakelen van cookies kan de functionaliteit van onze website beperken.</p>
          </div>
        </section>

        {/* Artikel 5 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">5. Met wie delen wij je gegevens?</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Wij kunnen je persoonsgegevens delen met de volgende partijen:</p>

            <h3 className="font-semibold text-slate-900 mt-4">5.1 Dienstverleners en verwerkers</h3>
            <ul className="list-disc pl-8 space-y-1">
              <li>Hosting- en cloudopslagproviders</li>
              <li>Betalingsproviders (zoals Stripe)</li>
              <li>E-mailmarketingdiensten</li>
              <li>CRM-systemen en klantenservicesoftware</li>
              <li>Analysetools en marketingplatforms</li>
              <li>WhatsApp Business API providers</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-4">5.2 Vakspecialisten (bij een aanvraag)</h3>
            <p>Heb je een aanvraag gedaan, dan delen wij je gegevens met je toestemming met maximaal drie vakspecialisten. Hoe dat werkt, lees je in het hoofdstuk <a href="#aanvragers" className="text-brand-purple underline decoration-brand-purple/30">&ldquo;Heb je een aanvraag gedaan?&rdquo;</a>.</p>

            <h3 className="font-semibold text-slate-900 mt-4">5.2a Advertentienetwerken</h3>
            <p>Met je toestemming kunnen wij gegevens delen met advertentienetwerken (zoals Google, Meta en LinkedIn) om onze advertenties te meten en te verbeteren.</p>

            <h3 className="font-semibold text-slate-900 mt-4">5.3 Wettelijke verplichtingen</h3>
            <p>Wij kunnen je gegevens delen indien wij hiertoe wettelijk verplicht zijn of dit noodzakelijk is voor:</p>
            <ul className="list-disc pl-8 space-y-1">
              <li>Naleving van wettelijke procedures</li>
              <li>Bescherming van onze rechten en eigendom</li>
              <li>Fraudepreventie</li>
              <li>Bescherming van de veiligheid van gebruikers</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-4">5.4 Bedrijfsoverdrachten</h3>
            <p>Bij een fusie, overname of verkoop van activa kunnen je gegevens worden overgedragen aan de betrokken partijen.</p>
          </div>
        </section>

        {/* Artikel 6 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">6. Gegevensoverdracht buiten de EU</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Sommige van onze dienstverleners kunnen je gegevens verwerken buiten de Europese Economische Ruimte (EER). In dat geval zorgen wij voor passende waarborgen conform de AVG, zoals:</p>
            <ul className="list-disc pl-8 space-y-1">
              <li>EU-goedgekeurde standaardcontractbepalingen</li>
              <li>Adequaatheidsbesluit van de Europese Commissie</li>
              <li>Privacy Shield certificering (waar van toepassing)</li>
              <li>Bindende bedrijfsvoorschriften (Binding Corporate Rules)</li>
            </ul>
          </div>
        </section>

        {/* Artikel 7 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">7. Hoe lang bewaren wij je gegevens?</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Wij bewaren je persoonsgegevens niet langer dan noodzakelijk voor de doeleinden waarvoor ze zijn verzameld:</p>
            <ul className="list-disc pl-8 space-y-2">
              <li><span className="font-semibold text-slate-900">Accountgegevens:</span> Zolang je account actief is, en tot 3 maanden na sluiting</li>
              <li><span className="font-semibold text-slate-900">Transactiegegevens:</span> 7 jaar (wettelijke bewaarplicht)</li>
              <li><span className="font-semibold text-slate-900">Gegevens van aanvragers (leads):</span> Gebruik en verstrekking aan vakspecialisten tot 12 maanden na de aanvraag; daarna alleen bewaard voor bewijs, klachten en wettelijke verplichtingen, tot uiterlijk 36 maanden na de aanvraag (zie A.5)</li>
              <li><span className="font-semibold text-slate-900">Marketinggegevens:</span> Tot je je afmeldt of tot 3 jaar na laatste interactie</li>
              <li><span className="font-semibold text-slate-900">Cookies:</span> Maximaal 2 jaar, afhankelijk van het type cookie</li>
              <li><span className="font-semibold text-slate-900">Analysegegevens:</span> 26 maanden (Google Analytics standaard)</li>
              <li><span className="font-semibold text-slate-900">Correspondentie:</span> Tot 2 jaar na laatste contact</li>
            </ul>
            <p className="mt-4">Na afloop van de bewaartermijn worden je gegevens veilig verwijderd of geanonimiseerd.</p>
          </div>
        </section>

        {/* Artikel 8 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">8. Beveiliging van je gegevens</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Wij nemen de bescherming van je gegevens serieus en hebben passende technische en organisatorische maatregelen getroffen:</p>
            <ul className="list-disc pl-8 space-y-1">
              <li>SSL/TLS-versleuteling voor gegevensoverdracht</li>
              <li>Versleutelde opslag van gevoelige gegevens</li>
              <li>Regelmatige beveiligingsupdates en patches</li>
              <li>Toegangscontrole en authenticatie</li>
              <li>Regelmatige back-ups</li>
              <li>Beveiligingsmonitoring en logging</li>
              <li>Medewerkerstraining over gegevensbescherming</li>
            </ul>
          </div>
        </section>

        {/* Artikel 9 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">9. Je rechten</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Je hebt de volgende rechten met betrekking tot je persoonsgegevens:</p>
            <ul className="list-disc pl-8 space-y-2">
              <li><span className="font-semibold text-slate-900">Recht op inzage:</span> Je kunt opvragen welke persoonsgegevens wij van je verwerken</li>
              <li><span className="font-semibold text-slate-900">Recht op rectificatie:</span> Je kunt onjuiste gegevens laten corrigeren</li>
              <li><span className="font-semibold text-slate-900">Recht op verwijdering:</span> Je kunt verzoeken om verwijdering van je gegevens (&lsquo;recht om vergeten te worden&rsquo;)</li>
              <li><span className="font-semibold text-slate-900">Recht op beperking:</span> Je kunt verzoeken om beperking van de verwerking</li>
              <li><span className="font-semibold text-slate-900">Recht op dataportabiliteit:</span> Je kunt je gegevens in een gestructureerde vorm ontvangen</li>
              <li><span className="font-semibold text-slate-900">Recht van bezwaar:</span> Je kunt bezwaar maken tegen verwerking op basis van gerechtvaardigd belang</li>
              <li><span className="font-semibold text-slate-900">Recht om toestemming in te trekken:</span> Je kunt eerder gegeven toestemming te allen tijde intrekken</li>
            </ul>

            <p className="mt-4 font-semibold text-slate-900">Hoe kun je je rechten uitoefenen?</p>
            <p>Je kunt je rechten uitoefenen door contact met ons op te nemen via:</p>
            <ul className="list-none space-y-1 ml-4">
              <li>E-mail: info@warmeleads.eu</li>
              <li>Telefoon: +31 85 047 7067</li>
            </ul>
            <p className="mt-4">Wij reageren binnen 30 dagen op je verzoek. In bepaalde gevallen kunnen wij verzoeken weigeren op basis van wettelijke gronden, bijvoorbeeld indien wij gegevens moeten bewaren voor fiscale doeleinden.</p>
          </div>
        </section>

        {/* Artikel 10 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">10. Klachten</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Heb je een klacht over de verwerking van je persoonsgegevens? Neem dan eerst contact met ons op. Je hebt ook het recht om een klacht in te dienen bij de Autoriteit Persoonsgegevens:</p>
            <ul className="list-none space-y-1 ml-4 mt-4">
              <li className="font-semibold text-slate-900">Autoriteit Persoonsgegevens</li>
              <li>Postbus 93374</li>
              <li>2509 AJ Den Haag</li>
              <li>Website: www.autoriteitpersoonsgegevens.nl</li>
              <li>Telefoon: 088 - 1805 250</li>
            </ul>
            <p className="mt-4">Woon je in Belgi&euml;, dan kun je ook terecht bij de Gegevensbeschermingsautoriteit (GBA), Drukpersstraat 35, 1000 Brussel, www.gegevensbeschermingsautoriteit.be.</p>
          </div>
        </section>

        {/* Artikel 11 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">11. Geautomatiseerde besluitvorming en profiling</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Wij kunnen geautomatiseerde besluitvorming en profiling toepassen voor:</p>
            <ul className="list-disc pl-8 space-y-1">
              <li>Leadkwalificatie en scoring</li>
              <li>Personalisatie van content en aanbiedingen</li>
              <li>Fraudedetectie</li>
              <li>Website optimalisatie en A/B testing</li>
              <li>Gepersonaliseerde marketing en advertenties</li>
            </ul>
            <p className="mt-4">Deze verwerking heeft geen ingrijpende juridische gevolgen voor je. Je hebt het recht om niet onderworpen te worden aan volledig geautomatiseerde besluitvorming indien dit wel significante gevolgen heeft.</p>
          </div>
        </section>

        {/* Artikel 12 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">12. Minderjarigen</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Onze diensten zijn niet gericht op personen jonger dan 18 jaar. Wij verzamelen niet bewust persoonsgegevens van minderjarigen. Indien je vermoedt dat wij gegevens hebben verzameld van een minderjarige, neem dan contact met ons op.</p>
          </div>
        </section>

        {/* Artikel 13 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">13. Links naar andere websites</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Onze website kan links bevatten naar websites van derden. Wij zijn niet verantwoordelijk voor het privacybeleid en de praktijken van deze externe websites. Wij raden je aan om hun privacyverklaring te lezen wanneer je deze websites bezoekt.</p>
          </div>
        </section>

        {/* Artikel 14 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">14. Wijzigingen in deze privacyverklaring</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Wij behouden ons het recht voor om deze privacyverklaring te wijzigen. Wijzigingen worden gepubliceerd op deze pagina met vermelding van de datum van laatste wijziging. Wij adviseren je om deze privacyverklaring regelmatig te raadplegen om op de hoogte te blijven van eventuele wijzigingen.</p>
            <p className="mt-4">Bij ingrijpende wijzigingen zullen wij je hiervan op de hoogte stellen via e-mail of een melding op onze website.</p>
            <p className="mt-4">Wij archiveren alle eerdere versies van deze privacyverklaring. Voor een aanvraag geldt de versie die van kracht was op de datum van de aanvraag. Eerdere versies zijn op verzoek beschikbaar via info@warmeleads.eu.</p>
          </div>
        </section>

        {/* Artikel 15 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">15. Contact</h2>
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            <p>Voor vragen over deze privacyverklaring of over de verwerking van je persoonsgegevens kun je contact met ons opnemen:</p>
            <ul className="list-none space-y-1 ml-4 mt-4">
              <li className="font-semibold text-slate-900">Warmeleads.eu</li>
              <li>E-mail: info@warmeleads.eu</li>
              <li>Telefoon: +31 85 047 7067</li>
              <li>Website: www.warmeleads.eu</li>
            </ul>
          </div>
        </section>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/algemene-voorwaarden"
            className="text-sm text-brand-purple hover:text-brand-orange transition-colors"
          >
            Algemene voorwaarden
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
