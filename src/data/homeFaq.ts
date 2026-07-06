/**
 * Één bron van waarheid voor de veelgestelde vragen op de homepage.
 * Zowel de zichtbare FAQ-sectie als de FAQPage-structured-data gebruiken deze
 * lijst, zodat de gestructureerde data altijd overeenkomt met wat de bezoeker
 * ziet (Google vereist dat FAQ-markup de zichtbare content weerspiegelt).
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const HOME_FAQ: FaqItem[] = [
  {
    q: 'Zijn de leads exclusief of gedeeld?',
    a: 'Primair werken we met exclusieve leads. Elke aanvraag is enkel voor jou, in jouw regio. Zodra je een batch afneemt starten wij campagnes specifiek voor jouw targetgebied. Indien gewenst bespreken we een gedeeld model voor schaal en kostprijs.',
  },
  {
    q: 'Hoe snel kunnen we live?',
    a: 'In de meeste gevallen binnen 24 tot 72 uur na intake, afhankelijk van niche en regio. We starten zodra de campagnes staan. Geen wekenlange aanlooptijd.',
  },
  {
    q: 'Hoe werkt het klantportaal?',
    a: 'Je krijgt toegang tot een modern portaal op warmeleads.eu/portal. Hier zie je al je leads realtime binnenkomen met alle details. Je kunt leads direct bellen, WhatsAppen of mailen. Het portaal is installeerbaar als app op je telefoon, inclusief pushnotificaties bij elke nieuwe lead.',
  },
  {
    q: 'Hoe worden leads gekwalificeerd?',
    a: 'Elke lead doorloopt automatisch meerdere quality checks aan onze achterkant. Contactgegevens worden geverifieerd, interesse en geschiktheid worden gecontroleerd. Alleen leads die aan al jouw specifieke eisen voldoen komen in je portaal terecht.',
  },
  {
    q: 'Krijg ik een vast aanspreekpunt?',
    a: 'Ja. Elke klant krijgt een persoonlijke accountmanager die jouw business kent, meedenkt over strategie en altijd bereikbaar is. Niet alleen telefonisch, onze accountmanagers komen ook bij je langs op locatie.',
  },
  {
    q: 'Wat als jullie nog niet in mijn branche actief zijn?',
    a: 'Geen probleem. Voor €1.000 onderzoekskosten ontdekken we de beste strategie en tarieven voor jouw branche. Dit bedrag krijg je volledig terug in leads, dus het kost je uiteindelijk niets extra.',
  },
  {
    q: 'Kunnen jullie koppelen met ons CRM?',
    a: 'Ja. We ondersteunen directe koppelingen via webhooks, API of handmatige exports zodat je salesflow direct doorloopt zonder extra administratie.',
  },
  {
    q: 'Wat is een realistisch startvolume?',
    a: 'Dat hangt af van jouw niche en postcodegebied. Tijdens het strategiegesprek krijg je een concreet startschema met verwacht volume en kostprijs.',
  },
  {
    q: 'Zit ik vast aan een contract?',
    a: 'Nee. We werken zonder lock-in. Je kunt maandelijks opschalen, afschalen of stoppen. Ons verdienmodel is gebaseerd op resultaat, niet op binding.',
  },
];
