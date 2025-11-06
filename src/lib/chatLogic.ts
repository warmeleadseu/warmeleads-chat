interface UserProfile {
  industry?: string;
  currentLeads?: string;
  challenge?: string;
  leadType?: string;
  budget?: string;
  quantity?: string;
  contactInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
  };
}

interface ChatStep {
  id: string;
  trigger?: string;
  message: string | ((profile: UserProfile) => string);
  options?: string[] | ((profile: UserProfile) => string[]);
  nextStep?: string | ((response: string, profile: UserProfile) => string);
  action?: (response: string, profile: UserProfile) => void;
  delay?: number;
}

interface LeadPricing {
  industry: string;
  exclusive: {
    '30+': number;
    '50+': number;
    '75+': number;
  };
  shared: {
    price: number;
    minQuantity: number;
  };
}

export const leadPricing: Record<string, LeadPricing> = {
  'Thuisbatterijen': {
    industry: 'Thuisbatterijen',
    exclusive: {
      '30+': 37.50,
      '50+': 35.00,
      '75+': 32.50,
    },
    shared: {
      price: 12.50,
      minQuantity: 250,
    },
  },
  'Zonnepanelen': {
    industry: 'Zonnepanelen',
    exclusive: {
      '30+': 37.50,
      '50+': 35.00,
      '75+': 32.50,
    },
    shared: {
      price: 12.50,
      minQuantity: 250,
    },
  },
  'Warmtepompen': {
    industry: 'Warmtepompen',
    exclusive: {
      '30+': 37.50,
      '50+': 35.00,
      '75+': 32.50,
    },
    shared: {
      price: 12.50,
      minQuantity: 250,
    },
  },
  'Airco\'s': {
    industry: 'Airco\'s',
    exclusive: {
      '30+': 37.50,
      '50+': 35.00,
      '75+': 32.50,
    },
    shared: {
      price: 12.50,
      minQuantity: 250,
    },
  },
  'Financial Lease': {
    industry: 'Financial Lease',
    exclusive: {
      '30+': 37.50,
      '50+': 35.00,
      '75+': 32.50,
    },
    shared: {
      price: 12.50,
      minQuantity: 250,
    },
  },
};

