export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ContentSection {
  type: 'text' | 'tip' | 'scenario' | 'keypoints' | 'warning';
  title?: string;
  body: string;
}

export interface Lesson {
  id: string;
  title: string;
  objective: string;
  sections: ContentSection[];
}

export interface Module {
  id: string;
  title: string;
  description: string;
  icon: string;
  lessons: Lesson[];
  quiz: QuizQuestion[];
}

export const MODULES: Module[] = [
  // ───────────────────── MODULE 1 ─────────────────────
  {
    id: 'welkom',
    title: 'Welkom bij WarmeLeads',
    description: 'Leer wie we zijn, waar we voor staan en wat jouw rol als account manager inhoudt.',
    icon: 'HandRaisedIcon',
    lessons: [
      {
        id: 'missie-visie',
        title: 'Onze missie en visie',
        objective: 'Begrijpen waar WarmeLeads voor staat en welk probleem we oplossen.',
        sections: [
          { type: 'text', title: 'Wie is WarmeLeads?', body: 'WarmeLeads is dé specialist in leadgeneratie in Nederland en België. We helpen bedrijven in uiteenlopende branches aan een constante stroom van kwalitatieve, exclusieve leads — zonder dat zij zelf hoeven te adverteren. Van verduurzaming tot bouw, van financiële dienstverlening tot woningverbetering: wij genereren leads voor elke branche.\n\nOnze roots en grootste specialisatie liggen in de verduurzamingsbranche (zonnepanelen, warmtepompen, isolatie, etc.), maar we breiden continu uit naar nieuwe markten en niches.\n\nOnze missie is simpel: **elk bedrijf verdient een volle agenda**. Wij zorgen voor de aanvragen, zij zorgen voor de uitvoering.' },
          { type: 'text', title: 'Het probleem dat we oplossen', body: 'Veel ondernemers en bedrijven zijn vakspecialisten maar geen marketeers. Ze besteden duizenden euro\'s per maand aan Google Ads of social media zonder te weten of het werkt. Of ze kopen goedkope leadlijsten die koud, verouderd of niet exclusief zijn.\n\nWarmeLeads biedt een alternatief: **resultaatgericht, betaalbaar en transparant**. Onze klanten betalen per lead, niet per klik. Geen abonnement, geen lock-in, geen verrassingen.' },
          { type: 'text', title: 'Onze visie', body: 'We geloven dat ondernemers zich moeten kunnen focussen op hun vak. Door hen te ontzorgen met een betrouwbare stroom van warme leads, helpen we bedrijven in elke branche om sneller te groeien. In de verduurzamingsbranche dragen we daarmee ook bij aan een snellere energietransitie.\n\nOnze ambitie: **de #1 leadpartner worden voor elk bedrijf in de Benelux**.' },
          { type: 'keypoints', body: '• WarmeLeads = dé leadgeneratie specialist voor alle branches\n• Sterke specialisatie in verduurzaming, maar actief in elke niche\n• Missie: elk bedrijf een volle agenda\n• Ambitie: #1 leadpartner in de Benelux\n• Pay-per-lead model: geen abonnement, geen lock-in\n• Focus op exclusiviteit en kwaliteit\n• Actief in Nederland en België' },
        ],
      },
      {
        id: 'kernwaarden-usps',
        title: 'Onze kernwaarden en USPs',
        objective: 'De unique selling points kennen die ons onderscheiden van de concurrentie.',
        sections: [
          { type: 'text', title: 'Onze 5 kernwaarden', body: '**1. Exclusiviteit** — Elke lead gaat naar maximaal één klant. Geen doorverkoop, geen gedeelde lijsten.\n\n**2. Transparantie** — Klanten zien precies wat ze krijgen via hun persoonlijke portaal. Geen verborgen kosten.\n\n**3. Kwaliteit boven kwantiteit** — We controleren elke lead op geldigheid, bereikbaarheid en relevantie voordat deze wordt geleverd.\n\n**4. Partnership** — We zijn geen leverancier maar een partner. Elke klant krijgt een vaste accountmanager.\n\n**5. Innovatie** — We optimaliseren continu onze campagnes met A/B-testing, AI-tools en data-analyse.' },
          { type: 'text', title: 'Wat maakt ons uniek?', body: '**Persoonlijk klantportaal** — Elke klant heeft een eigen portaal met real-time leadoverzicht, bestellingen, facturen en statistieken.\n\n**Campagnes op maat** — We bouwen voor elke klant specifieke campagnes afgestemd op regio, branche en doelgroep.\n\n**Geen vaste kosten** — €0 aan maandelijkse kosten. Klanten betalen alleen voor geleverde leads.\n\n**Snelle opstart** — Nieuwe campagnes staan binnen 24-72 uur live.\n\n**Reclamatiebeleid** — Terechte klachten over leadkwaliteit worden altijd gecompenseerd.' },
          { type: 'tip', title: 'Verkooptip', body: 'Benoem altijd de exclusiviteit en het ontbreken van vaste kosten als eerste in een gesprek. Dit zijn de twee punten die potentiële klanten het meest aanspreken en waarmee je je onderscheidt van concurrenten die vaak met gedeelde leads of abonnementen werken.' },
          { type: 'keypoints', body: '• 5 kernwaarden: exclusiviteit, transparantie, kwaliteit, partnership, innovatie\n• USPs: eigen portaal, campagnes op maat, geen vaste kosten, snelle opstart\n• Reclamatiebeleid als vertrouwenssignaal\n• Altijd benadrukken: exclusief + geen lock-in' },
        ],
      },
      {
        id: 'rol-als-am',
        title: 'Het team en jouw rol als AM',
        objective: 'Begrijpen hoe het team is opgebouwd en wat er van jou als account manager verwacht wordt.',
        sections: [
          { type: 'text', title: 'Het WarmeLeads team', body: 'WarmeLeads bestaat uit een compact, gespecialiseerd team:\n\n• **Marketing & Campagnes** — Bouwt en optimaliseert de advertentiecampagnes op Meta en Google\n• **Techniek & Development** — Ontwikkelt het klantportaal, CRM en alle koppelingen\n• **Account Management** — Jij! Het directe aanspreekpunt voor onze klanten\n• **Management** — Strategie, partnerships en bedrijfsvoering' },
          { type: 'text', title: 'Jouw rol als Account Manager', body: 'Als account manager ben jij het gezicht van WarmeLeads naar onze klanten toe. Je taken omvatten:\n\n**Acquisitie**\n• Nieuwe klanten werven via strategiegesprekken\n• Behoefteanalyse uitvoeren en maatwerk aanbieden\n• Offertes en batches samenstellen\n\n**Klantbeheer**\n• Vaste contactpersoon zijn voor je klanten\n• Periodieke evaluaties en check-ins uitvoeren\n• Feedback verzamelen en doorspelen naar het campagneteam\n\n**Groei**\n• Upselling: grotere batches en hogere volumes\n• Cross-selling: nieuwe branches introduceren\n• Retentie: zorgen dat klanten blijven herbestellen' },
          { type: 'warning', title: 'Belangrijk', body: 'Je bent geen klantenservice of helpdesk. Je bent een strategisch adviseur. Je helpt klanten om meer uit hun leads te halen en hun bedrijf te laten groeien met WarmeLeads als partner.' },
          { type: 'keypoints', body: '• Compact team: marketing, techniek, AM, management\n• AM = gezicht van WarmeLeads naar de klant\n• Drie pijlers: acquisitie, klantbeheer, groei\n• Strategisch adviseur, geen helpdesk' },
        ],
      },
    ],
    quiz: [
      { id: 'w1', question: 'Wat is het verdienmodel van WarmeLeads?', options: ['Maandelijks abonnement', 'Betalen per lead/batch', 'Commissie op opdrachten', 'Gratis met premium opties'], correctIndex: 1, explanation: 'WarmeLeads werkt met een pay-per-lead model. Klanten betalen per batch leads, zonder vaste maandelijkse kosten of lock-in.' },
      { id: 'w2', question: 'Wat betekent "exclusiviteit" bij WarmeLeads?', options: ['Leads zijn duurder dan bij concurrenten', 'Elke lead gaat naar maximaal één klant', 'Klanten moeten minimaal 1 jaar contract tekenen', 'Alleen grote bedrijven kunnen klant worden'], correctIndex: 1, explanation: 'Exclusiviteit betekent dat elke lead aan maximaal één klant wordt geleverd. We verkopen geen gedeelde leadlijsten.' },
      { id: 'w3', question: 'Wat is NIET een kernwaarde van WarmeLeads?', options: ['Transparantie', 'Kwantiteit boven kwaliteit', 'Partnership', 'Innovatie'], correctIndex: 1, explanation: 'Het is juist "kwaliteit boven kwantiteit". We focussen op de waarde en relevantie van elke lead, niet op het maximaliseren van aantallen.' },
      { id: 'w4', question: 'Wat is jouw primaire rol als account manager?', options: ['Technische support bieden', 'Strategisch adviseur en vast aanspreekpunt', 'Advertentiecampagnes opzetten', 'Leads handmatig invoeren'], correctIndex: 1, explanation: 'Als AM ben je het gezicht van WarmeLeads: strategisch adviseur, vast aanspreekpunt, en verantwoordelijk voor acquisitie, klantbeheer en groei.' },
    ],
  },

  // ───────────────────── MODULE 2 ─────────────────────
  {
    id: 'diensten',
    title: 'Onze Diensten en Producten',
    description: 'Alles over leadgeneratie, het batchsysteem, kwalificatie en onze branches.',
    icon: 'CubeIcon',
    lessons: [
      {
        id: 'wat-is-leadgeneratie',
        title: 'Wat is leadgeneratie?',
        objective: 'Het concept leadgeneratie begrijpen en kunnen uitleggen aan potentiële klanten.',
        sections: [
          { type: 'text', title: 'Leadgeneratie in het kort', body: 'Leadgeneratie is het proces waarbij we potentiële klanten (leads) genereren voor onze opdrachtgevers. Een lead is iemand die actief interesse toont in een product of dienst — bijvoorbeeld iemand die via een advertentie een formulier invult voor een offerte voor zonnepanelen.\n\nHet verschil met "koude acquisitie": onze leads zijn **warm**. De persoon heeft zelf de eerste stap gezet door informatie aan te vragen.' },
          { type: 'text', title: 'Hoe genereren we leads?', body: 'We gebruiken **online advertenties** op twee hoofdplatforms:\n\n**Meta (Facebook & Instagram)**\n• Bereik via gerichte advertenties in de nieuwsfeed en stories\n• Leadformulieren direct in het platform (lage drempel)\n• Krachtige targeting op demografie, interesses en gedrag\n\n**Google (Search & Display)**\n• Advertenties bovenaan zoekresultaten bij relevante zoekopdrachten\n• Display-banners op relevante websites\n• Bereik mensen op het moment dat ze actief zoeken\n\nVoor elke klant bouwen we **campagnes op maat**, gericht op hun specifieke regio, branche en doelgroep.' },
          { type: 'text', title: 'De reis van een lead', body: '1. **Advertentie** — Persoon ziet een gerichte advertentie op Meta of Google\n2. **Klik & formulier** — Persoon klikt en vult een aanvraagformulier in\n3. **Kwalificatie** — Ons systeem controleert de gegevens op geldigheid\n4. **Toewijzing** — De lead wordt automatisch toegewezen aan de juiste klant\n5. **Notificatie** — De klant ontvangt direct een melding via portaal, e-mail en/of push\n6. **Opvolging** — De klant neemt contact op met de lead' },
          { type: 'scenario', title: 'Voorbeeld uitleg aan klant', body: '"Stel, iemand in Amsterdam zoekt op Google naar \'zonnepanelen laten plaatsen\'. Ze zien onze advertentie, klikken erop en vullen hun gegevens in. Binnen enkele minuten ontvangt u deze aanvraag in uw portaal met naam, telefoonnummer, adres en eventuele opmerkingen. U belt ze op en maakt een afspraak — dat is een warme lead."' },
          { type: 'keypoints', body: '• Leadgeneratie = warme aanvragen genereren via online advertenties\n• Twee platforms: Meta (Facebook/Instagram) en Google (Search/Display)\n• Campagnes op maat per klant, regio en branche\n• Leads worden automatisch gekwalificeerd en toegewezen\n• Klant ontvangt real-time notificatie' },
        ],
      },
      {
        id: 'batchsysteem',
        title: 'Het batchsysteem en prijsmodel',
        objective: 'Het bestelsysteem en de prijsstructuur begrijpen en kunnen uitleggen.',
        sections: [
          { type: 'text', title: 'Wat is een batch?', body: 'Klanten kopen leads in **batches** — een vooraf bepaald aantal leads in een specifieke branche. Bijvoorbeeld: een batch van 100 zonnepanelen-leads.\n\nEen batch heeft:\n• **Branche** — bijv. Zonnepanelen, Warmtepompen\n• **Batchgrootte** — het aantal leads (bijv. 50, 100, 200, 500)\n• **Prijs per lead** — gebaseerd op branche en volume\n• **Geo-targeting** — specifieke regio\'s of heel Nederland/België\n• **Filters** — optionele criteria (bijv. alleen koopwoningen)' },
          { type: 'text', title: 'Het prijsmodel', body: '**Volumekorting** — Hoe groter de batch, hoe lager de prijs per lead. Dit stimuleert grotere bestellingen.\n\n**Brancheafhankelijk** — Elke branche heeft eigen prijstabellen. Populaire branches met meer volume hebben competitievere tarieven.\n\n**Geen vaste kosten** — Klanten betalen alleen voor de batch die ze bestellen. Geen setup-kosten, geen maandelijkse fee.\n\n**BTW** — Alle prijzen zijn exclusief 21% BTW. In het portaal wordt dit automatisch berekend.\n\n**Betaling** — Via het portaal met iDEAL/creditcard (Mollie). Leads worden direct na betaling geleverd.' },
          { type: 'tip', title: 'Verkooptip', body: 'Reken altijd de kosten per lead om naar de potentiële opbrengst. Als een zonnepanelen-installatie €10.000 oplevert en 1 op de 5 leads converteert, levert elke lead gemiddeld €2.000 op. Bij een leadprijs van €35 is de ROI dus enorm. Dit soort berekeningen overtuigt klanten.' },
          { type: 'text', title: 'Hoe bestelt een klant?', body: '**Optie 1: Via het portaal** — De klant logt in, kiest een branche, selecteert batchgrootte, ziet de prijs en betaalt online.\n\n**Optie 2: Via de account manager** — Jij stelt de batch samen in het admin-paneel op basis van het gesprek met de klant. De klant ontvangt een factuur.\n\nNa betaling wordt de batch geactiveerd en worden leads automatisch toegewezen zodra ze binnenkomen.' },
          { type: 'keypoints', body: '• Klanten kopen leads in batches per branche\n• Volumekorting: grotere batch = lagere prijs per lead\n• Geen vaste kosten, geen lock-in\n• Betaling via portaal (Mollie) of factuur\n• Batch start direct na betaling' },
        ],
      },
      {
        id: 'kwalificatie',
        title: 'Kwalificatie, filtering en exclusiviteit',
        objective: 'Begrijpen hoe leads worden gekwalificeerd en waarom onze kwaliteit hoog is.',
        sections: [
          { type: 'text', title: 'Automatische kwalificatie', body: 'Elke binnenkomende lead wordt automatisch gecontroleerd op:\n\n• **Telefoonnummer validatie** — Is het nummer geldig en bereikbaar?\n• **E-mail verificatie** — Is het een bestaand e-mailadres?\n• **Postcode check** — Valt het adres binnen het werkgebied van de klant?\n• **Dubbelcheck** — Is dezelfde persoon recent al als lead binnengekomen?\n• **Profanity filter** — Worden er ongepaste teksten gebruikt?\n\nLeads die niet door deze checks komen, worden niet geleverd aan klanten.' },
          { type: 'text', title: 'Klantspecifieke filters', body: 'Naast de standaard kwalificatie kunnen we per batch extra filters instellen:\n\n• **Geografisch** — Alleen leads uit specifieke postcodegebieden of straal rond een punt\n• **Type woning** — Bijv. alleen koopwoningen\n• **Budgetindicatie** — Minimumbudget van de lead\n• **Custom velden** — Elk veld uit het leadformulier kan als filter dienen\n\nDeze filters zorgen ervoor dat klanten alleen leads ontvangen die echt relevant zijn voor hun bedrijf.' },
          { type: 'text', title: 'Exclusiviteit en toewijzing', body: 'Ons systeem wijst leads toe op basis van een fairness-algoritme:\n\n1. **Geo-matching** — De lead moet binnen het werkgebied van de klant vallen\n2. **Branche-matching** — De lead moet bij de juiste branche horen\n3. **Beschikbaarheid** — De batch moet actief zijn en nog ruimte hebben\n4. **Fairness** — Bij meerdere matches krijgt de klant met de meest specifieke targeting en minste recente toewijzingen voorrang\n\nElke lead gaat naar **maximaal één klant**. Dit garandeert exclusiviteit.' },
          { type: 'scenario', title: 'Voorbeeld voor klant', body: '"Als u een batch zonnepanelen-leads bestelt met targeting op de regio Amsterdam-Zuid, ontvangt u alleen leads van mensen in dat gebied die actief interesse hebben getoond. Deze leads gaan niet naar een andere installateur — ze zijn exclusief voor u."' },
          { type: 'keypoints', body: '• Automatische kwalificatie op nummer, e-mail, postcode, duplicaten\n• Klantspecifieke filters voor geo, woningtype, budget\n• Fairness-algoritme voor toewijzing\n• Elke lead gaat naar maximaal één klant\n• Reclamatiemogelijkheid bij onterechte leads' },
        ],
      },
      {
        id: 'branches',
        title: 'Onze branches en niches',
        objective: 'Weten in welke branches we actief zijn en wat de mogelijkheden zijn.',
        sections: [
          { type: 'text', title: 'Branches overzicht', body: 'WarmeLeads is een branchebrede leadgeneratie specialist. We zijn actief in tientallen branches en niches. Onze grootste specialisatie ligt in de verduurzamingsbranche, maar we groeien continu in nieuwe markten.\n\n**Verduurzaming (onze specialisatie):**\n• **Zonnepanelen** — Onze grootste branche. Particulieren die zonnepanelen willen laten plaatsen.\n• **Warmtepompen** — Groeiende markt door gasvrij-ambities. Hybride en volledig elektrische.\n• **Thuisbatterijen** — Steeds populairder door stijgende energieprijzen.\n• **Isolatie** — Dak, spouw, vloer en glasisolatie.\n• **Airconditioning** — Seizoensgebonden maar consistente vraag.\n• **Financial Lease** — Financieringsoplossingen voor verduurzaming.\n\n**Overige branches:**\n• Dakkapellen, kozijnen & glas, veranda\'s en overkappingen\n• Laadpalen (elektrisch rijden)\n• B2B dienstverlening en zakelijke leadgeneratie\n• En nog veel meer — we kunnen in vrijwel elke branche leads genereren' },
          { type: 'text', title: 'Nieuwe niches en maatwerk', body: 'We staan open voor elke branche en niche. Als een potentiële klant in een branche zit waar we nog niet actief in zijn, is dat geen probleem.\n\nVoor nieuwe branches bieden we een **nicheonderzoek** aan voor €750. Dit bedrag wordt volledig gecrediteerd in leads als het onderzoek positief is. Doorlooptijd: 2-4 weken.\n\nDit maakt ons flexibel: ongeacht de branche van je prospect, kunnen we altijd een oplossing bieden.' },
          { type: 'tip', title: 'Cross-selling kans', body: 'Veel bedrijven zijn actief in meerdere branches. Een zonnepanelen-installateur biedt vaak ook warmtepompen of thuisbatterijen aan, en een bouwbedrijf doet vaak ook dakkapellen en kozijnen. Vraag altijd naar alle diensten van de klant — elke extra branche is een extra batch.' },
          { type: 'keypoints', body: '• Branchebrede leadgeneratie specialist — niet beperkt tot één sector\n• Sterke specialisatie in verduurzaming (zonnepanelen, warmtepompen, isolatie, etc.)\n• Actief in tientallen branches: van bouw tot financieel, van energie tot woningverbetering\n• Nicheonderzoek voor elke nieuwe branche: €750, gecrediteerd in leads\n• Cross-selling: klanten zijn vaak in meerdere branches actief' },
        ],
      },
    ],
    quiz: [
      { id: 'd1', question: 'Op welke twee hoofdplatforms adverteert WarmeLeads?', options: ['LinkedIn en Twitter', 'Meta (Facebook/Instagram) en Google', 'TikTok en YouTube', 'Bing en Yahoo'], correctIndex: 1, explanation: 'We adverteren op Meta (Facebook/Instagram) voor social bereik en Google (Search/Display) voor zoekintenties.' },
      { id: 'd2', question: 'Wat bepaalt de prijs per lead?', options: ['Alleen de branche', 'Branche en batchgrootte (volumekorting)', 'Het aantal medewerkers van de klant', 'De leeftijd van het bedrijf'], correctIndex: 1, explanation: 'De prijs per lead wordt bepaald door de branche en de batchgrootte. Grotere batches krijgen volumekorting.' },
      { id: 'd3', question: 'Wat kost het als een klant een nieuwe niche wil waar we nog niet actief in zijn?', options: ['Niet mogelijk', '€750 nicheonderzoek (gecrediteerd in leads)', '€250 per maand', '€1.500 eenmalig'], correctIndex: 1, explanation: 'We doen een nicheonderzoek voor €750 dat volledig wordt gecrediteerd in leads als het onderzoek positief uitvalt.' },
      { id: 'd4', question: 'Naar hoeveel klanten gaat een lead maximaal?', options: ['Drie klanten', 'Twee klanten', 'Eén klant (exclusief)', 'Onbeperkt (gedeeld)'], correctIndex: 2, explanation: 'Elke lead gaat naar maximaal één klant. Dit is ons exclusiviteitsprincipe.' },
      { id: 'd5', question: 'Welke van deze checks is GEEN onderdeel van onze automatische leadkwalificatie?', options: ['Telefoonnummer validatie', 'E-mail verificatie', 'Kredietwaardigheidscheck', 'Postcode check'], correctIndex: 2, explanation: 'We controleren telefoonnummer, e-mail en postcode. Een kredietwaardigheidscheck doen we niet — dat is de verantwoordelijkheid van de klant.' },
    ],
  },

  // ───────────────────── MODULE 3 ─────────────────────
  {
    id: 'portaal',
    title: 'Het Klantportaal',
    description: 'Leer het klantportaal van binnen en buiten kennen zodat je klanten perfect kunt begeleiden.',
    icon: 'ComputerDesktopIcon',
    lessons: [
      {
        id: 'portaal-overzicht',
        title: 'Portaaloverzicht en navigatie',
        objective: 'Het klantportaal kunnen demonstreren en uitleggen aan klanten.',
        sections: [
          { type: 'text', title: 'Wat is het klantportaal?', body: 'Elke klant krijgt toegang tot een persoonlijk online portaal op warmeleads.eu/portal. Dit is hun centrale plek voor:\n\n• **Leads bekijken** — Real-time overzicht van alle ontvangen leads\n• **Bestellen** — Nieuwe batches bestellen en betalen\n• **Account** — Facturen, bedrijfsgegevens en instellingen\n• **Feedback** — Beoordeling geven op leads\n\nHet portaal werkt op desktop, tablet en mobiel. Klanten kunnen het ook als app installeren (PWA) voor push-notificaties.' },
          { type: 'text', title: 'Navigatie', body: '**Dashboard** — Overzicht van actieve batches, recente leads, statistieken en voortgang. Hier ziet de klant in één oogopslag hoe het ervoor staat.\n\n**Leads** — Lijst van alle ontvangen leads met contactgegevens, datum, branche en status. Klanten kunnen direct bellen, WhatsAppen of e-mailen vanuit het portaal.\n\n**Bestellen** — Interface om nieuwe batches te configureren en te bestellen.\n\n**Account** — Facturen downloaden, bedrijfsgegevens wijzigen, accountmanager-info bekijken.' },
          { type: 'tip', title: 'Demonstratietip', body: 'Bied altijd aan om het portaal live te demonstreren tijdens een strategiegesprek. Laat het scherm delen of stuur screenshots. Een visuele demo overtuigt veel meer dan een verbale uitleg.' },
          { type: 'keypoints', body: '• Klantportaal = centrale hub voor leads, bestellingen en account\n• Werkt op alle apparaten + PWA met push-notificaties\n• Vier secties: Dashboard, Leads, Bestellen, Account\n• Live demo aanbieden in elk verkoopgesprek' },
        ],
      },
      {
        id: 'leads-beheren',
        title: 'Leads bekijken, bellen en feedback geven',
        objective: 'Weten hoe klanten hun leads beheren en hoe het feedbacksysteem werkt.',
        sections: [
          { type: 'text', title: 'Het leadsoverzicht', body: 'In het portaal zien klanten al hun leads in een overzichtelijke lijst met:\n\n• **Naam** van de potentiële klant\n• **Contactgegevens** — telefoon, e-mail, adres\n• **Branche** — bijv. Zonnepanelen\n• **Datum** — wanneer de lead is binnengekomen\n• **Notities** — eventuele opmerkingen van de lead\n\nKlanten kunnen direct vanuit het portaal:\n• 📞 **Bellen** — Eén tik op het telefoonnummer\n• 💬 **WhatsApp** — Direct een bericht sturen\n• ✉️ **E-mailen** — E-mail opstellen naar de lead' },
          { type: 'text', title: 'Feedback geven', body: 'Na het opvolgen van een lead kan de klant feedback geven via het portaal:\n\n• **Goed contact gehad** — De lead was bereikbaar en geïnteresseerd\n• **Verkocht!** — De lead heeft geconverteerd tot klant\n• **Onbereikbaar** — Niet kunnen bereiken na meerdere pogingen\n• **Niet geïnteresseerd** — Lead was toch niet geïnteresseerd\n• **Fout nummer** — Contactgegevens klopten niet\n\nDeze feedback is cruciaal: het helpt ons campagnes te optimaliseren en leadkwaliteit te verbeteren.' },
          { type: 'warning', title: 'Belangrijk voor jou als AM', body: 'Monitor de feedback van je klanten actief. Als een klant veel "onbereikbaar" of "fout nummer" terugkoppelt, is er mogelijk iets mis met de campagne of targeting. Meld dit direct bij het marketingteam.' },
          { type: 'keypoints', body: '• Leads overzicht met alle contactgegevens en one-tap acties\n• 5 feedbackopties: goed contact, verkocht, onbereikbaar, niet geïnteresseerd, fout nummer\n• Feedback = campagne-optimalisatie\n• Als AM: monitor feedback actief, escaleer problemen' },
        ],
      },
      {
        id: 'bestellen-betalen',
        title: 'Bestellen en betalen via het portaal',
        objective: 'Het bestelproces kunnen uitleggen en klanten hierbij begeleiden.',
        sections: [
          { type: 'text', title: 'Het bestelproces', body: '**Stap 1: Branche kiezen** — De klant selecteert de gewenste branche (bijv. Zonnepanelen).\n\n**Stap 2: Batchgrootte kiezen** — Keuze uit standaard formaten (50, 100, 200, 500) of een custom aantal.\n\n**Stap 3: Prijs berekenen** — Het portaal toont automatisch de prijs per lead en het totaalbedrag (excl. en incl. BTW).\n\n**Stap 4: Betalen** — Via iDEAL, creditcard of andere betaalmethoden via Mollie.\n\n**Stap 5: Activering** — Na betaling wordt de batch direct geactiveerd. Bestaande leads die matchen worden meteen toegewezen.' },
          { type: 'text', title: 'Herbestellingen', body: 'Wanneer een batch bijna vol is (80%), ontvangt de klant automatisch een e-mail met de suggestie om een nieuwe batch te bestellen. Dit voorkomt gaten in de leadlevering.\n\nNa voltooiing van een batch volgt nog een herinnering. Als AM is het jouw taak om hier proactief op in te spelen en de klant te bellen voordat de batch vol is.' },
          { type: 'tip', title: 'Timing tip', body: 'Bel je klant als de batch op 70-80% staat. Dan kun je samen de resultaten evalueren en direct een vervolg batch bespreken. Dit is het perfecte moment: de klant ziet de waarde en wil geen gat in de aanvoer.' },
          { type: 'keypoints', body: '• 5-staps bestelproces: branche → grootte → prijs → betaal → activering\n• Automatische herinnering bij 80% en voltooiing\n• Proactief bellen bij 70-80% voor herbestelling\n• Direct leads na betaling' },
        ],
      },
      {
        id: 'facturen-reclamaties',
        title: 'Facturen, reclamaties en account',
        objective: 'Klanten kunnen helpen met facturen, reclamaties en accountbeheer.',
        sections: [
          { type: 'text', title: 'Facturen', body: 'Klanten vinden al hun facturen in de Account-sectie van het portaal:\n\n• **Automatisch gegenereerd** — Na elke betaling wordt een factuur aangemaakt\n• **PDF download** — Elke factuur is downloadbaar als PDF\n• **Status tracking** — Openstaand, betaald, etc.\n• **BTW-specificatie** — Alles netjes met BTW-berekening voor de boekhouding' },
          { type: 'text', title: 'Reclamaties', body: 'Als een klant vindt dat een lead niet aan de kwaliteitsnormen voldoet, kan hij een reclamatie indienen via het portaal:\n\n1. Klant selecteert de betreffende lead\n2. Kiest een reden (bijv. "fout nummer", "buiten werkgebied")\n3. Voegt optioneel een toelichting toe\n4. Reclamatie wordt beoordeeld door het team\n5. Bij goedkeuring: lead wordt gecompenseerd (vervangende lead of creditering)\n\nAls AM kun je reclamaties van je klanten zien in het admin-paneel en proactief contact opnemen als er veel reclamaties binnenkomen.' },
          { type: 'text', title: 'Accountgegevens', body: 'In het account-gedeelte kan de klant:\n\n• Bedrijfsgegevens bekijken (KvK, BTW, adres)\n• Contactgegevens van hun account manager zien (jou!)\n• E-mail notificatie-instellingen aanpassen\n• Portaal wachtwoord wijzigen' },
          { type: 'keypoints', body: '• Facturen automatisch na betaling, downloadbaar als PDF\n• Reclamatieproces: 5 stappen via portaal\n• Goedgekeurde reclamaties worden gecompenseerd\n• Account: bedrijfsgegevens, AM-contact, instellingen' },
        ],
      },
    ],
    quiz: [
      { id: 'p1', question: 'Wat kan een klant NIET vanuit het portaal doen?', options: ['Leads bekijken en bellen', 'Nieuwe batches bestellen', 'Advertentiecampagnes aanpassen', 'Facturen downloaden als PDF'], correctIndex: 2, explanation: 'Klanten kunnen leads bekijken, bestellen en facturen downloaden, maar advertentiecampagnes worden beheerd door het WarmeLeads marketingteam.' },
      { id: 'p2', question: 'Wanneer moet je als AM proactief bellen over een herbestelling?', options: ['Als de batch op 10% staat', 'Als de batch op 70-80% staat', 'Alleen als de klant belt', 'Na 6 maanden inactiviteit'], correctIndex: 1, explanation: 'Bij 70-80% is het perfecte moment: de klant ziet resultaten en wil geen gat in de aanvoer.' },
      { id: 'p3', question: 'Welke feedbackoptie geeft het meest positieve signaal?', options: ['Goed contact gehad', 'Onbereikbaar', 'Verkocht!', 'Niet geïnteresseerd'], correctIndex: 2, explanation: '"Verkocht!" betekent dat de lead is geconverteerd tot betalende klant — het ultieme succes.' },
      { id: 'p4', question: 'Wat gebeurt er als een reclamatie wordt goedgekeurd?', options: ['De klant krijgt geld terug', 'De lead wordt vervangen of gecrediteerd', 'Er gebeurt niets', 'De campagne wordt gestopt'], correctIndex: 1, explanation: 'Goedgekeurde reclamaties worden gecompenseerd met een vervangende lead of creditering.' },
    ],
  },

  // ───────────────────── MODULE 4 ─────────────────────
  {
    id: 'marketing',
    title: 'Marketing en Campagnes',
    description: 'Begrijp hoe online adverteren werkt zodat je klanten goed kunt informeren.',
    icon: 'MegaphoneIcon',
    lessons: [
      {
        id: 'online-leadgen',
        title: 'Hoe online leadgeneratie werkt',
        objective: 'De basisbegrippen van online marketing begrijpen.',
        sections: [
          { type: 'text', title: 'De online marketing funnel', body: 'Online leadgeneratie werkt als een trechter (funnel):\n\n**Bereik (Awareness)** — Duizenden mensen zien de advertentie\n↓\n**Interesse (Click)** — Een percentage klikt op de advertentie\n↓\n**Aanvraag (Lead)** — Een deel vult het formulier in\n↓\n**Contact (Call)** — De klant belt de lead\n↓\n**Klant (Sale)** — Een deel wordt betalende klant\n\nHoe beter de advertentie, targeting en landingspagina, hoe hoger de conversie in elke stap.' },
          { type: 'text', title: 'Belangrijke begrippen', body: '**CPM** (Cost per Mille) — Kosten per 1.000 vertoningen\n**CPC** (Cost per Click) — Kosten per klik op de advertentie\n**CPL** (Cost per Lead) — Kosten per ingevuld formulier\n**CTR** (Click-Through Rate) — Percentage dat klikt op de advertentie\n**Conversieratio** — Percentage leads dat klant wordt\n**ROAS** (Return on Ad Spend) — Opbrengst ten opzichte van advertentiekosten\n\nJe hoeft niet alle details te kennen, maar deze termen helpen je om professioneel over te komen in gesprekken.' },
          { type: 'tip', title: 'Gesprekstip', body: 'Gebruik nooit te veel jargon in een klantgesprek. De meeste ondernemers zijn praktijkmensen. Gebruik concrete voorbeelden: "Van de 1.000 mensen die uw advertentie zien, klikken er 50 en 10 vullen hun gegevens in. Dat zijn 10 warme leads."' },
          { type: 'keypoints', body: '• Marketing funnel: bereik → interesse → lead → contact → klant\n• Belangrijke metrics: CPM, CPC, CPL, CTR, conversieratio, ROAS\n• Houd het simpel in klantgesprekken\n• Focus op de uitkomst (leads), niet het proces' },
        ],
      },
      {
        id: 'meta-ads',
        title: 'Adverteren op Meta (Facebook/Instagram)',
        objective: 'Begrijpen hoe Meta-advertenties werken en dit aan klanten kunnen uitleggen.',
        sections: [
          { type: 'text', title: 'Waarom Meta?', body: 'Meta (Facebook en Instagram) is ons primaire platform voor leadgeneratie. Waarom?\n\n• **3,7 miljard actieve gebruikers** wereldwijd\n• **Krachtige targeting** op leeftijd, locatie, interesses, gedrag en meer\n• **Lage drempel** — Leads kunnen direct een formulier invullen zonder de app te verlaten\n• **Visueel platform** — Effectief voor het tonen van producten, diensten en resultaten\n• **Kostenefficiënt** — Lagere kosten per lead dan veel andere kanalen' },
          { type: 'text', title: 'Hoe werkt het?', body: '**Advertentieformaten**\n• Lead Ads — Formulier direct in Facebook/Instagram (hoogste volume)\n• Traffic Ads — Verwijst naar een landingspagina met formulier\n• Video Ads — Korte video\'s die de aandacht trekken\n\n**Targeting**\n• **Locatie** — Specifieke steden, postcodes of straal\n• **Demografie** — Leeftijd, huiseigenaren, inkomen\n• **Interesses** — Afhankelijk van branche (bijv. duurzaamheid, verbouwen, financiën)\n• **Gedrag** — Actief op zoek naar relevante producten of diensten\n• **Lookalike audiences** — Mensen die lijken op bestaande klanten' },
          { type: 'text', title: 'Wat klanten moeten weten', body: 'Klanten hoeven niets te weten over de technische kant van Meta Ads. Wat ze wel moeten weten:\n\n• Wij beheren alles — zij hoeven niets te doen\n• Leads komen real-time binnen in hun portaal\n• We optimaliseren continu op basis van resultaten\n• Als leads niet goed zijn, passen wij de campagne aan\n\nHet enige dat de klant hoeft te doen is snel opvolgen.' },
          { type: 'keypoints', body: '• Meta = primair platform voor leadgeneratie\n• Lead Ads: formulier direct in Facebook/Instagram\n• Geavanceerde targeting op locatie, demografie, interesses\n• Klant hoeft niets te doen — wij beheren alles\n• Focus voor klant: snelle opvolging' },
        ],
      },
      {
        id: 'google-ads',
        title: 'Adverteren op Google (Search/Display)',
        objective: 'Begrijpen hoe Google-advertenties werken en wanneer dit voordelig is.',
        sections: [
          { type: 'text', title: 'Waarom Google?', body: 'Google Ads bereikt mensen die **actief zoeken** naar een oplossing. Dit levert vaak leads met een hogere koopintentie op.\n\n• **Zoekintentie** — Mensen zoeken actief naar "zonnepanelen plaatsen" of "warmtepomp offerte"\n• **Directe behoefte** — Deze mensen zijn al bezig met oriëntatie\n• **Google Display** — Banners op relevante websites voor breed bereik\n• **Combinatie** — We combineren Meta en Google voor optimaal resultaat' },
          { type: 'text', title: 'Search vs Display', body: '**Google Search**\n• Advertenties bovenaan de zoekresultaten\n• Triggert op zoektermen ("zoekopdrachten")\n• Hogere kwaliteit leads maar ook hogere kosten per klik\n• Ideaal voor branches met veel zoekvolume\n\n**Google Display**\n• Banneradvertenties op websites, apps en YouTube\n• Bereik via relevante contentwebsites\n• Lagere kosten maar meer "koud" verkeer\n• Goed voor merkbekendheid en retargeting' },
          { type: 'scenario', title: 'Uitleg voor de klant', body: '"We zetten twee soorten campagnes in. Op Google bereiken we mensen die actief zoeken naar uw dienst — die dus nu al een warmtepomp willen. Op Facebook en Instagram bereiken we mensen die er nog niet actief naar zoeken maar er wel voor openstaan. De combinatie zorgt voor een constante stroom van aanvragen."' },
          { type: 'keypoints', body: '• Google bereikt mensen met actieve zoekintentie\n• Search: hoge kwaliteit, hogere kosten per klik\n• Display: breed bereik, lagere kosten\n• We combineren Meta + Google voor optimaal resultaat\n• Klant hoeft technisch niets te weten' },
        ],
      },
      {
        id: 'campagne-opzet',
        title: 'Campagne-opzet, targeting en optimalisatie',
        objective: 'Begrijpen hoe ons marketingteam campagnes opzet en optimaliseert.',
        sections: [
          { type: 'text', title: 'Campagne-opzet', body: 'Voor elke klant bouwen we een campagne op maat:\n\n**1. Briefing** — We verzamelen info over de klant: werkgebied, diensten, doelgroep, USPs\n**2. Creatief** — We maken advertenties (tekst, afbeeldingen, video)\n**3. Targeting** — We stellen de geo-targeting, demografie en interesses in\n**4. Lancering** — De campagne gaat live (binnen 24-72 uur)\n**5. Optimalisatie** — We monitoren dagelijks en sturen bij' },
          { type: 'text', title: 'Hoe we optimaliseren', body: '**A/B-testing** — We testen verschillende advertenties, koppen en afbeeldingen tegen elkaar om te zien wat het best werkt.\n\n**Bid management** — We optimaliseren biedstrategieën om de laagste kosten per lead te bereiken.\n\n**Doelgroep verfijning** — We sluiten niet-converterende doelgroepen uit en versterken goed presterende segmenten.\n\n**Feedback loop** — Klantfeedback (via het portaal) helpt ons de kwaliteit continu te verbeteren.\n\n**Seizoensaanpassingen** — We passen campagnes aan op seizoenstrends (bijv. meer airco in voorjaar, zonnepanelen in lente).' },
          { type: 'tip', title: 'Gesprekstip', body: 'Klanten vragen vaak: "Hoe snel heb ik leads?" Antwoord: "De eerste leads komen meestal binnen 24-72 uur na lancering. In de eerste 1-2 weken optimaliseren we de campagne om de kwaliteit te verhogen. Vanaf week 2-3 draait het op volle toeren."' },
          { type: 'keypoints', body: '• Campagne-opzet: briefing → creatief → targeting → lancering → optimalisatie\n• A/B-testing, bid management en doelgroepverfijning\n• Feedbackloop: klantfeedback verbetert campagnes\n• Eerste leads binnen 24-72 uur\n• Volle performance vanaf week 2-3' },
        ],
      },
    ],
    quiz: [
      { id: 'm1', question: 'Wat is het verschil tussen Meta Ads en Google Search Ads?', options: ['Meta is duurder', 'Google bereikt mensen met actieve zoekintentie, Meta bereikt een bredere doelgroep', 'Er is geen verschil', 'Meta levert meer leads'], correctIndex: 1, explanation: 'Google Search bereikt mensen die actief zoeken (hoge intentie). Meta bereikt een bredere doelgroep via social targeting (meer volume).' },
      { id: 'm2', question: 'Hoe snel staan campagnes gemiddeld live?', options: ['Binnen 1 uur', 'Binnen 24-72 uur', 'Binnen 1-2 weken', 'Binnen 1 maand'], correctIndex: 1, explanation: 'Nieuwe campagnes staan gemiddeld binnen 24-72 uur live na goedkeuring.' },
      { id: 'm3', question: 'Wat is een "lookalike audience"?', options: ['Een groep bestaande klanten', 'Mensen die lijken op bestaande klanten', 'Mensen die de website hebben bezocht', 'Concurrenten'], correctIndex: 1, explanation: 'Een lookalike audience is een doelgroep die qua kenmerken lijkt op bestaande klanten of converters.' },
      { id: 'm4', question: 'Wat is de belangrijkste boodschap aan klanten over campagnebeheer?', options: ['Ze moeten zelf hun ads beheren', 'Wij beheren alles, zij hoeven niets te doen', 'Ze moeten eigen advertentiebudget betalen', 'Ze moeten minimaal 6 maanden wachten'], correctIndex: 1, explanation: 'WarmeLeads beheert alle campagnes. De klant hoeft alleen leads op te volgen.' },
    ],
  },

  // ───────────────────── MODULE 5 ─────────────────────
  {
    id: 'verkoop',
    title: 'Het Verkoopgesprek',
    description: 'Leer hoe je effectieve strategiegesprekken voert en deals sluit.',
    icon: 'UserGroupIcon',
    lessons: [
      {
        id: 'voorbereiding',
        title: 'Voorbereiding en klantresearch',
        objective: 'Weten hoe je je optimaal voorbereidt op een verkoopgesprek.',
        sections: [
          { type: 'text', title: 'Waarom voorbereiding cruciaal is', body: 'Een goed verkoopgesprek begint voor het gesprek. Met goede voorbereiding:\n\n• Laat je zien dat je de klant serieus neemt\n• Kun je gerichter vragen stellen\n• Identificeer je kansen voor grotere orders\n• Vermijd je onnodige bezwaren\n• Kom je professioneel en betrouwbaar over' },
          { type: 'text', title: 'Wat moet je onderzoeken?', body: '**Het bedrijf**\n• Wat doen ze precies? Welke diensten bieden ze aan?\n• In welke regio\'s zijn ze actief?\n• Hoe groot is het bedrijf? (medewerkers, omzet indicatie)\n• Hebben ze een website? Hoe professioneel is die?\n• Zijn ze actief op social media?\n\n**De markt**\n• Hoe competitief is hun regio voor hun diensten?\n• Zijn er seizoenspatronen?\n\n**De beslisser**\n• Met wie ga je in gesprek? Eigenaar, marketing, operations?\n• Wat is hun niveau van marketingkennis?\n\n**Bronnen:** Google, KvK, website, LinkedIn, social media' },
          { type: 'tip', title: 'Pro tip', body: 'Begin elk gesprek met een compliment of observatie over hun bedrijf: "Ik zag op jullie website dat jullie ook warmtepompen installeren — dat is een groeimarkt!" Dit laat zien dat je je huiswerk hebt gedaan en opent direct de deur naar cross-selling.' },
          { type: 'keypoints', body: '• Voorbereiding = professionaliteit en vertrouwen\n• Onderzoek: bedrijf, diensten, regio, website, contactpersoon\n• Bronnen: Google, KvK, LinkedIn, website\n• Start met een observatie over hun bedrijf' },
        ],
      },
      {
        id: 'strategiegesprek',
        title: 'Het strategiegesprek voeren',
        objective: 'De structuur van een effectief verkoopgesprek kennen.',
        sections: [
          { type: 'text', title: 'De gespreksstructuur', body: '**1. Opening (2 min)**\n• Stel jezelf voor als accountmanager bij WarmeLeads\n• Bedank voor hun tijd\n• Geef kort aan wat het doel van het gesprek is\n\n**2. Kennismaking (5 min)**\n• Vraag naar hun bedrijf en diensten\n• Toon interesse in hun werkgebied en specialisaties\n• Bouw rapport op — zoek gemeenschappelijke grond\n\n**3. Behoefteanalyse (10 min)**\n• Stel open vragen over hun huidige leadaanvoer\n• Identificeer pijnpunten en wensen\n• Begrijp hun capaciteit en groeiambitie\n\n**4. Presentatie (10 min)**\n• Leg uit hoe WarmeLeads werkt\n• Koppel onze oplossing aan hun specifieke behoeften\n• Toon het portaal (demo)\n\n**5. Voorstel (5 min)**\n• Doe een concreet voorstel: branche, batchgrootte, prijs\n• Bereken de potentiële ROI\n\n**6. Afsluiting (3 min)**\n• Beantwoord laatste vragen\n• Spreek vervolgstappen af\n• Bedank en bevestig per e-mail' },
          { type: 'warning', title: 'Veelgemaakte fout', body: 'Spring niet te snel naar de presentatie. Besteed minimaal een derde van het gesprek aan luisteren en vragen stellen. Pas als je de behoeften begrijpt, kun je een overtuigend voorstel doen.' },
          { type: 'keypoints', body: '• 6-staps structuur: opening → kennismaking → analyse → presentatie → voorstel → afsluiting\n• Besteed minimaal ⅓ aan luisteren/vragen\n• Altijd een concreet voorstel doen\n• Vervolgstappen afspreken en bevestigen per e-mail' },
        ],
      },
      {
        id: 'behoefteanalyse',
        title: 'Behoefteanalyse en pain points',
        objective: 'De juiste vragen stellen om de werkelijke behoeften van de klant te achterhalen.',
        sections: [
          { type: 'text', title: 'De juiste vragen stellen', body: 'De behoefteanalyse is het belangrijkste deel van het gesprek. Gebruik deze vragen:\n\n**Huidige situatie**\n• "Hoe komen jullie op dit moment aan nieuwe klanten?"\n• "Adverteren jullie zelf online? Zo ja, op welke platforms?"\n• "Hoeveel nieuwe aanvragen krijgen jullie gemiddeld per week/maand?"\n\n**Pijnpunten**\n• "Wat zijn jullie grootste uitdagingen op het gebied van nieuwe klanten?"\n• "Hebben jullie weleens leads gekocht? Hoe was die ervaring?"\n• "Zijn er periodes dat het rustig is?"\n\n**Ambitie**\n• "Hoeveel nieuwe klanten/opdrachten zouden jullie per maand willen?"\n• "In welke regio willen jullie groeien?"\n• "Overwegen jullie nieuwe diensten aan te bieden?"' },
          { type: 'text', title: 'Veelvoorkomende pain points', body: '**"We hebben het te druk om te adverteren"**\n→ Wij nemen het volledig uit handen\n\n**"We hebben slechte ervaringen met leads"**\n→ Onze leads zijn exclusief en gekwalificeerd, met reclamatiebeleid\n\n**"Online adverteren is te duur"**\n→ Bij ons betaal je per lead, niet per klik. Je weet precies wat je krijgt\n\n**"We hebben een wisselende vraag"**\n→ Met batches kun je het volume zelf bepalen — geen abonnement\n\n**"We willen eerst zien of het werkt"**\n→ Begin met een kleine batch van 50 leads, geen risico' },
          { type: 'keypoints', body: '• Stel open vragen over situatie, pijnpunten en ambitie\n• Luister actief — maak notities\n• Koppel elk pijnpunt aan onze oplossing\n• De kleinste batch als instap aanbieden bij twijfel' },
        ],
      },
      {
        id: 'bezwaren',
        title: 'Bezwaren herkennen en weerleggen',
        objective: 'Veelvoorkomende bezwaren kennen en professioneel weerleggen.',
        sections: [
          { type: 'text', title: 'De 8 meest voorkomende bezwaren', body: '**1. "Het is te duur"**\n→ "Laten we de rekening omdraaien. Als een gemiddelde opdracht €8.000 oplevert en 1 op 5 leads converteert, levert elke lead u €1.600 op. Bij een leadprijs van €35 is dat een rendement van 45x."\n\n**2. "Ik wil er eerst over nadenken"**\n→ "Dat begrijp ik. Wat zou u nog willen weten om een beslissing te nemen? Laten we dat nu bespreken."\n\n**3. "Ik heb slechte ervaringen met leadbedrijven"**\n→ "Dat hoor ik vaker. Wat ging er precies mis? Bij ons zijn leads exclusief, gekwalificeerd, en u kunt reclameren als een lead niet klopt."\n\n**4. "We hebben al genoeg werk"**\n→ "Geweldig! Dan is dit het moment om te selecteren op de beste klanten. Met meer leads kunt u kiezen voor de meest winstgevende projecten."' },
          { type: 'text', body: '**5. "Ik geloof niet in online leads"**\n→ "Begrijpelijk als u dat nog niet heeft ervaren. Honderden bedrijven in diverse branches werken al met ons. Mag ik een voorbeeld laten zien van hoe het portaal eruitziet?"\n\n**6. "Ik wil eerst een gratis proef"**\n→ "We bieden geen gratis proeven, maar u kunt starten met een kleine batch van 50 leads. Zo houdt u het risico klein en ziet u direct de kwaliteit."\n\n**7. "Een collega doet het al"**\n→ "Veel bedrijven in dezelfde regio werken met ons — leads zijn exclusief per klant. Maar ik kan kijken of er nog ruimte is in uw specifieke postcodegebied."\n\n**8. "Ik moet het overleggen met mijn partner/compagnon"**\n→ "Natuurlijk. Zal ik een samenvatting sturen die u kunt delen? En zullen we volgende week even kort bellen om de vragen te bespreken?"' },
          { type: 'tip', title: 'De gouden regel', body: 'Weerleg een bezwaar nooit door het te ontkennen. Erken het eerst ("Dat begrijp ik"), stel dan een vraag ("Wat ging er mis?"), en bied vervolgens de oplossing ("Bij ons werkt dat anders, namelijk..."). Dit heet de ERV-methode: Erkennen, Raadplegen, Verhelpen.' },
          { type: 'keypoints', body: '• 8 meest voorkomende bezwaren met weerleggingen\n• ERV-methode: Erkennen → Raadplegen → Verhelpen\n• ROI-berekening altijd paraat hebben\n• Kleine batch als instap bij twijfelaars\n• Altijd vervolgafspraak maken' },
        ],
      },
      {
        id: 'deal-sluiten',
        title: 'De deal sluiten en opvolgen',
        objective: 'Effectieve afsluittechnieken beheersen en een goede opvolging garanderen.',
        sections: [
          { type: 'text', title: 'Afsluittechnieken', body: '**De directe afsluiting**\n"Zullen we starten met een batch van 100 zonnepanelen-leads voor de regio Amsterdam?"\n\n**De alternatieve afsluiting**\n"Wilt u beginnen met 100 of 200 leads?"\n\n**De tijdgebonden afsluiting**\n"Als we deze week starten, draait de campagne maandag al. Dan ontvangt u de eerste leads volgende week."\n\n**De samenvatting-afsluiting**\n"Laat me samenvatten: u wilt leads voor zonnepanelen in de regio Utrecht, circa 100 stuks, met targeting op koopwoningen. Zal ik dat voor u klaarzetten?"' },
          { type: 'text', title: 'Na de deal', body: '**Direct na het gesprek:**\n1. Stuur een bevestigingsmail met samenvatting\n2. Maak de batch aan in het admin-paneel\n3. Stuur de klant een portaal-uitnodiging\n4. Plan een check-in call na 1-2 weken\n\n**Na activering:**\n1. Controleer of de eerste leads binnenkomen\n2. Bel de klant na 3-5 leads voor een korte evaluatie\n3. Bespreek de kwaliteit en stel bij indien nodig\n4. Plan een formele evaluatie na 50% batchvoortgang' },
          { type: 'keypoints', body: '• 4 afsluittechnieken: direct, alternatief, tijdgebonden, samenvatting\n• Post-deal: bevestiging, batch aanmaken, portaal-uitnodiging, check-in plannen\n• Eerste evaluatie na 3-5 leads\n• Formele evaluatie bij 50% batchvoortgang' },
        ],
      },
    ],
    quiz: [
      { id: 'v1', question: 'Hoeveel tijd besteed je minimaal aan de behoefteanalyse?', options: ['5% van het gesprek', 'Een derde van het gesprek', 'De helft van het gesprek', 'Het hele gesprek'], correctIndex: 1, explanation: 'Besteed minimaal een derde van het gesprek aan luisteren en vragen stellen voordat je je presentatie doet.' },
      { id: 'v2', question: 'Wat is de ERV-methode voor bezwaren?', options: ['Elimineren, Reageren, Verkopen', 'Erkennen, Raadplegen, Verhelpen', 'Evalueren, Rapporteren, Verbeteren', 'Eerst, Recht, Verantwoording'], correctIndex: 1, explanation: 'ERV: Erken het bezwaar, Raadpleeg (stel vragen), en Verhulp met een oplossing.' },
      { id: 'v3', question: 'Wat doe je als eerste NA het sluiten van een deal?', options: ['Direct bellen over upselling', 'Bevestigingsmail sturen met samenvatting', 'Wachten tot de klant belt', 'Een factuur sturen'], correctIndex: 1, explanation: 'Direct na het gesprek stuur je een bevestigingsmail met een samenvatting van de afspraken.' },
      { id: 'v4', question: 'Hoe weerleg je "het is te duur"?', options: ['Door korting te geven', 'Door de ROI per lead te berekenen', 'Door te zeggen dat het niet duur is', 'Door gratis leads aan te bieden'], correctIndex: 1, explanation: 'Bereken de ROI: als een gemiddelde opdracht €8.000 oplevert en 1 op 5 leads converteert, levert elke lead gemiddeld €1.600 op — ver boven de leadprijs.' },
      { id: 'v5', question: 'Wat is een goede instap voor een twijfelende klant?', options: ['Een jaarcontract met korting', 'Een kleine batch van 50 leads', 'Een gratis proefperiode', 'Een presentatie over onze technologie'], correctIndex: 1, explanation: 'Een kleine batch van 50 leads is laagdrempelig, zonder risico, en laat de klant de kwaliteit ervaren.' },
    ],
  },

  // ───────────────────── MODULE 6 ─────────────────────
  {
    id: 'verwachtingen',
    title: 'Verwachtingsmanagement',
    description: 'Leer hoe je realistische verwachtingen schept en klanten tevreden houdt.',
    icon: 'ScaleIcon',
    lessons: [
      {
        id: 'beloftes',
        title: 'Wat we wel en niet beloven',
        objective: 'Weten welke verwachtingen je mag scheppen en welke niet.',
        sections: [
          { type: 'text', title: 'Wat we WEL beloven', body: '✅ **Exclusieve leads** — Elke lead gaat naar één klant\n✅ **Gekwalificeerde leads** — Automatische checks op geldigheid\n✅ **Transparantie** — Alles inzichtelijk via het portaal\n✅ **Reclamatiebeleid** — Compensatie bij onterechte leads\n✅ **Vaste accountmanager** — Persoonlijk aanspreekpunt\n✅ **Snelle opstart** — Campagnes live binnen 24-72 uur\n✅ **Geen lock-in** — Geen abonnement of langlopend contract' },
          { type: 'text', title: 'Wat we NIET beloven', body: '❌ **Gegarandeerde conversie** — We leveren leads, niet klanten. De klant is zelf verantwoordelijk voor opvolging en verkoop.\n❌ **Exact aantal leads per dag/week** — Volume fluctueert op basis van marktomstandigheden en seizoen.\n❌ **Dat elke lead een klant wordt** — Realistisch converteert 10-30% van de leads, afhankelijk van de branche en opvolging.\n❌ **Onbeperkt volume** — Het aantal beschikbare leads is afhankelijk van de campagne en regio.\n❌ **Dat leads altijd opnemen** — Sommige mensen zijn niet direct bereikbaar; dat is normaal bij leadgeneratie.' },
          { type: 'warning', title: 'Gouden regel', body: 'Underpromise, overdeliver. Het is beter om conservatief te zijn in je beloftes en de klant positief te verrassen, dan grote beloftes te doen die je niet kunt waarmaken. Een teleurgestelde klant is veel moeilijker te behouden dan een tevreden klant.' },
          { type: 'keypoints', body: '• WEL: exclusiviteit, kwalificatie, transparantie, reclamatie, geen lock-in\n• NIET: gegarandeerde conversie, exact volume, 100% bereikbaarheid\n• Realistisch: 10-30% conversie afhankelijk van branche en opvolging\n• Underpromise, overdeliver' },
        ],
      },
      {
        id: 'volumes',
        title: 'Realistische volumes en levertijden',
        objective: 'Correcte verwachtingen kunnen communiceren over aantallen en timing.',
        sections: [
          { type: 'text', title: 'Opstarttijd', body: '**Bestaande branche/regio:**\n• Campagne live: 24-72 uur na akkoord\n• Eerste leads: meestal binnen de eerste week\n• Volledig op stoom: na 2-3 weken optimalisatie\n\n**Nieuwe branche (nicheonderzoek):**\n• Onderzoeksfase: 2-4 weken\n• Campagne live: 24-72 uur na goedkeuring\n• Eerste leads: week 3-5 na start traject' },
          { type: 'text', title: 'Volumefluctuaties', body: 'Leadvolume is niet lineair. Factoren die het beïnvloeden:\n\n**Seizoen** — Sommige branches zijn seizoensafhankelijk (bijv. airco in zomer, zonnepanelen in lente), andere zijn stabieler\n\n**Marktomstandigheden** — Marktontwikkelingen, subsidiewijzigingen, nieuws en trends in de betreffende branche\n\n**Dag van de week** — Doordeweeks is drukker dan in het weekend\n\n**Campagne-optimalisatie** — De eerste weken optimaliseren we de campagne, daarna stabiliseert het volume\n\nCommuniceer dit proactief: "In de eerste 2-3 weken kan het volume wat fluctueren terwijl we de campagne optimaliseren. Daarna stabiliseert het."' },
          { type: 'tip', title: 'Praktijktip', body: 'Geef nooit een specifiek dagelijks of wekelijks aantal als belofte. Zeg: "Op basis van vergelijkbare klanten in uw regio verwachten we circa X-Y leads per maand." Gebruik altijd een range, geen exact getal.' },
          { type: 'keypoints', body: '• Opstart bestaande branche: 24-72 uur, eerste leads binnen 1 week\n• Nieuwe branche: 2-4 weken onderzoek + opstarttijd\n• Volume fluctueert: seizoen, markt, dag, optimalisatiefase\n• Altijd een range communiceren, nooit exact getal\n• Proactief communiceren over de optimalisatieperiode' },
        ],
      },
      {
        id: 'kwaliteit-uitleggen',
        title: 'Lead kwaliteit en conversie uitleggen',
        objective: 'Klanten helpen begrijpen wat realistische conversiepercentages zijn.',
        sections: [
          { type: 'text', title: 'Wat is een "goede" lead?', body: 'Een goede lead is iemand die:\n• Zijn/haar echte contactgegevens heeft ingevuld\n• Daadwerkelijk interesse heeft in de dienst\n• Bereikbaar is (eventueel na meerdere pogingen)\n• Binnen het werkgebied van de klant valt\n\nEen goede lead is NIET per definitie iemand die direct koopt. Het is een warme aanvraag die professioneel moet worden opgevolgd.' },
          { type: 'text', title: 'Realistische conversiepercentages', body: 'Conversiepercentages variëren sterk per branche. Enkele indicaties uit de verduurzaming:\n\n**Zonnepanelen:** 15-25% conversie (goed opvolgbeleid)\n**Warmtepompen:** 10-20% conversie\n**Thuisbatterijen:** 10-15% conversie\n**Airconditioning:** 20-30% conversie (hoge urgentie)\n**Isolatie:** 15-25% conversie\n\nVoor andere branches gelden vergelijkbare ranges (10-30%), afhankelijk van:\n• Snelheid van opvolging (binnen 1 uur is ideaal)\n• Kwaliteit van het verkoopgesprek\n• Prijs en aanbod van het bedrijf\n• Seizoen en marktomstandigheden' },
          { type: 'scenario', title: 'Rekenvoorbeeld voor de klant', body: '"U bestelt 100 zonnepanelen-leads voor €35 per stuk. Investering: €3.500 + BTW. Bij een conversie van 20% levert dat 20 opdrachten op. Bij een gemiddelde omzet van €8.000 per opdracht is dat €160.000 omzet op een investering van €4.235 incl. BTW. Dat is een ROI van bijna 38x."' },
          { type: 'keypoints', body: '• Goede lead ≠ directe koper, maar warme aanvraag\n• Conversie varieert per branche: 10-30%\n• Factoren: opvolgsnelheid, gesprekskwaliteit, prijs, seizoen\n• ROI-berekening is het sterkste verkoopargument\n• Binnen 1 uur opvolgen is ideaal' },
        ],
      },
      {
        id: 'prijs-roi',
        title: 'Prijscommunicatie en ROI-berekeningen',
        objective: 'Zelfverzekerd over prijs praten en ROI berekenen.',
        sections: [
          { type: 'text', title: 'Prijs is relatief', body: 'Praat nooit over prijs als kosten, maar als investering. Het gaat niet om wat een lead kost, maar om wat een lead oplevert.\n\n**De formule:**\nROI = (Gemiddelde opbrengst per opdracht × Conversiepercentage) / Prijs per lead\n\n**Voorbeeld:**\n(€10.000 × 20%) / €35 = €2.000 / €35 = 57x ROI\n\nOmgekeerd: de "kosten per klant" = Prijs per lead / Conversiepercentage = €35 / 20% = €175 per nieuwe klant. Dat is een fractie van wat Google Ads of andere kanalen kosten.' },
          { type: 'text', title: 'Vergelijking met alternatieven', body: '**Zelf adverteren op Google:**\n• €3.000-5.000 per maand aan advertentiekosten\n• Plus kosten voor een marketingbureau (€500-2.000/maand)\n• Geen garantie op resultaat\n• Totaal: €3.500-7.000/maand\n\n**WarmeLeads:**\n• 100 leads × €35 = €3.500 (eenmalig)\n• Geen maandelijkse kosten\n• Alleen betalen voor leads\n\nDe vergelijking spreekt voor zich, maar presenteer het niet als "goedkoper" maar als "resultaatgerichter".' },
          { type: 'tip', title: 'Prijsgesprek tip', body: 'Als een klant de prijs per lead te hoog vindt, draai het om: "Wat zou u zelf betalen voor een klant die een opdracht van €10.000 afneemt? Als onze leads 1 op 5 converteren, betaalt u effectief €175 per klant." Dat relativeert de prijs per lead enorm.' },
          { type: 'keypoints', body: '• Praat over investering, niet over kosten\n• ROI-formule: (opbrengst × conversie%) / leadprijs\n• Vergelijk met alternatieven: zelf adverteren kost €3.500-7.000/maand\n• "Kosten per klant" berekening is een krachtig argument\n• Presenteer als resultaatgericht, niet als goedkoop' },
        ],
      },
    ],
    quiz: [
      { id: 'vw1', question: 'Wat beloven we NIET aan klanten?', options: ['Exclusieve leads', 'Gegarandeerde conversie', 'Reclamatiebeleid', 'Persoonlijke accountmanager'], correctIndex: 1, explanation: 'We leveren gekwalificeerde, exclusieve leads maar garanderen geen conversie. De klant is verantwoordelijk voor opvolging.' },
      { id: 'vw2', question: 'Wat is een realistisch conversiepercentage voor zonnepanelen-leads?', options: ['50-70%', '1-5%', '15-25%', '80-90%'], correctIndex: 2, explanation: 'Bij zonnepanelen-leads ligt de conversie typisch tussen 15-25% bij goed opvolgbeleid.' },
      { id: 'vw3', question: 'Hoe snel moet een lead ideaal worden opgevolgd?', options: ['Binnen 24 uur', 'Binnen 1 uur', 'Binnen 1 week', 'Maakt niet uit'], correctIndex: 1, explanation: 'Binnen 1 uur opvolgen is ideaal. Hoe sneller de opvolging, hoe hoger de conversiekans.' },
      { id: 'vw4', question: 'Hoe praat je over de prijs van leads?', options: ['Als kosten die je kwijt bent', 'Als investering met een meetbare ROI', 'Zo min mogelijk over prijs praten', 'Door korting te bieden'], correctIndex: 1, explanation: 'Praat altijd over investering en ROI, niet over kosten. Bereken wat een lead oplevert, niet wat het kost.' },
    ],
  },

  // ───────────────────── MODULE 7 ─────────────────────
  {
    id: 'retentie',
    title: 'Klantrelatie en Retentie',
    description: 'Leer hoe je klanten langdurig tevreden houdt en herbestellingen stimuleert.',
    icon: 'HeartIcon',
    lessons: [
      {
        id: 'onboarding',
        title: 'Onboarding van nieuwe klanten',
        objective: 'Een perfect onboardingproces uitvoeren voor nieuwe klanten.',
        sections: [
          { type: 'text', title: 'De eerste 48 uur', body: 'De onboarding bepaalt de toon voor de hele klantrelatie. In de eerste 48 uur:\n\n**Dag 1 — Activering**\n1. Batch aanmaken in het admin-paneel\n2. Portaaltoegang instellen en uitnodiging versturen\n3. Welkomstmail sturen met je contactgegevens\n4. Kort telefoontje: "Alles is klaargemaakt, de eerste leads kunnen vanaf nu binnenkomen"\n\n**Dag 2 — Check-in**\n1. Controleer of de klant heeft ingelogd op het portaal\n2. Als er al leads zijn: bel kort om te vragen hoe het gaat\n3. Als er nog geen leads zijn: geef aan dat dit normaal is in de opstartfase' },
          { type: 'text', title: 'De eerste week', body: '**Na 3-5 leads:**\nBel de klant voor een korte evaluatie:\n• "Hoe was de kwaliteit van de eerste leads?"\n• "Heeft u ze allemaal kunnen bereiken?"\n• "Zijn er al afspraken uit voortgekomen?"\n\nDit laat zien dat je betrokken bent en geeft je vroeg de kans om problemen op te lossen.\n\n**Na de eerste week:**\nStuur een kort berichtje (WhatsApp of e-mail):\n• "Hoe gaat het met de leads tot nu toe?"\n• Bied aan om geo-targeting of filters aan te passen als dat nodig is' },
          { type: 'tip', title: 'Onboarding tip', body: 'Stuur na de eerste succesvolle deal van de klant een felicitatiebericht: "Gefeliciteerd met uw eerste klant via WarmeLeads!" Dit kleine gebaar versterkt de relatie enorm en creëert een positief anker.' },
          { type: 'keypoints', body: '• Dag 1: activering + welkomst + telefoontje\n• Dag 2: check-in op portaaltoegang\n• Na 3-5 leads: evaluatiegesprek\n• Na eerste week: kort check-in bericht\n• Feliciteer bij eerste succes' },
        ],
      },
      {
        id: 'check-ins',
        title: 'Periodieke check-ins en evaluaties',
        objective: 'Een effectief ritme van klantevaluaties opzetten.',
        sections: [
          { type: 'text', title: 'Het check-in ritme', body: '**Wekelijks (eerste maand)**\nKort telefoontje of WhatsApp om te peilen hoe het gaat. Focus: kwaliteit, volume, tevredenheid.\n\n**Tweewekelijks (maand 2-3)**\nIets uitgebreider: bespreek resultaten, conversie, eventuele aanpassingen.\n\n**Maandelijks (structureel)**\nFormeel evaluatiegesprek:\n• Totaal leads geleverd en feedback\n• Conversieresultaten\n• Tevredenheid en verbeterpunten\n• Upselling/cross-selling kansen\n• Planning voor de komende periode' },
          { type: 'text', title: 'Het evaluatiegesprek', body: 'Structuur voor een maandelijkse evaluatie:\n\n1. **Resultaten bespreken** — Hoeveel leads, hoeveel conversies, welke feedback\n2. **ROI berekenen** — Wat heeft de klant verdiend ten opzichte van de investering\n3. **Knelpunten identificeren** — Zijn er problemen met kwaliteit, volume of opvolging?\n4. **Optimaliseren** — Wat kunnen we aanpassen? (targeting, filters, volume)\n5. **Vooruitkijken** — Nieuwe batch, extra branche, groter volume?' },
          { type: 'tip', title: 'CRM tip', body: 'Houd per klant een logboek bij van alle contactmomenten, afspraken en acties. Gebruik het admin-paneel en/of je eigen notities. Niets is vervelender voor een klant dan een AM die vergeten is wat er vorige keer besproken is.' },
          { type: 'keypoints', body: '• Wekelijks (maand 1) → tweewekelijks (maand 2-3) → maandelijks (structureel)\n• Evaluatiegesprek: resultaten, ROI, knelpunten, optimaliseren, vooruitkijken\n• Houd een klantlogboek bij\n• Structurele evaluaties = structurele herbestellingen' },
        ],
      },
      {
        id: 'feedback-escalaties',
        title: 'Feedback verwerken en escalaties',
        objective: 'Negatieve feedback professioneel afhandelen en escalaties voorkomen.',
        sections: [
          { type: 'text', title: 'Feedback categorieën', body: '**Positieve feedback** — Bevestig en gebruik voor upselling: "Mooi om te horen! Als het zo goed loopt, is het misschien slim om het volume te verhogen?"\n\n**Neutrale feedback** — Vraag door: "Wat zou het beter maken?" Gebruik dit om targeting of filters te verfijnen.\n\n**Negatieve feedback** — Neem altijd serieus. Stappen:\n1. Erken het probleem\n2. Vraag naar specifieke voorbeelden\n3. Onderzoek de oorzaak (campagne, targeting, of verwachtingsmanagement)\n4. Los het op en communiceer de oplossing\n5. Volg op om te verifiëren dat het probleem is opgelost' },
          { type: 'text', title: 'Escalatie voorkomen', body: '**Signalen van ontevredenheid:**\n• Klant geeft veel negatieve feedback via portaal\n• Klant reageert trager op berichten\n• Klant stelt herbestelling uit\n• Klant klaagt over dezelfde issues herhaaldelijk\n\n**Proactief handelen:**\nBel direct als je deze signalen ziet. Wacht niet tot de klant escaleert. Een proactief telefoontje voorkomt in 90% van de gevallen een escalatie.' },
          { type: 'warning', title: 'Escalatieprotocol', body: 'Als een klant structureel ontevreden is ondanks je inspanningen, escaleer dan naar je leidinggevende. Documenteer alle contactmomenten, acties en resultaten. Probeer het niet zelf eindeloos op te lossen als het een structureel probleem is.' },
          { type: 'keypoints', body: '• Positieve feedback → bevestig + upsell\n• Negatieve feedback → erken, onderzoek, los op, follow-up\n• Herken signalen van ontevredenheid vroeg\n• Proactief bellen voorkomt 90% van escalaties\n• Escaleer tijdig bij structurele problemen' },
        ],
      },
      {
        id: 'klachtenafhandeling',
        title: 'Klachtenafhandeling en reclamaties',
        objective: 'Klachten professioneel en snel afhandelen.',
        sections: [
          { type: 'text', title: 'Het klachtenproces', body: 'Klachten komen op twee manieren binnen:\n\n**Via het portaal** — Klant dient een reclamatie in op een specifieke lead. Deze verschijnt in het admin-paneel.\n\n**Via jou als AM** — Klant belt of mailt met een klacht.\n\nIn beide gevallen:\n1. **Erken** de klacht binnen 4 uur\n2. **Onderzoek** de specifieke situatie\n3. **Communiceer** de uitkomst binnen 24 uur\n4. **Compenseer** indien terecht (vervangende lead of creditering)\n5. **Voorkom** herhaling door oorzaak aan te pakken' },
          { type: 'text', title: 'Veelvoorkomende klachten', body: '**"De lead is onbereikbaar"**\n→ Adviseer 3x bellen op verschillende tijdstippen + SMS/WhatsApp sturen\n\n**"De lead woont buiten mijn werkgebied"**\n→ Controleer de targeting en dien zo nodig een reclamatie in\n\n**"De lead is niet geïnteresseerd"**\n→ Vraag naar het gesprek — soms ligt het aan de opvolging\n\n**"Ik krijg te weinig leads"**\n→ Check het campagnevolume, bespreek eventuele uitbreiding van werkgebied of branches\n\n**"De kwaliteit is slecht"**\n→ Vraag om specifieke voorbeelden, controleer de feedback in het portaal, en overleg met het marketingteam' },
          { type: 'keypoints', body: '• Erken binnen 4 uur, los op binnen 24 uur\n• 5 stappen: erken, onderzoek, communiceer, compenseer, voorkom\n• Veelvoorkomende klachten met standaard reacties\n• Documenteer alles voor escalatieprotocol' },
        ],
      },
      {
        id: 'tevredenheid',
        title: 'Klanttevredenheid meten en verbeteren',
        objective: 'Inzicht krijgen in klanttevredenheid en hierop sturen.',
        sections: [
          { type: 'text', title: 'Tevredenheidsindicatoren', body: 'Je kunt klanttevredenheid meten aan:\n\n**Directe indicatoren:**\n• Portaalfeedback ratio (verhouding positief/negatief)\n• Reclamatie-frequentie\n• Directe feedback in gesprekken\n\n**Indirecte indicatoren:**\n• Herbestelgedrag — Bestelt de klant snel opnieuw?\n• Response tijd — Reageert de klant snel op je berichten?\n• Referrals — Verwijst de klant anderen door?\n• Batchgrootte-trend — Bestelt de klant steeds grotere batches?\n\nEen klant die snel herbestelt in grotere batches en collega\'s doorverwijst is maximaal tevreden.' },
          { type: 'text', title: 'Tevredenheid verbeteren', body: '**De 5 pijlers van klanttevredenheid:**\n\n1. **Kwaliteit** — Lever kwalitatieve, relevante leads\n2. **Communicatie** — Wees proactief, bereikbaar en transparant\n3. **Snelheid** — Reageer snel op vragen en klachten\n4. **Betrokkenheid** — Toon oprechte interesse in het succes van de klant\n5. **Resultaat** — Help de klant om meer uit de leads te halen\n\nFocus niet alleen op leadlevering maar op het totale succes van de klant. Als de klant groeit, groeien wij mee.' },
          { type: 'keypoints', body: '• Directe indicatoren: feedback, reclamaties, gesprekken\n• Indirecte indicatoren: herbestellingen, response, referrals, batchgrootte\n• 5 pijlers: kwaliteit, communicatie, snelheid, betrokkenheid, resultaat\n• Focus op totaal klantsucces, niet alleen leadlevering' },
        ],
      },
    ],
    quiz: [
      { id: 'r1', question: 'Wanneer doe je de eerste check-in bij een nieuwe klant?', options: ['Na 1 maand', 'Na 3-5 geleverde leads', 'Als de klant belt', 'Na voltooiing van de batch'], correctIndex: 1, explanation: 'Na 3-5 leads is het juiste moment voor een eerste evaluatie. Vroeg genoeg om problemen te signaleren, laat genoeg voor een gefundeerde evaluatie.' },
      { id: 'r2', question: 'Binnen hoeveel uur moet je een klacht erkennen?', options: ['Binnen 1 uur', 'Binnen 4 uur', 'Binnen 24 uur', 'Binnen 48 uur'], correctIndex: 1, explanation: 'Erken een klacht binnen 4 uur en los het op binnen 24 uur.' },
      { id: 'r3', question: 'Wat is het sterkste signaal van klanttevredenheid?', options: ['De klant heeft geen klachten', 'De klant bestelt snel grotere batches en verwijst collega\'s door', 'De klant belt nooit', 'De klant geeft altijd "goed contact" feedback'], correctIndex: 1, explanation: 'Herbestellen in grotere batches en doorverwijzen zijn de sterkste indicatoren van tevredenheid en vertrouwen.' },
      { id: 'r4', question: 'Wat doe je als een klant structureel ontevreden is?', options: ['Niets, dat gaat vanzelf over', 'Korting geven', 'Documenteren en escaleren naar leidinggevende', 'De klant laten gaan'], correctIndex: 2, explanation: 'Bij structurele ontevredenheid: documenteer alles en escaleer. Probeer het niet eindeloos zelf op te lossen.' },
    ],
  },

  // ───────────────────── MODULE 8 ─────────────────────
  {
    id: 'groei',
    title: 'Commercieel Groeien',
    description: 'Maximaliseer de omzet per klant door upselling, cross-selling en referrals.',
    icon: 'RocketLaunchIcon',
    lessons: [
      {
        id: 'upselling',
        title: 'Upselling: grotere batches verkopen',
        objective: 'Bestaande klanten overtuigen om grotere batches te bestellen.',
        sections: [
          { type: 'text', title: 'Waarom upselling belangrijk is', body: 'Een bestaande, tevreden klant laten groeien is 5-7x goedkoper dan een nieuwe klant werven. Upselling is daarom je belangrijkste groeistrategie.\n\n**Voordelen voor de klant:**\n• Lagere prijs per lead bij grotere volumes (volumekorting)\n• Continu leadaanvoer zonder onderbrekingen\n• Meer selectiviteit: meer leads = meer keuze\n\n**Voordelen voor WarmeLeads:**\n• Hogere omzet per klant\n• Lagere acquisitiekosten\n• Stabielere inkomsten' },
          { type: 'text', title: 'Wanneer upsellen?', body: '**Het perfecte moment:**\n1. **Bij het evaluatiegesprek** — Resultaten zijn positief, klant is tevreden\n2. **Bij 70-80% batchvoortgang** — "U bent bijna door uw batch heen, zullen we direct upgraden?"\n3. **Na een succesvolle verkoop** — "Gefeliciteerd! Met meer leads kunt u dit succes herhalen"\n4. **Bij seizoenspiek** — "Het is lente, de vraag naar zonnepanelen piekt nu"\n5. **Na positieve feedback** — "Het gaat goed, tijd om op te schalen!"' },
          { type: 'scenario', title: 'Voorbeeld upselling gesprek', body: '"Pieter, ik zie dat je batch van 100 leads al voor 75% is geleverd en dat je al 18 afspraken hebt gemaakt. Dat is een conversie van 24%! Als we de volgende batch upgraden naar 200 leads, betaal je per lead minder en heb je maanden lang een stabiele stroom aanvragen. Zal ik dat even voor je berekenen?"' },
          { type: 'keypoints', body: '• Upselling is 5-7x goedkoper dan nieuwe klant werven\n• Perfect moment: evaluatie, 70-80% batch, na succes, seizoenspiek\n• Altijd koppelen aan klantvoordeel (lagere prijs, meer keuze)\n• Concrete berekening meenemen' },
        ],
      },
      {
        id: 'cross-selling',
        title: 'Cross-selling: nieuwe branches aanbieden',
        objective: 'Klanten activeren in extra branches voor meer omzet.',
        sections: [
          { type: 'text', title: 'Cross-selling kansen', body: 'Veel bedrijven zijn actief in meerdere branches. Veelvoorkomende combinaties in de verduurzaming:\n\n• **Zonnepanelen + Thuisbatterijen** — Natuurlijke combinatie\n• **Zonnepanelen + Warmtepompen** — All-electric trend\n• **Warmtepompen + Airconditioning** — Zelfde apparatuur (reversible)\n• **Isolatie + Alle energietechnieken** — Basis voor verduurzaming\n\nMaar ook breder:\n• **Dakkapellen + Kozijnen** — Zelfde type klant\n• **Bouw + Verbouwing** — Complementaire diensten\n• Elke combinatie is mogelijk zolang er vraag is in de regio\n\nVraag altijd: "Bieden jullie naast [huidige branche] nog andere diensten aan?"' },
          { type: 'text', title: 'Hoe cross-sellen?', body: '**Stap 1: Identificeren** — Vraag naar alle diensten van de klant\n**Stap 2: Valideren** — Bevestig dat er vraag is in hun regio\n**Stap 3: Voorstel** — "We kunnen ook [branche] leads leveren. Zal ik de mogelijkheden bekijken?"\n**Stap 4: Instap** — Begin met een kleine batch in de nieuwe branche\n**Stap 5: Evalueren** — Bespreek resultaten en schaal op\n\nBegin altijd klein. Een klant die al tevreden is over zonnepanelen-leads zal sneller een kleine batch warmtepomp-leads proberen.' },
          { type: 'tip', title: 'Cross-sell tip', body: 'Combineer cross-selling met seizoensadvies: "Nu het zomer wordt, is er veel vraag naar airconditioning. Jullie installeren dat toch ook? Zal ik kijken wat er mogelijk is in jullie regio?" Dit voelt als advies, niet als verkoop.' },
          { type: 'keypoints', body: '• Veel bedrijven zijn actief in 2-3+ branches\n• Veelvoorkomende combinaties kennen (binnen en buiten verduurzaming)\n• Altijd vragen naar alle diensten\n• Klein beginnen in nieuwe branche\n• Combineer met seizoensadvies' },
        ],
      },
      {
        id: 'herbestellingen',
        title: 'Herbestellingen stimuleren',
        objective: 'Zorgen voor een continu herbestelpatroon bij bestaande klanten.',
        sections: [
          { type: 'text', title: 'Het herbestelritme', body: 'Het ideale scenario: klanten bestellen automatisch een nieuwe batch zodra de vorige bijna vol is. Hoe bereik je dit?\n\n**Proactief plannen:**\n• Bel bij 70% batchvoortgang: "Zullen we alvast de volgende batch plannen?"\n• Bereken de batchduur: als 100 leads in 6 weken zijn geleverd, plan de volgende batch bij week 4-5\n• Stel een vast herbestelritme voor: "De meeste klanten in uw segment bestellen elke 6-8 weken"\n\n**Automatische herinneringen:**\nHet systeem stuurt automatisch mails bij 80% en 100% voltooiing, maar jouw persoonlijke bericht heeft veel meer impact.' },
          { type: 'text', title: 'Herbestel weerstand overwinnen', body: '**"Ik wil even pauzeren"**\n→ "Begrijpelijk. Mag ik vragen waarom? Als het om de drukte gaat, kunnen we het volume verlagen. Als het om de kwaliteit gaat, laten we dat eerst aanpakken."\n\n**"Ik heb nog genoeg leads van de vorige batch"**\n→ "Goed om te horen! Wanneer verwacht u weer ruimte te hebben? Zal ik over X weken even bellen?"\n\n**"Het budget is op"**\n→ "Begrijpelijk. Met een kleinere batch van 50 leads kunt u de stroom toch aanhouden tegen een beperkte investering."' },
          { type: 'keypoints', body: '• Bel proactief bij 70% batchvoortgang\n• Stel een vast herbestelritme voor\n• Persoonlijk bericht > automatische herinnering\n• Bij weerstand: doorvragen, alternatieven bieden\n• Kleinere batch als alternatief bij budgetbezwaar' },
        ],
      },
      {
        id: 'referrals',
        title: 'Referrals en netwerken',
        objective: 'Bestaande klanten inzetten als bron van nieuwe klanten.',
        sections: [
          { type: 'text', title: 'Waarom referrals zo waardevol zijn', body: 'Een doorverwijzing van een tevreden klant is de krachtigste vorm van acquisitie:\n\n• **Hoge conversie** — De prospect vertrouwt de aanbeveling van een collega\n• **Lage kosten** — Geen advertentiekosten, alleen jouw tijd\n• **Snelle cyclus** — Vaak snellere beslissing dan bij koude acquisitie\n• **Positieve start** — De relatie begint met vertrouwen\n\nOnderzoek toont aan dat doorverwezen klanten een 4x hogere kans hebben om te converteren.' },
          { type: 'text', title: 'Hoe vraag je om referrals?', body: '**Timing:** Vraag na een positief evaluatiegesprek of na een succesvolle verkoop via de leads.\n\n**De vraag:**\n"Het gaat goed met uw leads. Kent u toevallig collega-ondernemers in uw netwerk die ook meer klanten kunnen gebruiken? Ik help ze graag net zo als u."\n\n**Netwerken:**\n• Brancheverenigingen en beurzen\n• Lokale ondernemersclubs\n• Branchespecifieke netwerken\n• Leveranciers en toeleveranciers\n\n**Follow-up:**\nAls een klant een naam noemt: bel dezelfde dag nog en noem de naam van de referent. "Pieter van ZonnePro vertelde me dat u ook zonnepanelen installeert..."' },
          { type: 'tip', title: 'Referral tip', body: 'Maak referrals een vast onderdeel van elk evaluatiegesprek. Niet als "verkooptruc" maar als oprechte vraag. De meeste tevreden klanten vinden het geen probleem om een collega door te verwijzen — je moet er alleen naar vragen.' },
          { type: 'keypoints', body: '• Referrals: 4x hogere conversie dan koude acquisitie\n• Vraag na positief evaluatiegesprek of succes\n• Bel doorverwijzingen dezelfde dag nog\n• Maak het een vast onderdeel van elk evaluatiegesprek\n• Netwerk ook via brancheverenigingen en leveranciers' },
        ],
      },
    ],
    quiz: [
      { id: 'g1', question: 'Hoeveel keer goedkoper is upselling vergeleken met nieuwe klant werven?', options: ['2x goedkoper', '5-7x goedkoper', '10x goedkoper', 'Even duur'], correctIndex: 1, explanation: 'Een bestaande klant laten groeien is 5-7x goedkoper dan een nieuwe klant werven.' },
      { id: 'g2', question: 'Wanneer is het perfecte moment om te upsellen?', options: ['Direct bij de eerste bestelling', 'Bij 70-80% batchvoortgang met positieve resultaten', 'Als de klant klaagt', 'Na 1 jaar samenwerking'], correctIndex: 1, explanation: 'Bij 70-80% is het moment: de klant ziet resultaten, wil geen gat in de aanvoer, en je kunt direct upgraden.' },
      { id: 'g3', question: 'Welke branchecombinatie is het meest logisch voor cross-selling?', options: ['Zonnepanelen + Dakkapellen', 'Zonnepanelen + Thuisbatterijen', 'Airconditioning + Isolatie', 'Financial Lease + Laadpalen'], correctIndex: 1, explanation: 'Zonnepanelen + thuisbatterijen is de meest natuurlijke combinatie door de complementaire functie.' },
      { id: 'g4', question: 'Hoe veel hoger is de conversiekans bij een doorverwezen prospect?', options: ['2x hoger', '4x hoger', '10x hoger', 'Geen verschil'], correctIndex: 1, explanation: 'Doorverwezen prospects hebben een 4x hogere conversiekans door het vertrouwen dat al is opgebouwd.' },
      { id: 'g5', question: 'Wat doe je als een klant zegt te willen pauzeren met herbestellen?', options: ['Akkoord en niet meer bellen', 'Doorvragen naar de reden en alternatieven bieden', 'Extra korting aanbieden', 'Direct escaleren'], correctIndex: 1, explanation: 'Vraag altijd door naar de reden. Vaak is er een oplossing: lager volume, andere timing, of kwaliteitsverbetering.' },
    ],
  },
];

export function getTotalLessons(): number {
  return MODULES.reduce((sum, m) => sum + m.lessons.length, 0);
}

export function getModuleLessonCount(moduleId: string): number {
  return MODULES.find(m => m.id === moduleId)?.lessons.length ?? 0;
}
