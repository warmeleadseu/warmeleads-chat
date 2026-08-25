/**
 * Inhoud van het handboek.
 *
 * Dit bestand staat bewust in code en niet in de database: het is het fundament
 * dat versiebeheerd is, mee gereviewd wordt bij elke wijziging, en dat je kunt
 * terugvinden in de git-historie. Aanvullingen die het team zelf schrijft komen
 * in de database te staan (tabel handbook_notes) en verschijnen onder elk
 * onderdeel.
 *
 * Elk onderdeel heeft een vast `id`. Verander dat nooit zonder reden: notities
 * en voortgang hangen eraan vast.
 */

export type HandboekBlok =
  | { soort: 'tekst'; body: string }
  | { soort: 'stappen'; items: string[] }
  | { soort: 'lijst'; items: string[] }
  | { soort: 'let-op'; body: string }
  | { soort: 'tip'; body: string }
  | { soort: 'tabel'; kop: string[]; rijen: string[][] }
  | { soort: 'code'; body: string }
  | { soort: 'link'; href: string; label: string; extern?: boolean }
  | { soort: 'invullen'; body: string };

export type HandboekSectie = {
  id: string;
  titel: string;
  samenvatting: string;
  /** Onderdeel van de inwerkcursus, in deze volgorde. */
  cursus?: boolean;
  /** Geschatte leestijd in minuten, voor de cursusmodus. */
  minuten?: number;
  blokken: HandboekBlok[];
};

export type HandboekHoofdstuk = {
  id: string;
  titel: string;
  icoon: string;
  intro: string;
  secties: HandboekSectie[];
};