export const chatFlow: Record<string, ChatStep> = {
  // Basis flow - altijd naar leads bestellen
  welcome: {
    id: 'welcome',
    message: 'Bent u ook op zoek naar groei voor uw bedrijf?',
    options: ['Ja, absoluut!', 'Nee, niet echt'],
    nextStep: (response) => response === 'Ja, absoluut!' ? 'industry' : 'reverse_psychology',
  },

  industry: {
    id: 'industry',
    message: 'Geweldig! Dan kan ik u zeker helpen. In welke branche bent u actief?',
    options: ['Zonnepanelen', 'Thuisbatterijen', 'Warmtepompen', 'Airco\'s', 'Financial Lease', 'Anders'],
    nextStep: 'current_leads',
    action: (response, profile) => {
      profile.industry = response;
    },
  },

  reverse_psychology: {
    id: 'reverse_psychology',
    message: 'Ah, u heeft al genoeg klanten? Dat is fantastisch! 🎉 Maar stel dat u met dezelfde tijd en moeite 50% meer omzet zou kunnen maken... zou dat interessant zijn?',
    options: ['Ja, dat wel!', 'Vertel meer', 'Nee, echt niet'],
    nextStep: 'industry',
  },

  current_leads: {
    id: 'current_leads',
    message: (profile: UserProfile) => `Perfect! ${profile.industry} is een geweldige markt. Hoeveel leads neemt u nu gemiddeld per maand af?`,
    options: ['0-10 leads', '10-50 leads', '50-100 leads', '100+ leads', 'Nog geen leads'],
    nextStep: 'challenges',
    action: (response, profile) => {
      profile.currentLeads = response;
    },
  },

  challenges: {
    id: 'challenges',
    message: 'Dank je! En wat is momenteel uw grootste uitdaging bij het krijgen van nieuwe klanten?',
    options: [
      'Leads zijn te duur',
      'Slechte kwaliteit leads',
      'Te weinig volume',
      'Geen tijd voor acquisitie',
      'Onbetrouwbare leveranciers'
    ],
    nextStep: 'solution_intro',
    action: (response, profile) => {
      profile.challenge = response;
    },
  },

  solution_intro: {
    id: 'solution_intro',
    message: 'Dat herken ik! Laat me u onze oplossing tonen. Wij hebben twee soorten leads: exclusieve leads (alleen voor u) en gedeelde leads (gedeeld met 2 andere bedrijven). Wat spreekt u meer aan?',
    options: ['Exclusieve leads', 'Gedeelde leads', 'Vertel meer over beide'],
    nextStep: (response) => {
      if (response === 'Vertel meer over beide') return 'explain_both';
      return 'pricing_presentation';
    },
    action: (response, profile) => {
      profile.leadType = response;
    },
  },

  explain_both: {
    id: 'explain_both',
    message: 'Natuurlijk! Exclusieve leads: Alleen voor u, hogere conversiekans, premium prijs. Gedeelde leads: Gedeeld met 2 anderen, lagere prijs (1/3e van exclusief), nog steeds hoge kwaliteit. Wat past beter bij u?',
    options: ['Exclusieve leads', 'Gedeelde leads'],
    nextStep: 'pricing_presentation',
    action: (response, profile) => {
      profile.leadType = response;
    },
  },

  pricing_presentation: {
    id: 'pricing_presentation',
    message: (profile: UserProfile) => {
      const pricing = profile.industry ? leadPricing[profile.industry] : null;
      if (!pricing) return 'custom_proposal';

      if (profile.leadType === 'Exclusieve leads') {
        return `Perfect! Voor exclusieve ${profile.industry?.toLowerCase()} leads hebben wij:\n\n💎 30+ leads: €${pricing.exclusive['30+']} per lead\n💎 50+ leads: €${pricing.exclusive['50+']} per lead\n💎 75+ leads: €${pricing.exclusive['75+']} per lead\n\n✅ Verse leads binnen 15 minuten\n✅ 100% exclusief voor u\n✅ Hoge conversiekans`;
      } else {
        return `Uitstekende keuze! Voor gedeelde ${profile.industry?.toLowerCase()} leads:\n\n🤝 Prijs: €${pricing.shared.price} per lead\n🤝 Minimum: ${pricing.shared.minQuantity} leads per bestelling\n🤝 Gedeeld met: Maximaal 2 andere bedrijven\n\n✅ Verse leads binnen 15 minuten\n✅ Uitstekende prijs-kwaliteit verhouding`;
      }
    },
    nextStep: 'pricing_options',
  },

  pricing_options: {
    id: 'pricing_options',
    message: 'Wat vindt u van dit aanbod?',
    options: ['Perfect, ik wil bestellen!', 'Kan het nog goedkoper?', 'Meer informatie eerst'],
    nextStep: (response) => {
      if (response === 'Perfect, ik wil bestellen!') return 'quantity_selection';
      if (response === 'Kan het nog goedkoper?') return 'discount_offer';
      return 'more_info';
    },
  },

  quantity_selection: {
    id: 'quantity_selection',
    message: (profile: UserProfile) => {
      if (profile.leadType === 'Gedeelde leads') {
        return 'Perfect! Gedeelde verse leads worden vanaf 250 stuks geleverd. Hoeveel wilt u bestellen?';
      } else {
        return 'Uitstekend! Hoeveel exclusieve leads wilt u per maand?';
      }
    },
    options: (profile: UserProfile) => {
      if (profile.leadType === 'Gedeelde leads') {
        return [
          '250 leads - €3.125 totaal',
          '500 leads - €6.250 totaal',
          '1000 leads - €12.500 totaal',
          'Ander aantal (maatwerk)'
        ];
      } else {
        return [
          '30 leads',
          '50 leads', 
          '75 leads',
          '100+ leads (maatwerk)'
        ];
      }
    },
    nextStep: 'order_process',
    action: (response, profile) => {
      profile.quantity = response;
    },
  },

  discount_offer: {
    id: 'discount_offer',
    message: 'Ik begrijp het! Goed nieuws: voor nieuwe klanten hebben we deze maand nog 20% korting beschikbaar. En als u vandaag besluit, krijgt u de eerste 10 leads gratis om de kwaliteit te testen! 🎁',
    options: ['Dat is interessant!', 'Vertel meer over de gratis test', 'Nog steeds te duur'],
    nextStep: (response) => {
      if (response === 'Nog steeds te duur') return 'budget_discussion';
      return 'quantity_selection';
    },
  },

  budget_discussion: {
    id: 'budget_discussion',
    message: 'Ik begrijp uw situatie. Wat zou voor u een realistische investering per maand zijn voor leadgeneratie?',
    options: ['€500-1000', '€1000-2500', '€2500-5000', '€5000+', 'Minder dan €500'],
    nextStep: 'custom_package',
    action: (response, profile) => {
      profile.budget = response;
    },
  },

  custom_package: {
    id: 'custom_package',
    message: (profile: UserProfile) => {
      return `Op basis van uw budget van ${profile.budget} kan ik een aangepast pakket voor u samenstellen. Laat me even rekenen... 🧮\n\nIk kom zo terug met een perfect voorstel dat binnen uw budget past!`;
    },
    options: ['Graag!', 'Oké, ben benieuwd'],
    nextStep: 'final_offer',
    delay: 3000,
  },

  final_offer: {
    id: 'final_offer',
    message: (profile: UserProfile) => {
      return `Perfect! Hier is mijn voorstel:\n\n🎯 Starter Pakket voor ${profile.industry}\n💰 Aangepaste prijs binnen uw budget\n🎁 Eerste week gratis proberen\n📞 Persoonlijke onboarding\n⚡ Leads binnen 15 minuten\n\nZullen we een korte call inplannen om de details te bespreken?`;
    },
    options: ['Ja, plan een call!', 'Stuur me meer info', 'Ik denk er over na'],
    nextStep: 'contact_details',
  },

  more_info: {
    id: 'more_info',
    message: 'Natuurlijk! Wat wilt u graag weten?',
    options: ['Hoe werkt de lead delivery?', 'Wat als ik niet tevreden ben?', 'Kan ik meer leads bijbestellen?', 'Toch maar direct bestellen'],
    nextStep: (response) => {
      if (response === 'Toch maar direct bestellen') return 'quantity_selection';
      return 'info_answer';
    },
  },

  info_answer: {
    id: 'info_answer',
    message: (profile: UserProfile) => {
      return `Goede vraag! Onze leads worden:\n\n⚡ Binnen 15 minuten geleverd via email\n🎯 Gefilterd op uw specifieke criteria\n📞 Voorzien van contactgegevens en interesse\n✅ Gegarandeerd vers (max 24u oud)\n\nAls u niet tevreden bent, krijgt u uw geld terug of gratis vervanging!\n\nZullen we uw leadpakket nu activeren?`;
    },
    options: ['Ja, laten we starten!', 'Nog een vraag', 'Liever telefonisch contact'],
    nextStep: (response) => {
      if (response === 'Ja, laten we starten!') return 'quantity_selection';
      if (response === 'Liever telefonisch contact') return 'phone_contact';
      return 'more_info';
    },
  },

  // Order process - altijd naar betaling
  order_process: {
    id: 'order_process',
    message: 'Fantastisch! Om te starten heb ik wat gegevens nodig. Kunt u mij uw contactgegevens geven?',
    options: ['Jan de Vries, ABC Solar BV', 'Geef mijn gegevens in', 'Bel mij liever'],
    nextStep: (response) => {
      if (response === 'Bel mij liever') return 'phone_contact';
      return 'contact_confirmation';
    },
    action: (response, profile) => {
      if (response.includes(',')) {
        const parts = response.split(',');
        profile.contactInfo = {
          name: parts[0]?.trim(),
          company: parts[1]?.trim() || '',
        };
      }
    },
  },

  contact_confirmation: {
    id: 'contact_confirmation',
    message: 'Perfect! En wat is uw email adres zodat ik de leads kan versturen?',
    options: ['jan@abcsolar.nl', 'info@mijnbedrijf.nl', 'Geef email adres'],
    nextStep: 'payment_ready',
    action: (response, profile) => {
      if (response.includes('@')) {
        profile.contactInfo = {
          ...profile.contactInfo,
          email: response.trim(),
        };
      }
    },
  },

  contact_details: {
    id: 'contact_details',
    message: 'Perfect! Wat is uw naam en email? Dan neem ik binnen 2 uur contact met u op! 📞',
    options: [], // Free text input
    nextStep: 'confirmation',
    action: (response, profile) => {
      const parts = response.split(',');
      profile.contactInfo = {
        name: parts[0]?.trim(),
        email: parts[1]?.trim(),
      };
    },
  },

  confirmation: {
    id: 'confirmation',
    message: (profile: UserProfile) => {
      return `Bedankt ${profile.contactInfo?.name}! 🙏\n\nIk heb uw gegevens genoteerd:\n✅ Branche: ${profile.industry}\n✅ Email: ${profile.contactInfo?.email}\n\nU hoort binnen 2 uur van mij met een gepersonaliseerd voorstel. Tot snel! 👋`;
    },
    options: ['Dank je Lisa!', 'Nog een vraag'],
    nextStep: 'end',
  },

  payment_ready: {
    id: 'payment_ready',
    message: (profile: UserProfile) => {
      return `Uitstekend ${profile.contactInfo?.name}! 🎉\n\nIk heb alles klaar:\n✅ Leads voor: ${profile.industry}\n✅ Type: ${profile.leadType}\n✅ Email: ${profile.contactInfo?.email}\n\nZodra u betaalt, krijgt u binnen 15 minuten uw eerste verse leads!`;
    },
    options: ['💳 Betalen & Direct Starten', 'Eerst meer details', 'Liever telefonisch afhandelen'],
    nextStep: (response) => {
      if (response === '💳 Betalen & Direct Starten') return 'payment_redirect';
      if (response === 'Liever telefonisch afhandelen') return 'phone_contact';
      return 'more_details';
    },
  },

  payment_redirect: {
    id: 'payment_redirect',
    message: 'Perfect! Ik stuur u nu door naar onze beveiligde betaalpagina. Na betaling ontvangt u direct uw eerste leads! 🚀',
    options: ['Naar betaalpagina', 'Toch liever telefonisch'],
    nextStep: 'end',
  },

  phone_contact: {
    id: 'phone_contact',
    message: 'Natuurlijk! Wat is uw telefoonnummer? Dan bel ik u binnen 30 minuten om alles af te handelen! 📞',
    options: ['06-12345678', '010-1234567', 'Geef telefoonnummer'],
    nextStep: 'phone_confirmation',
    action: (response, profile) => {
      profile.contactInfo = {
        ...profile.contactInfo,
        phone: response.trim(),
      };
    },
  },

  phone_confirmation: {
    id: 'phone_confirmation',
    message: (profile: UserProfile) => {
      return `Geweldig! Ik bel u binnen 30 minuten op ${profile.contactInfo?.phone} om uw leadpakket af te handelen.\n\nU krijgt:\n🎯 Aangepaste leads voor uw branche\n⚡ Eerste leads binnen 15 minuten na akkoord\n🎁 Speciale nieuwe klant korting\n\nTot zo! 👋`;
    },
    options: ['Perfect, ik wacht op uw telefoontje!', 'Stuur me ook een email'],
    nextStep: 'end',
  },

  // Lead examples flow
  lead_examples: {
    id: 'lead_examples',
    message: `Hier ziet u hoe een verse lead eruit ziet! 📊

🎯 **Voorbeeld Thuisbatterij Lead:**
• **Naam:** Jan de Vries
• **Telefoon:** 06-12345678
• **Email:** jan@email.nl
• **Adres:** Kerkstraat 123, Utrecht
• **Interesse:** Thuisbatterij voor zonnepanelen
• **Motivatie:** Energie onafhankelijkheid
• **Budget:** €5.000 - €8.000
• **Tijdlijn:** Binnen 3 maanden
• **Status:** Verse lead (15 min geleden gegenereerd)

📈 **Wat krijgt u:**
• Volledige contactgegevens
• Interesse niveau en motivatie
• Budget indicatie
• Tijdlijn voor aankoop
• Real-time status updates

⚡ **Verse leads = Hogere conversie!**`,
    options: ['Dit ziet er goed uit!', 'Meer voorbeelden', 'Hoe ontvang ik de leads?'],
    nextStep: (response) => {
      if (response === 'Hoe ontvang ik de leads?') return 'lead_delivery_info';
      if (response === 'Meer voorbeelden') return 'more_lead_examples';
      return 'order_process';
    },
  },

  lead_delivery_info: {
    id: 'lead_delivery_info',
    message: `📋 **Hoe ontvangt u uw leads?**

🎯 **Persoonlijke Spreadsheet:**
• U krijgt toegang tot uw eigen dashboard
• Real-time updates op kwartier nauwkeurig
• Alle leads worden automatisch ingeladen
• Volledige contactgegevens en details

⚡ **Verse leads binnen 15 minuten:**
• Leads worden direct na generatie toegevoegd
• U bent altijd als eerste bij verse prospects
• Geen concurrentie van andere bedrijven
• Maximale conversiekans

📊 **Flexibele ontvangst:**
• Kies hoeveel leads per week
• Automatische delivery tot uw limiet
• U bepaalt het tempo
• Geen verrassingen

💳 **Klaar om te starten?**`,
    options: ['Ja, ik wil bestellen!', 'Meer vragen', 'Terug naar voorbeelden'],
    nextStep: (response) => {
      if (response === 'Ja, ik wil bestellen!') return 'order_process';
      if (response === 'Terug naar voorbeelden') return 'lead_examples';
      return 'questions';
    },
  },

  more_lead_examples: {
    id: 'more_lead_examples',
    message: `Hier ziet u nog meer voorbeelden van leads! 📊

🎯 **Voorbeeld Zonnepanelen Lead:**
• **Naam:** Pietje Puk
• **Telefoon:** 06-12345678
• **Email:** pietje@email.nl
• **Adres:** Keizersgracht 45, Amsterdam
• **Interesse:** Zonnepanelen voor huiseigenaren
• **Motivatie:** Energie besparing en duurzaamheid
• **Budget:** €10.000 - €15.000
• **Tijdlijn:** Binnen 2 maanden
• **Status:** Verse lead (10 min geleden gegenereerd)

📈 **Wat krijgt u:**
• Volledige contactgegevens
• Interesse niveau en motivatie
• Budget indicatie
• Tijdlijn voor aankoop
• Real-time status updates

⚡ **Verse leads = Hogere conversie!**`,
    options: ['Dit ziet er goed uit!', 'Meer voorbeelden', 'Hoe ontvang ik de leads?'],
    nextStep: (response) => {
      if (response === 'Hoe ontvang ik de leads?') return 'lead_delivery_info';
      if (response === 'Meer voorbeelden') return 'more_lead_examples';
      return 'order_process';
    },
  },

  // Questions flow
  questions: {
    id: 'questions',
    message: 'Natuurlijk! Ik beantwoord graag al uw vragen. Wat wilt u weten?',
    options: ['Prijzen', 'Kwaliteit van leads', 'Hoe snel?', 'Andere vraag'],
    nextStep: (response) => {
      if (response === 'Prijzen') return 'pricing_info';
      if (response === 'Kwaliteit van leads') return 'quality_info';
      if (response === 'Hoe snel?') return 'speed_info';
      return 'custom_question';
    },
  },

  custom_question: {
    id: 'custom_question',
    message: 'Ik luister! Wat is uw vraag?',
    options: ['Hoe ziet een lead eruit?', 'Wat is de ROI?', 'Andere vraag'],
    nextStep: (response) => {
      if (response === 'Hoe ziet een lead eruit?') return 'lead_examples';
      if (response === 'Wat is de ROI?') return 'roi_info';
      return 'general_answer';
    },
  },

  general_answer: {
    id: 'general_answer',
    message: (profile: UserProfile) => {
      return `Goede vraag! Onze leads worden:\n\n⚡ Binnen 15 minuten geleverd via email\n🎯 Gefilterd op uw specifieke criteria\n📞 Voorzien van contactgegevens en interesse\n✅ Gegarandeerd vers (max 24u oud)\n\nAls u niet tevreden bent, krijgt u uw geld terug of gratis vervanging!\n\nZullen we uw leadpakket nu activeren?`;
    },
    options: ['Ja, laten we starten!', 'Nog een vraag', 'Liever telefonisch contact'],
    nextStep: (response) => {
      if (response === 'Ja, laten we starten!') return 'quantity_selection';
      if (response === 'Liever telefonisch contact') return 'phone_contact';
      return 'questions';
    },
  },

  // Pricing info flow
  pricing_info: {
    id: 'pricing_info',
    message: 'Onze prijzen zijn transparant en gebaseerd op volume:\n\n🎯 **Exclusieve leads:** €30-50 per lead\n🤝 **Gedeelde leads:** €12-18 per lead (min. 500)\n\nHoeveel leads heeft u ongeveer nodig?',
    options: ['30-50 leads', '50-100 leads', '100+ leads', 'Meer info'],
    nextStep: (response) => {
      if (response.includes('leads')) return 'volume_based_pricing';
      return 'pricing_details';
    },
  },

  pricing_details: {
    id: 'pricing_details',
    message: 'Onze prijzen zijn gebaseerd op volume:\n\n🎯 **Exclusieve leads:** €30-50 per lead (afhankelijk van branche)\n🤝 **Gedeelde leads:** €12-18 per lead (min. 500 stuks)\n\nVoor welke branche wilt u een specifieke prijsopgave?',
    options: ['Thuisbatterijen', 'Zonnepanelen', 'Warmtepompen', 'Airco\'s', 'Financial Lease', 'Direct bestellen'],
    nextStep: (response) => {
      if (response === 'Direct bestellen') return 'order_process';
      return 'specific_pricing';
    },
    action: (response, profile) => {
      if (response !== 'Direct bestellen') {
        profile.industry = response;
      }
    },
  },

  volume_based_pricing: {
    id: 'volume_based_pricing',
    message: 'Onze prijzen zijn gebaseerd op volume:\n\n🎯 **Exclusieve leads:** €30-50 per lead (afhankelijk van branche)\n🤝 **Gedeelde leads:** €12-18 per lead (min. 500 stuks)\n\nVoor welke branche wilt u een specifieke prijsopgave?',
    options: ['Thuisbatterijen', 'Zonnepanelen', 'Warmtepompen', 'Airco\'s', 'Financial Lease', 'Direct bestellen'],
    nextStep: (response) => {
      if (response === 'Direct bestellen') return 'order_process';
      return 'specific_pricing';
    },
    action: (response, profile) => {
      if (response !== 'Direct bestellen') {
        profile.industry = response;
      }
    },
  },

  specific_pricing: {
    id: 'specific_pricing',
    message: (profile: UserProfile) => {
      const industry = profile.industry;
      const pricing = industry ? leadPricing[industry] : null;
      
      if (!pricing) {
        return 'Voor deze branche maken we een aangepaste prijsopgave. Laat me dat voor u uitrekenen!';
      }
      
      return `Voor ${industry} hebben we deze tarieven:

💎 **Exclusieve leads:**
• 30+ leads: €${pricing.exclusive['30+']} per lead
• 50+ leads: €${pricing.exclusive['50+']} per lead  
• 75+ leads: €${pricing.exclusive['75+']} per lead

🤝 **Gedeelde leads:**
• €${pricing.shared.price} per lead
• Minimum ${pricing.shared.minQuantity} leads per bestelling

Welke optie spreekt u aan?`;
    },
    options: ['Exclusieve leads', 'Gedeelde leads', 'Bereken ROI voor mij', 'Direct bestellen'],
    nextStep: (response) => {
      if (response === 'Bereken ROI voor mij') return 'roi_calculator';
      if (response === 'Direct bestellen') return 'order_process';
      return 'solution_intro';
    },
    action: (response, profile) => {
      if (response !== 'Bereken ROI voor mij' && response !== 'Direct bestellen') {
        profile.leadType = response;
      }
    },
  },

  roi_calculator: {
    id: 'roi_calculator',
    message: 'Ik kan u helpen met de ROI berekening. Hoeveel omzet zou u per maand kunnen maken?',
    options: ['€5.000', '€10.000', '€20.000', '€50.000', 'Anders'],
    nextStep: 'roi_calculation_setup',
    action: (response, profile) => {
      profile.currentLeads = response; // Assuming currentLeads is the monthly revenue
    },
  },

  roi_calculation_setup: {
    id: 'roi_calculation_setup',
    message: 'Perfect! Voor een accurate ROI berekening heb ik wat info nodig. In welke branche bent u actief?',
    options: ['Thuisbatterijen', 'Zonnepanelen', 'Warmtepompen', 'Airco\'s', 'Financial Lease'],
    nextStep: 'roi_calculator',
    action: (response, profile) => {
      profile.industry = response;
    },
  },

  // Quality info flow
  quality_info: {
    id: 'quality_info',
    message: 'Onze leads zijn van topkwaliteit:\n\n✅ **Verse leads** (max 24u oud)\n🎯 **Gefilterd** op interesse en budget\n📞 **Volledige contactgegevens**\n⚡ **Binnen 15 minuten** geleverd\n\nWilt u een voorbeeld zien?',
    options: ['Ja, toon voorbeeld', 'Vertel meer', 'Direct bestellen'],
    nextStep: (response) => {
      if (response === 'Ja, toon voorbeeld') return 'lead_examples';
      if (response === 'Direct bestellen') return 'order_process';
      return 'quality_details';
    },
  },

  quality_details: {
    id: 'quality_details',
    message: 'Onze kwaliteitsgarantie is gebaseerd op 4 pijlers:\n\n✅ **Verse leads binnen 15 minuten** - Maximale conversiekans\n✅ **Kwaliteitscontrole proces** - Elke lead wordt gevalideerd\n✅ **Geld terug garantie** - 30 dagen niet-goed-geld-terug\n✅ **Nederlandse prospects** - Alleen relevante, lokale leads\n\nWilt u dit testen met een kleine bestelling?',
    options: ['Ja, ik wil testen', 'Vertel meer over het proces', 'Direct bestellen'],
    nextStep: (response) => {
      if (response === 'Direct bestellen') return 'order_process';
      if (response === 'Vertel meer over het proces') return 'quality_process';
      return 'test_order';
    },
  },

  quality_process: {
    id: 'quality_process',
    message: 'Ons kwaliteitscontrole proces:\n\n🔍 **Stap 1:** Lead wordt gegenereerd via onze kanalen\n✅ **Stap 2:** Automatische validatie van contactgegevens\n🎯 **Stap 3:** Interesse niveau wordt geverifieerd\n📞 **Stap 4:** Telefoonnummer wordt gecontroleerd\n⚡ **Stap 5:** Binnen 15 minuten naar u verstuurd\n\n98% van onze leads voldoet aan kwaliteitseisen!',
    options: ['Dat klinkt goed!', 'Wat bij slechte leads?', 'Toon me voorbeelden', 'Direct bestellen'],
    nextStep: (response) => {
      if (response === 'Wat bij slechte leads?') return 'quality_guarantee';
      if (response === 'Toon me voorbeelden') return 'lead_examples';
      if (response === 'Direct bestellen') return 'order_process';
      return 'test_order';
    },
  },

  quality_guarantee: {
    id: 'quality_guarantee',
    message: 'Bij slechte leads krijgt u:\n\n🔄 **Gratis vervanging** - Binnen 24 uur nieuwe leads\n💰 **Geld terug** - Als vervanging niet voldoet\n📊 **Credit systeem** - Slechte leads tellen niet mee\n🎯 **Persoonlijke aandacht** - Direct contact met mij\n\nGemiddeld vervangen we <2% van onze leads!',
    options: ['Perfect, dat geeft vertrouwen', 'Hoe meld ik slechte leads?', 'Direct bestellen'],
    nextStep: (response) => {
      if (response === 'Hoe meld ik slechte leads?') return 'complaint_process';
      return 'order_process';
    },
  },

  // Speed info flow
  speed_info: {
    id: 'speed_info',
    message: 'Snelheid is cruciaal voor leadkwaliteit:\n\n⚡ **Verse leads binnen 15 minuten**\n🕐 **Real-time updates** op kwartier nauwkeurig\n📱 **Direct naar uw dashboard**\n🚀 **Geen vertraging** door administratie\n\nWilt u dit zelf ervaren?',
    options: ['Ja, start vandaag', 'Meer info', 'Demo aanvragen'],
    nextStep: (response) => {
      if (response === 'Ja, start vandaag') return 'order_process';
      if (response === 'Demo aanvragen') return 'demo_request';
      return 'questions';
    },
  },

  // Context-aware entry point stappen
  quality_explanation: {
    id: 'quality_explanation',
    message: 'Onze kwaliteitsgarantie is gebaseerd op 4 pijlers:\n\n✅ **Verse leads binnen 15 minuten** - Maximale conversiekans\n✅ **Kwaliteitscontrole proces** - Elke lead wordt gevalideerd\n✅ **Geld terug garantie** - 30 dagen niet-goed-geld-terug\n✅ **Nederlandse prospects** - Alleen relevante, lokale leads\n\nWilt u dit testen met een kleine bestelling?',
    options: ['Ja, ik wil testen', 'Vertel meer over het proces', 'Direct bestellen'],
    nextStep: (response) => {
      if (response === 'Direct bestellen') return 'order_process';
      if (response === 'Vertel meer over het proces') return 'quality_process';
      return 'test_order';
    },
  },

  pricing_explanation: {
    id: 'pricing_explanation',
    message: 'Onze prijzen zijn transparant en gebaseerd op volume:\n\n🎯 **Exclusieve leads:** €30-50 per lead (afhankelijk van branche)\n🤝 **Gedeelde leads:** €12-18 per lead (min. 500 stuks)\n\nVoor welke branche wilt u een specifieke prijsopgave?',
    options: ['Thuisbatterijen', 'Zonnepanelen', 'Warmtepompen', 'Airco\'s', 'Financial Lease', 'Direct bestellen'],
    nextStep: (response) => {
      if (response === 'Direct bestellen') return 'order_process';
      return 'specific_pricing';
    },
    action: (response, profile) => {
      if (response !== 'Direct bestellen') {
        profile.industry = response;
      }
    },
  },

  delivery_explanation: {
    id: 'delivery_explanation',
    message: 'Onze lead delivery werkt als volgt:\n\n🎯 **Persoonlijke spreadsheet:** U krijgt toegang tot uw eigen dashboard\n⚡ **Real-time updates:** Op kwartier nauwkeurig bijgewerkt\n⏰ **15 minuten garantie:** Leads binnen 15 minuten na betaling\n🔗 **CRM integratie:** Automatische sync mogelijk\n\nWilt u dit zelf ervaren?',
    options: ['Ja, start vandaag', 'Meer over CRM integratie', 'Demo aanvragen'],
    nextStep: (response) => {
      if (response === 'Ja, start vandaag') return 'order_process';
      if (response === 'Demo aanvragen') return 'demo_request';
      return 'crm_integration';
    },
  },

  branches_explanation: {
    id: 'branches_explanation',
    message: 'Wij zijn gespecialiseerd in:\n\n🏠 **Zonnepanelen:** Huiseigenaren met interesse in solar\n🔋 **Thuisbatterijen:** Energie-onafhankelijkheid zoekers\n🌡️ **Warmtepompen:** Verduurzaming en besparing\n❄️ **Airco\'s:** Comfort en klimaatbeheersing\n💰 **Financial Lease:** Bedrijven zoekend naar financiering\n\nPlus maatwerk voor andere branches op aanvraag!',
    options: ['Vertel meer over mijn branche', 'Direct bestellen', 'Maatwerk aanvragen'],
    nextStep: (response) => {
      if (response === 'Direct bestellen') return 'order_process';
      if (response === 'Maatwerk aanvragen') return 'custom_branches';
      return 'branch_details';
    },
  },

  test_order: {
    id: 'test_order',
    message: 'Perfect! Voor een test bestelling raad ik aan:\n\n🎯 **50 gedeelde leads** voor uw branche\n💰 **Speciale testprijs** (20% korting)\n⚡ **Binnen 15 minuten** uw eerste leads\n🎁 **Gratis onboarding** en support\n\nZullen we uw test bestelling samenstellen?',
    options: ['Ja, laten we starten', 'Ander aantal', 'Liever exclusieve leads'],
    nextStep: (response) => {
      if (response === 'Ja, laten we starten') return 'order_process';
      return 'quantity_selection';
    },
  },

  // Nieuwe ontbrekende flows
  faq_followup: {
    id: 'faq_followup',
    message: 'Ik help u graag met uw vraag! Wat wilt u specifiek weten?',
    options: ['Prijzen voor mijn branche', 'Kwaliteit voorbeelden', 'Leveringstijd', 'CRM koppelingen', 'Direct bestellen'],
    nextStep: (response) => {
      if (response === 'Prijzen voor mijn branche') return 'industry';
      if (response === 'Kwaliteit voorbeelden') return 'lead_examples';
      if (response === 'Leveringstijd') return 'delivery_explanation';
      if (response === 'CRM koppelingen') return 'crm_integration';
      return 'order_process';
    },
  },

  customer_service: {
    id: 'customer_service',
    message: 'Hoe kan ik u vandaag helpen?',
    options: ['Nieuwe leads bestellen', 'Account vragen', 'Kwaliteit problemen', 'Factuur vragen', 'Technische support'],
    nextStep: (response) => {
      if (response === 'Nieuwe leads bestellen') return 'express_welcome';
      if (response === 'Account vragen') return 'account_support';
      if (response === 'Kwaliteit problemen') return 'quality_support';
      if (response === 'Factuur vragen') return 'billing_support';
      return 'technical_support';
    },
  },

  // Support flows die uiteindelijk naar bestelling leiden
  account_support: {
    id: 'account_support',
    message: 'Ik help u graag met uw account! Wat is uw vraag?',
    options: ['Wachtwoord vergeten', 'Gegevens wijzigen', 'Facturen bekijken', 'Account verwijderen', 'Terug naar leads bestellen'],
    nextStep: (response) => {
      if (response === 'Terug naar leads bestellen') return 'express_welcome';
      return 'account_help';
    },
  },

  quality_support: {
    id: 'quality_support',
    message: 'Ik begrijp dat u problemen heeft met de kwaliteit. Laat me u helpen!',
    options: ['Leads zijn niet relevant', 'Contactgegevens kloppen niet', 'Te weinig conversie', 'Terug naar leads bestellen'],
    nextStep: (response) => {
      if (response === 'Terug naar leads bestellen') return 'express_welcome';
      return 'quality_help';
    },
  },

  billing_support: {
    id: 'billing_support',
    message: 'Ik help u graag met factuur vragen!',
    options: ['Factuur niet ontvangen', 'Verkeerd bedrag', 'Betaling mislukt', 'Terug naar leads bestellen'],
    nextStep: (response) => {
      if (response === 'Terug naar leads bestellen') return 'express_welcome';
      return 'billing_help';
    },
  },

  technical_support: {
    id: 'technical_support',
    message: 'Voor technische ondersteuning kan ik u helpen!',
    options: ['Dashboard werkt niet', 'Leads laden niet', 'CRM koppeling problemen', 'Terug naar leads bestellen'],
    nextStep: (response) => {
      if (response === 'Terug naar leads bestellen') return 'express_welcome';
      return 'technical_help';
    },
  },

  // Helper flows die altijd naar bestelling leiden
  account_help: {
    id: 'account_help',
    message: 'Ik heb uw account probleem opgelost. Terwijl u wacht, wilt u misschien alvast nieuwe leads bestellen?',
    options: ['Ja, graag!', 'Nee, ik wacht eerst', 'Meer account hulp'],
    nextStep: (response) => {
      if (response === 'Ja, graag!') return 'express_welcome';
      return 'account_help';
    },
  },

  quality_help: {
    id: 'quality_help',
    message: 'Ik heb uw kwaliteitsprobleem opgelost. Om dit te voorkomen, raad ik aan om exclusieve leads te proberen. Wilt u dat?',
    options: ['Ja, exclusieve leads proberen', 'Nee, liever niet', 'Meer uitleg'],
    nextStep: (response) => {
      if (response === 'Ja, exclusieve leads proberen') return 'express_welcome';
      return 'quality_help';
    },
  },

  billing_help: {
    id: 'billing_help',
    message: 'Ik heb uw factuur probleem opgelost. Terwijl u wacht, kunt u alvast nieuwe leads bestellen!',
    options: ['Ja, graag!', 'Nee, ik wacht eerst', 'Meer factuur hulp'],
    nextStep: (response) => {
      if (response === 'Ja, graag!') return 'express_welcome';
      return 'billing_help';
    },
  },

  technical_help: {
    id: 'technical_help',
    message: 'Ik heb uw technische probleem opgelost. Terwijl u wacht, kunt u alvast nieuwe leads bestellen!',
    options: ['Ja, graag!', 'Nee, ik wacht eerst', 'Meer technische hulp'],
    nextStep: (response) => {
      if (response === 'Ja, graag!') return 'express_welcome';
      return 'technical_help';
    },
  },

  // Maatwerk flows
  custom_branches: {
    id: 'custom_branches',
    message: 'Voor maatwerk branches maken we een speciaal aanbod!',
    options: ['Vertel meer over maatwerk', 'Direct bestellen', 'Terug naar standaard branches'],
    nextStep: (response) => {
      if (response === 'Direct bestellen') return 'order_process';
      if (response === 'Terug naar standaard branches') return 'branches_explanation';
      return 'custom_branches_info';
    },
  },

  custom_branches_info: {
    id: 'custom_branches_info',
    message: 'Maatwerk betekent:\n\n🎯 **Aangepaste lead criteria**\n💰 **Speciale prijzen**\n⚡ **Flexibele delivery**\n🤝 **Persoonlijke begeleiding**\n\nWilt u een offerte voor maatwerk?',
    options: ['Ja, maak offerte', 'Nee, liever standaard', 'Direct bestellen'],
    nextStep: (response) => {
      if (response === 'Direct bestellen') return 'order_process';
      return 'custom_branches';
    },
  },

  // Demo setup flow
  demo_setup: {
    id: 'demo_setup',
    message: 'Ik zet uw demo klaar! Terwijl u wacht, kunt u alvast een kleine test bestelling doen om de kwaliteit te ervaren.',
    options: ['Ja, test bestelling', 'Nee, ik wacht op demo', 'Meer uitleg'],
    nextStep: (response) => {
      if (response === 'Ja, test bestelling') return 'test_order';
      return 'demo_setup';
    },
  },

  // CRM setup flow
  crm_setup: {
    id: 'crm_setup',
    message: 'Ik help u met de CRM koppeling! Terwijl ik dat instel, kunt u alvast leads bestellen.',
    options: ['Ja, leads bestellen', 'Nee, eerst CRM koppelen', 'Meer CRM info'],
    nextStep: (response) => {
      if (response === 'Ja, leads bestellen') return 'order_process';
      return 'crm_setup';
    },
  },

  // Complaint process
  complaint_process: {
    id: 'complaint_process',
    message: 'Om slechte leads te melden:\n\n📧 **Email:** support@warmeleads.nl\n📞 **Telefoon:** 020-1234567\n⏰ **Response:** Binnen 2 uur\n\nTerwijl u wacht, kunt u alvast nieuwe leads bestellen!',
    options: ['Ja, nieuwe leads bestellen', 'Nee, ik wacht eerst', 'Meer support info'],
    nextStep: (response) => {
      if (response === 'Ja, nieuwe leads bestellen') return 'express_welcome';
      return 'complaint_process';
    },
  },

  // Quantity selection (alternative)
  quantity_selection_alt: {
    id: 'quantity_selection_alt',
    message: 'Hoeveel leads wilt u bestellen?',
    options: ['30 leads', '50 leads', '75 leads', '100+ leads', 'Terug naar opties'],
    nextStep: (response) => {
      if (response === 'Terug naar opties') return 'test_order';
      return 'order_process';
    },
    action: (response, profile) => {
      profile.quantity = response;
    },
  },

  // Shared test order
  shared_test_order: {
    id: 'shared_test_order',
    message: 'Voor gedeelde leads raad ik aan:\n\n🎯 **100 gedeelde leads** voor uw branche\n💰 **Speciale testprijs** (25% korting)\n⚡ **Binnen 15 minuten** uw eerste leads\n🎁 **Gratis onboarding** en support\n\nZullen we uw test bestelling samenstellen?',
    options: ['Ja, laten we starten', 'Ander aantal', 'Liever exclusieve leads'],
    nextStep: (response) => {
      if (response === 'Ja, laten we starten') return 'order_process';
      if (response === 'Liever exclusieve leads') return 'test_order';
      return 'quantity_selection';
    },
  },
};

function getOrderSummary(profile: UserProfile): string {
      const pricing = profile.industry ? leadPricing[profile.industry] : null;
  if (!pricing) return 'Aangepast pakket';

  if (profile.leadType === 'Exclusieve leads') {
    return `🎯 Exclusieve ${profile.industry} leads\n💰 Vanaf €${pricing.exclusive['30+']} per lead\n⚡ Verse leads binnen 15 minuten`;
  } else {
    return `🤝 Gedeelde ${profile.industry} leads\n💰 €${pricing.shared.price} per lead\n📦 Minimum ${pricing.shared.minQuantity} leads\n⚡ Verse leads binnen 15 minuten`;
  }
}

export function getNextMessage(currentStep: string, userResponse: string, userProfile: UserProfile) {
  const step = chatFlow[currentStep];
  if (!step) return null;

  // Check for lead examples questions
  if (userResponse.toLowerCase().includes('hoe ziet') && userResponse.toLowerCase().includes('lead')) {
    const nextStep = chatFlow['lead_examples'];
    return {
      id: 'lead_examples',
      message: typeof nextStep.message === 'function' ? nextStep.message(userProfile) : nextStep.message,
      options: nextStep.options || [],
      delay: nextStep.delay || 1500,
    };
  }

  if (userResponse.toLowerCase().includes('lead') && userResponse.toLowerCase().includes('uit')) {
    const nextStep = chatFlow['lead_examples'];
    return {
      id: 'lead_examples',
      message: typeof nextStep.message === 'function' ? nextStep.message(userProfile) : nextStep.message,
      options: nextStep.options || [],
      delay: nextStep.delay || 1500,
    };
  }

  if (userResponse.toLowerCase().includes('voorbeeld') && userResponse.toLowerCase().includes('lead')) {
    const nextStep = chatFlow['lead_examples'];
    return {
      id: 'lead_examples',
      message: typeof nextStep.message === 'function' ? nextStep.message(userProfile) : nextStep.message,
      options: nextStep.options || [],
      delay: nextStep.delay || 1500,
    };
  }

  // Execute action if defined
  if (step.action) {
    step.action(userResponse, userProfile);
  }

  // Determine next step
  let nextStepId: string;
  if (typeof step.nextStep === 'function') {
    nextStepId = step.nextStep(userResponse, userProfile);
  } else {
    nextStepId = step.nextStep || 'end';
  }

  const nextStep = chatFlow[nextStepId];
  if (!nextStep) return null;

  // Generate message (can be function of profile)
  let message: string;
  if (typeof nextStep.message === 'function') {
    message = nextStep.message(userProfile);
  } else {
    message = nextStep.message;
  }

  return {
    id: nextStepId,
    message,
    options: nextStep.options || [],
    delay: nextStep.delay || 1500,
  };
}

export function generatePersonalizedRecommendation(profile: UserProfile): string {
      const industry = profile.industry;
  const challenge = profile.challenge;
  const currentLeads = profile.currentLeads;

  if (challenge === 'Leads zijn te duur' || currentLeads === 'Nog geen leads') {
    const price = industry ? leadPricing[industry]?.shared.price || 15 : 15;
    return `Op basis van uw situatie raad ik gedeelde leads aan. Deze zijn betaalbaar (€${price}/lead) en perfect om mee te starten!`;
  }

  if (currentLeads === '100+ leads' || challenge === 'Te weinig volume') {
    return `Voor uw schaal raad ik exclusieve leads aan. Hogere conversie en meer controle over uw pipeline!`;
  }

  return `Ik raad een mix van beide aan: start met gedeelde leads om te testen, schakel over naar exclusieve leads voor uw beste campagnes!`;
}