export const HANDBOEK: HandboekHoofdstuk[] = [
  /* ─────────────────────────── 1. Start ─────────────────────────── */
  {
    id: 'start',
    titel: 'Start hier',
    icoon: '🧭',
    intro: 'Wat dit handboek is, hoe je het gebruikt en wie waarvoor verantwoordelijk is.',
    secties: [
      {
        id: 'start.wat',
        titel: 'Wat dit handboek is',
        samenvatting: 'Doel, opzet en hoe je het onderhoudt.',
        cursus: true,
        minuten: 3,
        blokken: [
          {
            soort: 'tekst',
            body: 'Dit handboek beschrijft het beheer van het WarmeLeads-CRM: wat er dagelijks moet gebeuren, hoe de terugkerende taken werken, wat er vanzelf draait, en wat je doet als iets misgaat. Het is geschreven bij de overdracht per 1 september 2026.',
          },
          {
            soort: 'tekst',
            body: 'Er zijn twee manieren om het te gebruiken. Via **Cursus** loop je alles een keer door om ingewerkt te raken, met voortgang die per persoon wordt bijgehouden. Via **Naslag** zoek je iets op als je het nodig hebt. Dezelfde inhoud, twee ingangen.',
          },
          {
            soort: 'tekst',
            body: 'Onder elk onderdeel staat een blok **Eigen aantekeningen**. Wat je daar schrijft wordt bewaard en is voor iedereen met toegang zichtbaar. Gebruik dat om afspraken vast te leggen, uitzonderingen te noteren en dingen te corrigeren die veranderd zijn. Het vaste deel verandert alleen mee met het systeem zelf.',
          },
          {
            soort: 'let-op',
            body: 'Onderdelen met een geel **In te vullen**-blok bevatten kennis die niet uit het systeem af te leiden was. Vul die aan zolang de kennis er nog is.',
          },
        ],
      },
      {
        id: 'start.rollen',
        titel: 'Wie doet wat',
        samenvatting: 'Rollen in het systeem en de verdeling van taken na de overdracht.',
        cursus: true,
        minuten: 4,
        blokken: [
          {
            soort: 'tekst',
            body: 'Het CRM kent drie rollen. Ze bepalen welke menu-items je ziet en wat je mag.',
          },
          {
            soort: 'tabel',
            kop: ['Rol', 'Ziet', 'Typisch'],
            rijen: [
              ['superadmin', 'Alles, inclusief Verdeling, Koppelingen, Gebruikers, Facturen en dit handboek', 'De beheerders van het systeem'],
              ['admin', 'Het meeste, maar niet Verdeling, Koppelingen, AI-campagnes, Gebruikers en het activiteitenlog', 'Vaste medewerkers'],
              ['accountmanager', 'Alleen eigen klanten en leads, plus E-learning', 'Verkoop'],
            ],
          },
          {
            soort: 'tekst',
            body: 'Daarnaast bestaat de losse vlag **is_account_manager**. Die staat los van de rol en bepaalt of iemand meetelt op het podium, de race en de AM-targets. Iemand kan dus rol `admin` hebben en tóch accountmanager zijn.',
          },
          {
            soort: 'invullen',
            body: 'Vul hier in wie na de overdracht welke rol krijgt, wie eerste aanspreekpunt is bij storingen, en wie de externe diensten beheert (Meta, Mollie, Vercel, Supabase).',
          },
        ],
      },
    ],
  },

  /* ─────────────────────────── 2. Systeem ─────────────────────────── */
  {
    id: 'systeem',
    titel: 'Het systeem in vogelvlucht',
    icoon: '🏗️',
    intro: 'Waar draait wat, en welke begrippen je moet kennen voordat de rest logisch wordt.',
    secties: [
      {
        id: 'systeem.landschap',
        titel: 'Waar draait wat',
        samenvatting: 'De onderdelen en hoe ze samenhangen.',
        cursus: true,
        minuten: 5,
        blokken: [
          {
            soort: 'tabel',
            kop: ['Onderdeel', 'Wat het is', 'Waar'],
            rijen: [
              ['De applicatie', 'Next.js 14, publieke site plus admin plus klantportaal', 'Vercel, project warmeleads-chat'],
              ['De database', 'Supabase (Postgres), alle leads, klanten, batches en facturen', 'Supabase, project Warmeleads.eu'],
              ['De code', 'Eén repository', 'GitHub, warmeleadseu/warmeleads-chat'],
              ['Advertenties', 'Meta-campagnes leveren leads via webhook en synchronisatie', 'Meta Business'],
              ['Betalingen', 'Batchbetalingen door klanten', 'Mollie'],
              ['E-mail', 'Transactionele mail en klantcommunicatie', 'Resend en Gmail SMTP'],
            ],
          },
          {
            soort: 'tekst',
            body: 'Alles wat je in de admin doet, praat via API-routes met de database. Er is geen aparte backend en geen tweede omgeving: **wat je in de admin wijzigt, is meteen live.**',
          },
          {
            soort: 'let-op',
            body: 'Er is geen aparte testomgeving. Wil je iets uitproberen, doe dat op een klant of batch die je zelf hebt aangemaakt, niet op een echte.',
          },
        ],
      },
      {
        id: 'systeem.begrippen',
        titel: 'Begrippen die je moet kennen',
        samenvatting: 'Batches, toewijzingen en de tabellen die op elkaar lijken maar dat niet zijn.',
        cursus: true,
        minuten: 6,
        blokken: [
          {
            soort: 'tekst',
            body: 'Een paar begrippen lijken op elkaar en worden makkelijk verward. Deze kosten de meeste tijd als je ze door elkaar haalt.',
          },
          {
            soort: 'tabel',
            kop: ['Begrip', 'Wat het echt is'],
            rijen: [
              ['customer_batches', 'De werkelijke leveringsbatch. Hier kijkt de verdeling naar. Status moet `active` zijn en `is_paid` mag niet false zijn.'],
              ['batch_orders', 'De bestelling en betaling. Een administratief spoor, géén leveringsbatch.'],
              ['lead_assignments', 'Wat het klantportaal toont. Eén rij per lead per klant.'],
              ['leads.assigned_customer_ids', 'Het spoor op de lead zelf. Kan gevuld zijn terwijl het portaal niets toont.'],
            ],
          },
          {
            soort: 'let-op',
            body: 'Als een klant zegt dat hij leads mist: kijk in **lead_assignments**, niet in de lead zelf. Het portaal leest alleen die tabel. Staat de klant bovendien in `demo_mode`, dan toont het portaal uitsluitend demo-leads en verbergt het alle echte.',
          },
          {
            soort: 'tekst',
            body: 'Een lead komt bij een klant terecht als er een actieve, betaalde batch is voor de juiste branche, de klant die branche in zijn profiel heeft staan, en de lead binnen het ingestelde gebied valt. Ontbreekt één van die drie, dan gebeurt er niets en krijg je geen melding.',
          },
        ],
      },
    ],
  },

  /* ─────────────────────────── 3. Ritme ─────────────────────────── */
  {
    id: 'ritme',
    titel: 'Werkritme',
    icoon: '🗓️',
    intro: 'Wat je dagelijks, wekelijks en maandelijks doet. Afgeleid uit wat er in het activiteitenlog daadwerkelijk gebeurt.',
    secties: [
      {
        id: 'ritme.dag',
        titel: 'Elke werkdag',
        samenvatting: 'Korte ronde langs de dingen die stil kunnen falen.',
        cursus: true,
        minuten: 4,
        blokken: [
          {
            soort: 'stappen',
            items: [
              'Open **Live** en kijk of de cijfers vers zijn. Staat er "Cijfers niet vers", dan haalt het dashboard geen data op en klopt de rest van je ochtend niet.',
              'Open **Levering batches** en kijk of batches doorlopen. Een batch die dagen op hetzelfde aantal blijft staan, levert niet.',
              'Open **Reclamaties** en handel openstaande af.',
              'Open **Mijn taken** voor je eigen prospect-taken.',
              'Controleer **Bestellingen** op nieuwe batchbetalingen die klaarstaan.',
            ],
          },
          {
            soort: 'tip',
            body: 'Een batch die niet doorloopt heeft bijna altijd één van drie oorzaken: geen leads in het gebied van de klant, de campagne levert buiten dat gebied, of de batch staat op `paused`. Zie het runbook over batches.',
          },
        ],
      },
      {
        id: 'ritme.week',
        titel: 'Elke week',
        samenvatting: 'Wekelijkse controles en het maandagrapport.',
        cursus: true,
        minuten: 3,
        blokken: [
          {
            soort: 'stappen',
            items: [
              'Maandag 8:00 draait het weekrapport automatisch. Lees het en controleer of de cijfers kloppen met wat je zelf ziet.',
              'Loop **Verdeling** na: liggen er leads die nergens landen? Dat is voorraad waar je wel voor betaalt.',
              'Controleer of er klanten zijn met een batch die bijna vol is, zodat je tijdig een vervolgbestelling kunt bespreken.',
              'Kijk in **Koppelingen** of er integraties zijn met fouten.',
            ],
          },
        ],
      },
      {
        id: 'ritme.maand',
        titel: 'Elke maand',
        samenvatting: 'Facturatie, targets en opruimen.',
        cursus: true,
        minuten: 3,
        blokken: [
          {
            soort: 'stappen',
            items: [
              'Loop **Facturen** na op openstaande posten.',
              'Controleer **AM Targets** en pas ze aan voor de nieuwe periode.',
              'Kijk of er klanten inactief zijn geworden en of hun batches en portaaltoegang nog kloppen.',
              'Controleer de advertentiekosten tegenover de opbrengst per branche op het dashboard.',
            ],
          },
        ],
      },
    ],
  },

  /* ─────────────────────────── 4. Runbooks ─────────────────────────── */
  {
    id: 'runbooks',
    titel: 'Taken stap voor stap',
    icoon: '📋',
    intro: 'De terugkerende handelingen, op volgorde van hoe vaak ze in de praktijk voorkomen.',
    secties: [
      {
        id: 'runbook.import',
        titel: 'Leads importeren uit een spreadsheet',
        samenvatting: 'Veruit de meest uitgevoerde beheertaak. Inclusief terugdraaien.',
        cursus: true,
        minuten: 7,
        blokken: [
          {
            soort: 'tekst',
            body: 'Dit is met afstand de meest uitgevoerde taak in het beheer. Ga naar **Importeren** in het menu.',
          },
          {
            soort: 'stappen',
            items: [
              'Controleer eerst je bestand: één rij per lead, kolomnamen op de eerste rij, en een branche die in het systeem bestaat.',
              'Kies de juiste branche. Een lead met een onbekende of niet-actieve branche wordt geweigerd.',
              'Loop de kolomkoppeling na. Dit is de plek waar het vaakst iets misgaat: een verkeerd gekoppelde kolom zet bijvoorbeeld een e-mailadres in een veld waar dat niet hoort.',
              'Draai eerst een kleine proef, bijvoorbeeld tien regels, voordat je duizenden rijen importeert.',
              'Controleer na de import in **Leads CRM** of de eerste regels er goed uitzien.',
            ],
          },
          {
            soort: 'let-op',
            body: 'Een verkeerde import is terug te draaien via de undo-functie op het importoverzicht. Doe dat zo snel mogelijk: hoe langer je wacht, hoe groter de kans dat er al leads uit die import zijn verdeeld naar klanten.',
          },
          {
            soort: 'tip',
            body: 'In augustus 2026 bleek dat twaalf klantrecords een e-mailadres in het btw-nummerveld hadden staan. Dat kwam vrijwel zeker door een verkeerd gekoppelde kolom bij een import. Controleer die koppeling dus echt, ook als het bestand er bekend uitziet.',
          },
        ],
      },
      {
        id: 'runbook.impersonatie',
        titel: 'Inloggen als klant om iets te controleren',
        samenvatting: 'Support geven door zelf in het portaal van de klant te kijken.',
        cursus: true,
        minuten: 3,
        blokken: [
          {
            soort: 'tekst',
            body: 'Als een klant zegt dat iets niet werkt, kijk je mee in zijn eigen portaal in plaats van te gissen. Ga naar **Klanten**, zoek de klant en klik op het oog-icoon.',
          },
          {
            soort: 'stappen',
            items: [
              'Klik op het oog-icoon bij de klant om als die klant in te loggen.',
              'Kijk in het portaal wat de klant ziet: leads, batches, facturen.',
              'Log daarna terug uit naar je eigen account.',
            ],
          },
          {
            soort: 'let-op',
            body: 'Alles wat je in die sessie doet, staat in het activiteitenlog op naam van jou met de vermelding impersonatie. Wijzig dus niets namens de klant zonder dat af te spreken.',
          },
        ],
      },
      {
        id: 'runbook.toewijzen',
        titel: 'Leads handmatig toewijzen of opnieuw toewijzen',
        samenvatting: 'Bulk toewijzen, guardrails en wanneer je ze mag negeren.',
        cursus: true,
        minuten: 6,
        blokken: [
          {
            soort: 'tekst',
            body: 'Ga naar **Leads CRM**, filter op wat je zoekt, selecteer de leads en kies bulk toewijzen aan een klant.',
          },
          {
            soort: 'tekst',
            body: 'Het systeem controleert drie dingen voordat het toewijst. Dit heten de guardrails:',
          },
          {
            soort: 'lijst',
            items: [
              'Branche: hoort de branche van de lead bij die klant?',
              'Gebied: valt de lead binnen het ingestelde werkgebied van de klant?',
              'Recent: is deze lead kort geleden al aan iemand toegewezen?',
            ],
          },
          {
            soort: 'tekst',
            body: 'Wordt er iets geblokkeerd, dan krijg je te zien hoeveel en waarom. Met het vinkje **Guardrails negeren** wijs je toch toe. Doe dat bewust: je omzeilt dan de afspraak met de klant over zijn werkgebied.',
          },
          {
            soort: 'tip',
            body: 'Toegewezen leads landen automatisch op de juiste actieve batch van die klant, verschijnen in zijn portaal, en gaan door naar zijn eigen CRM als er een koppeling actief is.',
          },
        ],
      },
      {
        id: 'runbook.klant',
        titel: 'Klant aanmaken en beheren',
        samenvatting: 'Nieuwe klant, branches, werkgebied en portaaltoegang.',
        cursus: true,
        minuten: 5,
        blokken: [
          {
            soort: 'stappen',
            items: [
              'Ga naar **Klanten** en maak een nieuwe klant aan. Bedrijfsnaam, contactpersoon, e-mail en minimaal één branche zijn verplicht.',
              'Stel een portaalwachtwoord in, zodat de klant kan inloggen.',
              'Stel het werkgebied in via targets: provincies, of een plaats met een straal eromheen.',
              'Koppel een accountmanager, zodat de klant in zijn overzicht en targets meetelt.',
            ],
          },
          {
            soort: 'let-op',
            body: 'Het werkgebied bepaalt welke leads de klant kan krijgen. Een klant met alleen Utrecht en Zuid-Holland krijgt niets uit Noord-Holland, ook niet als zijn eigen campagne daar leads oplevert. Stem het werkgebied en de campagne dus op elkaar af.',
          },
          {
            soort: 'tip',
            body: 'Partner-branches, herkenbaar aan het achtervoegsel `_partners`, kunnen niet aan een gewone klant gekoppeld worden. Die horen bij de prospects-pijplijn.',
          },
        ],
      },
      {
        id: 'runbook.batch',
        titel: 'Batches beheren',
        samenvatting: 'Aanmaken, pauzeren, vergroten en waarom een batch niet doorloopt.',
        cursus: true,
        minuten: 6,
        blokken: [
          {
            soort: 'tekst',
            body: 'Een batch is de afspraak dat een klant een bepaald aantal leads in een branche afneemt. Je beheert ze via **Batches** en volgt de levering via **Levering batches**.',
          },
          {
            soort: 'tekst',
            body: 'Een batch levert alleen als aan al deze voorwaarden is voldaan:',
          },
          {
            soort: 'lijst',
            items: [
              'Status is `active`, niet `paused` en niet afgerond.',
              'De batch is betaald, of in elk geval niet gemarkeerd als onbetaald.',
              'De klant is actief en heeft de branche in zijn profiel.',
              'Er komen leads binnen die in het werkgebied van de klant vallen.',
            ],
          },
          {
            soort: 'let-op',
            body: 'Een batch kan aan een specifieke Meta-campagne gekoppeld zijn. Dan tellen alleen leads uit díe campagne mee. Draait die campagne landelijk terwijl de klant een klein werkgebied heeft, dan vult de batch traag en blijft de rest onbedeeld liggen.',
          },
          {
            soort: 'tekst',
            body: 'Het aantal geleverde leads wordt automatisch opnieuw berekend als je de batch opslaat. Wijk je bewust af van de afgesproken omvang, pas dan ook het aantal aan zodat de administratie klopt met de werkelijkheid.',
          },
        ],
      },
      {
        id: 'runbook.export',
        titel: 'Leads exporteren',
        samenvatting: 'Export naar bestand, en de valkuil van de duizend rijen.',
        blokken: [
          {
            soort: 'tekst',
            body: 'Exporteren doe je vanuit **Leads CRM** met de filters die je nodig hebt, of via de exportfunctie op een klant.',
          },
          {
            soort: 'let-op',
            body: 'Haal je zelf gegevens op buiten de interface om, bijvoorbeeld via de database of via Claude, dan geeft Supabase standaard maximaal duizend rijen terug. Zonder paginering krijg je dus stilzwijgend een onvolledige export. Er komt geen foutmelding.',
          },
        ],
      },
      {
        id: 'runbook.koppeling',
        titel: 'Een koppeling met het CRM van een klant',
        samenvatting: 'Webhook instellen zodat leads doorstromen naar hun eigen systeem.',
        blokken: [
          {
            soort: 'tekst',
            body: 'Klanten kunnen hun leads automatisch in hun eigen CRM krijgen. Dat stel je in het klantportaal in, onder Account, of je logt als klant in via het oog-icoon.',
          },
          {
            soort: 'stappen',
            items: [
              'Zorg eerst dat de branche bij de klant staat: het scherm biedt alleen branches aan die op de klant staan.',
              'Vul de webhook-URL van de klant in.',
              'Vink de branches aan die doorgestuurd moeten worden. Een lege lijst betekent alles.',
              'Zet de koppeling **aan**. Dit is de stap die het vaakst wordt vergeten.',
              'Test en controleer daarna bij een echte lead of hij is aangekomen.',
            ],
          },
          {
            soort: 'let-op',
            body: 'De testknop controleert alleen of de URL bereikbaar is, niet of de koppeling aanstaat. Een geslaagde test betekent dus niet dat er leads worden verstuurd. Controleer altijd of de schakelaar echt aan staat.',
          },
        ],
      },
    ],
  },

  /* ─────────────────────────── 5. Automatisch ─────────────────────────── */
  {
    id: 'automatisch',
    titel: 'Wat er vanzelf draait',
    icoon: '⚙️',
    intro: 'Tien geplande taken houden het systeem draaiend. Weten wat ze doen helpt je begrijpen wat er misgaat als ze uitvallen.',
    secties: [
      {
        id: 'auto.overzicht',
        titel: 'De geplande taken',
        samenvatting: 'Wat draait er wanneer, en wat merk je als het uitvalt.',
        cursus: true,
        minuten: 5,
        blokken: [
          {
            soort: 'tabel',
            kop: ['Taak', 'Wanneer', 'Wat je merkt als het uitvalt'],
            rijen: [
              ['Verdeling van leads', 'Elk kwartier', 'Leads blijven onbedeeld liggen, batches lopen niet door'],
              ['Meta batch-campagne sync', 'Elk kwartier', 'Batches krijgen geen leads uit hun gekoppelde campagne'],
              ['Meta sync', '7:00, 10:00, 13:00 en 14:00', 'Advertentiekosten en campagnedata lopen achter'],
              ['Leveringsgezondheid', 'Elk uur op :25', 'Problemen met levering worden niet gesignaleerd'],
              ['Afspraakherinneringen', 'Elk uur', 'Klanten krijgen geen herinnering voor hun afspraak'],
              ['AI-campagne optimalisatie', 'Elke twee uur', 'Campagnes worden niet automatisch bijgestuurd'],
              ['Koppelingen opnieuw proberen', 'Elke twee uur', 'Mislukte doorzendingen blijven mislukt'],
              ['Batchherinneringen', 'Dagelijks 9:00', 'Klanten met een bijna volle batch worden niet gewezen op bijbestellen'],
              ['Feedback-overzicht', 'Dagelijks 7:00', 'Geen dagelijks overzicht van klantfeedback'],
              ['Weekrapport', 'Maandag 8:00', 'Geen wekelijkse cijfers'],
            ],
          },
          {
            soort: 'tekst',
            body: 'Deze taken draaien op Vercel. Vermoed je dat er iets niet loopt, kijk dan in het Vercel-dashboard bij de logs van het project.',
          },
          {
            soort: 'let-op',
            body: 'De belangrijkste is de verdeling elk kwartier. Landen er uren geen nieuwe leads bij klanten terwijl er wel leads binnenkomen, kijk daar dan als eerste.',
          },
        ],
      },
    ],
  },

  /* ─────────────────────────── 6. Storingen ─────────────────────────── */
  {
    id: 'storingen',
    titel: 'Als er iets misgaat',
    icoon: '🔧',
    intro: 'Symptoom, waarschijnlijke oorzaak en wat je doet. Deze gevallen zijn allemaal echt voorgekomen.',
    secties: [
      {
        id: 'storing.geen-leads',
        titel: 'Klant zegt dat hij geen leads krijgt',
        samenvatting: 'De meest gemelde klacht, met een vaste volgorde om te controleren.',
        cursus: true,
        minuten: 5,
        blokken: [
          {
            soort: 'stappen',
            items: [
              'Heeft de klant een batch met status `active` voor die branche? Kijk bij **Levering batches**. Een batch op `paused` levert niets.',
              'Staat de branche in het profiel van de klant? Zonder dat komt er niets binnen, ook niet met een actieve batch.',
              'Klopt het werkgebied? Vergelijk de provincies van de klant met de plek waar de leads vandaan komen.',
              'Is de batch aan een Meta-campagne gekoppeld? Dan tellen alleen leads uit die campagne mee.',
              'Staat de klant in demo-modus? Dan toont zijn portaal alleen demo-leads en verbergt het de echte.',
              'Zijn er überhaupt leads in die branche en dat gebied? Kijk in **Leads CRM** met het filter op niet toegewezen.',
            ],
          },
          {
            soort: 'tip',
            body: 'In augustus 2026 leek een klant geen warmtepomp-leads te krijgen. Er waren er wel degelijk zeven geleverd. Zijn campagne draaide landelijk terwijl hij alleen Utrecht en Zuid-Holland afnam, waardoor driekwart van de leads buiten zijn gebied viel en bij niemand terechtkwam.',
          },
        ],
      },
      {
        id: 'storing.bewerken',
        titel: 'Een klant of record laat zich niet opslaan',
        samenvatting: 'Wat je doet bij een foutmelding tijdens het bewerken.',
        blokken: [
          {
            soort: 'tekst',
            body: 'Het bewerkformulier stuurt bij elke opslag alle velden mee. Als een veld dat je niet hebt aangeraakt ongeldige gegevens bevat, kan dat de hele opslag blokkeren.',
          },
          {
            soort: 'tekst',
            body: 'Sinds augustus 2026 controleert het systeem alleen nog de velden die je daadwerkelijk wijzigt, dus dit hoort niet meer voor te komen. Gebeurt het toch, dan staat de oorzaak nu in de foutmelding zelf en in de logs op Vercel.',
          },
          {
            soort: 'let-op',
            body: 'Er staan nog klantrecords met een e-mailadres in het btw-nummerveld. Die zijn wel te bewerken, maar dat veld gaat naar de factuur. Corrigeer het wanneer je zo\'n klant tegenkomt.',
          },
        ],
      },
      {
        id: 'storing.webhook',
        titel: 'Leads komen niet aan in het CRM van de klant',
        samenvatting: 'De koppeling lijkt te werken maar verstuurt niets.',
        blokken: [
          {
            soort: 'stappen',
            items: [
              'Controleer of de koppeling **aan** staat. Een ingevulde URL is niet genoeg.',
              'Controleer of de branche van de lead in de branchelijst van de koppeling staat.',
              'Controleer of de klant de branche in zijn profiel heeft, anders wordt de lead niet eens toegewezen.',
              'Kijk of er recent iets is verstuurd. Staat er niets, dan is er nooit een lead langsgekomen die aan alle voorwaarden voldeed.',
            ],
          },
        ],
      },
      {
        id: 'storing.dashboard',
        titel: 'Het live dashboard klopt niet',
        samenvatting: 'Bevroren cijfers of een leeg scherm.',
        blokken: [
          {
            soort: 'tekst',
            body: 'Het dashboard ververst zichzelf elke anderhalve minuut. Lukt dat niet, dan staat er linksboven **Cijfers niet vers** met hoe oud de gegevens zijn. Zie je dat, dan haalt het scherm geen data op en kun je de cijfers niet vertrouwen.',
          },
          {
            soort: 'tekst',
            body: 'Ververs de pagina. Blijft het staan, kijk dan of de site zelf bereikbaar is en of er een storing is bij Vercel of Supabase.',
          },
        ],
      },
    ],
  },

  /* ─────────────────────────── 7. Claude ─────────────────────────── */
  {
    id: 'claude',
    titel: 'Het CRM aanpassen via Claude',
    icoon: '🤖',
    intro: 'Hoe je met Claude in VS Code wijzigingen aan het systeem laat maken zonder dat het misgaat.',
    secties: [
      {
        id: 'claude.wat',
        titel: 'Wat dit is en wat het niet is',
        samenvatting: 'Verwachtingen, en waar de grens ligt.',
        cursus: true,
        minuten: 4,
        blokken: [
          {
            soort: 'tekst',
            body: 'Claude Code is een assistent die in VS Code naast de code draait. Hij kan de codebase lezen, wijzigingen maken, tests draaien en die wijzigingen naar productie brengen. Het CRM is grotendeels op die manier gebouwd en onderhouden.',
          },
          {
            soort: 'tekst',
            body: 'Wat hij goed kan: uitzoeken waarom iets misgaat, een fout herstellen, een scherm aanpassen, een export maken, gegevens analyseren. Wat hij niet kan: weten wat jullie zakelijk willen. Jij bepaalt wát er moet gebeuren, hij doet het hoe.',
          },
          {
            soort: 'let-op',
            body: 'Hij werkt op het echte systeem. Een wijziging aan de database of aan de productiebranch is meteen live. Behandel het als een collega met beheerrechten: geef duidelijke opdrachten en laat je resultaat zien voordat je akkoord geeft.',
          },
        ],
      },
      {
        id: 'claude.toegang',
        titel: 'Toegang en accounts',
        samenvatting: 'De drie accountsets, en de valkuil die veel tijd kost.',
        cursus: true,
        minuten: 6,
        blokken: [
          {
            soort: 'tekst',
            body: 'Om te kunnen werken heeft Claude toegang nodig tot drie diensten. Deze staan los van elkaar en gebruiken verschillende accounts. Dat is de grootste valkuil.',
          },
          {
            soort: 'tabel',
            kop: ['Dienst', 'Wat', 'Inloggen'],
            rijen: [
              ['GitHub', 'De code, repository warmeleadseu/warmeleads-chat', '`gh auth login`'],
              ['Vercel', 'Hosting en logs, project warmeleads-chat', '`vercel login`, kies het juiste account'],
              ['Supabase', 'De database, project Warmeleads.eu', '`supabase login`'],
            ],
          },
          {
            soort: 'let-op',
            body: 'Er bestaan meerdere Supabase-projecten met een vergelijkbare naam, waaronder een oud gepauzeerd project. Herken het juiste project aan de referentie **qwfkcpwxoymhpfdthpqv**, niet aan de naam. Een verkeerd project betekent dat je naar lege of verouderde gegevens kijkt.',
          },
          {
            soort: 'tekst',
            body: 'De Supabase CLI weigert in te loggen zonder echte terminal. Claude kent daar een werkwijze voor met een pseudo-terminal; vraag er gewoon om als het nodig is.',
          },
          {
            soort: 'invullen',
            body: 'Noteer hier waar de wachtwoorden en tokens bewaard worden, en wie toegang heeft tot dat kluisje. Zet hier geen wachtwoorden zelf neer.',
          },
        ],
      },
      {
        id: 'claude.werkwijze',
        titel: 'Zo geef je een goede opdracht',
        samenvatting: 'De werkwijze die betrouwbaar resultaat geeft.',
        cursus: true,
        minuten: 7,
        blokken: [
          {
            soort: 'tekst',
            body: 'De kwaliteit van het resultaat hangt vooral af van hoe je de opdracht geeft. Deze volgorde werkt.',
          },
          {
            soort: 'stappen',
            items: [
              'Beschrijf het **probleem**, niet de oplossing. "Klant X kan zijn e-mailadres niet opslaan" levert beter resultaat dan "pas veld Y aan".',
              'Vraag eerst om **uitzoeken**, niet om bouwen. "Zoek grondig uit waarom dit gebeurt" voorkomt dat er iets wordt gerepareerd dat niet kapot was.',
              'Vraag om een **voorstel** voordat er gebouwd wordt, zeker bij grotere wijzigingen.',
              'Eis dat het op een **aparte branch** met een pull request gebeurt, nooit rechtstreeks op main.',
              'Eis **bewijs**: typecheck zonder fouten, alle tests groen, en een schone productiebuild. Laat die uitkomsten zien.',
              'Vraag expliciet wat er **niet** is gedaan en waarom. Dat is vaak informatiever dan wat er wel is gedaan.',
            ],
          },
          {
            soort: 'tip',
            body: 'Gaat het om iets visueels, vraag dan om een screenshot van het echte scherm. Een redenering over hoe iets eruitziet is geen vervanging voor kijken.',
          },
        ],
      },
      {
        id: 'claude.voorbeelden',
        titel: 'Voorbeeldopdrachten',
        samenvatting: 'Kant-en-klare formuleringen voor veelvoorkomende vragen.',
        blokken: [
          {
            soort: 'tekst',
            body: 'Neem deze over en pas ze aan. Ze bevatten allemaal de elementen die tot goed resultaat leiden.',
          },
          {
            soort: 'code',
            body: 'Klant [naam] meldt dat hij geen leads krijgt in branche [branche].\nZoek grondig uit waar het misgaat: batch, branche, werkgebied,\ncampagnekoppeling of portaalweergave. Onderbouw met de echte data\nuit de database. Fix nog niets, leg eerst uit wat je vindt.',
          },
          {
            soort: 'code',
            body: 'Er zit een fout in [scherm]: [beschrijf wat je ziet en wat je verwacht].\nZoek de oorzaak, fix het duurzaam, en zet er een regressietest op.\nWerk op een aparte branch met een pull request. Laat typecheck,\ntests en build zien voordat je pusht.',
          },
          {
            soort: 'code',
            body: 'Maak een export van [wat] met [welke kolommen], per [branche of klant]\nin een apart tabblad. Let op de limiet van duizend rijen bij Supabase:\nhaal alles op met paginering en controleer achteraf dat het totaal klopt.',
          },
          {
            soort: 'code',
            body: 'Ik wil [functionaliteit] toevoegen aan het CRM.\nDenk hier eerst goed over na en stel me scherpe vragen zodat je\nprecies weet wat ik wil. Bouw daarna pas, op een aparte branch.',
          },
        ],
      },
      {
        id: 'claude.grenzen',
        titel: 'Wat je nooit moet doen',
        samenvatting: 'De handelingen die echt schade kunnen aanrichten.',
        cursus: true,
        minuten: 4,
        blokken: [
          {
            soort: 'lijst',
            items: [
              'Nooit rechtstreeks op de main-branch laten werken zonder de wijziging te bekijken. Main gaat direct naar productie.',
              'Nooit een grote wijziging accepteren zonder dat typecheck, tests en build zijn gedraaid en getoond.',
              'Nooit wachtwoorden in de chat plakken. Kan het niet anders, verander het wachtwoord daarna.',
              'Nooit massaal gegevens laten wijzigen of verwijderen zonder eerst een uitdraai van de huidige situatie te vragen.',
              'Nooit guardrails laten omzeilen zonder te begrijpen welke afspraak je daarmee doorbreekt.',
            ],
          },
          {
            soort: 'tekst',
            body: 'Ging er toch iets mis, dan is bijna alles terug te draaien via de git-historie. Vraag om de wijziging terug te draaien en te vertellen wat de gevolgen daarvan zijn.',
          },
        ],
      },
    ],
  },

  /* ─────────────────────────── 8. Toegang ─────────────────────────── */
  {
    id: 'toegang',
    titel: 'Externe diensten',
    icoon: '🔑',
    intro: 'Welke diensten het systeem gebruikt. Vul aan wie de eigenaar is en waar de toegang bewaard wordt.',
    secties: [
      {
        id: 'toegang.diensten',
        titel: 'Diensten waar het systeem van afhangt',
        samenvatting: 'Inventarisatie van alle externe koppelingen.',
        blokken: [
          {
            soort: 'tabel',
            kop: ['Dienst', 'Waarvoor', 'Zonder dit werkt niet'],
            rijen: [
              ['Vercel', 'Hosting, geplande taken, logs', 'De hele site'],
              ['Supabase', 'Database en opslag', 'Alles'],
              ['GitHub', 'De code', 'Nieuwe wijzigingen uitrollen'],
              ['Meta', 'Advertenties en aanlevering van leads', 'Nieuwe leads uit campagnes'],
              ['Mollie', 'Batchbetalingen door klanten', 'Klanten kunnen niet betalen'],
              ['Resend', 'Transactionele e-mail', 'Bevestigingen en meldingen'],
              ['Gmail SMTP', 'Afspraakbevestigingen', 'Afspraakmail'],
              ['Twilio', 'Berichten', 'Sms en WhatsApp'],
              ['OpenAI', 'AI-campagnes en gegenereerde inhoud', 'AI-functies'],
              ['Google Sheets', 'Koppeling voor klanten die dat gebruiken', 'Die specifieke koppeling'],
            ],
          },
          {
            soort: 'let-op',
            body: 'De sleutels van deze diensten staan als omgevingsvariabelen bij het project op Vercel. Zet ze nooit in de code en nooit in dit handboek.',
          },
          {
            soort: 'invullen',
            body: 'Vul per dienst in: op wiens naam staat het account, wie betaalt, en waar de inloggegevens bewaard worden. Dit is het belangrijkste dat je moet vastleggen voordat je vertrekt.',
          },
        ],
      },
    ],
  },

  /* ─────────────────────────── 9. Openstaand ─────────────────────────── */
  {
    id: 'openstaand',
    titel: 'Openstaande punten',
    icoon: '📌',
    intro: 'Bekende zaken die bij de overdracht nog niet zijn opgelost. Werk deze lijst bij zodra iets is afgehandeld.',
    secties: [
      {
        id: 'open.punten',
        titel: 'Bekend bij de overdracht',
        samenvatting: 'Wat er nog ligt, met de reden waarom het niet is opgelost.',
        blokken: [
          {
            soort: 'tabel',
            kop: ['Punt', 'Waarom het blijft liggen'],
            rijen: [
              ['Twaalf klanten met een e-mailadres in het btw-nummerveld', 'Waarschijnlijk een verkeerd gekoppelde kolom bij een import. Het veld gaat naar de factuur, dus corrigeren is verstandig.'],
              ['Zes klanten met een partner-branche gekoppeld', 'Volgens de eigen regel kan dat niet. Opschonen kan hun leadverdeling veranderen, dus dat is een keuze.'],
              ['Zestig onbedeelde warmtepomp-leads', 'Er is geen afnemer voor. Deels omdat campagnes buiten het werkgebied van de klant draaien.'],
              ['Campagnes draaien breder dan het werkgebied van de klant', 'Je betaalt voor leads die niemand kan afnemen. Beperk de targeting of verruim het werkgebied.'],
              ['Een gepauzeerd oud Supabase-project', 'Nog te herstellen tot 2 januari 2027, daarna alleen te downloaden. Beslis of je de historie wilt bewaren.'],
            ],
          },
          {
            soort: 'invullen',
            body: 'Voeg hier punten toe die tijdens de overdracht naar boven komen, en streep af wat is opgelost.',
          },
        ],
      },
    ],
  },
];

/** Alle secties plat, in leesvolgorde. Handig voor zoeken en navigatie. */
export const ALLE_SECTIES = HANDBOEK.flatMap(h =>
  h.secties.map(s => ({ ...s, hoofdstukId: h.id, hoofdstukTitel: h.titel, icoon: h.icoon })),
);

/** De cursus: alleen de secties die als inwerktraject bedoeld zijn. */
export const CURSUS_SECTIES = ALLE_SECTIES.filter(s => s.cursus);

export const CURSUS_MINUTEN = CURSUS_SECTIES.reduce((n, s) => n + (s.minuten ?? 3), 0);
