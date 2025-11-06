'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline';
import { Logo } from './Logo';
import { type ChatContext } from '@/lib/chatContext';

interface SmartFAQProps {
  onBackToHome: () => void;
  onStartChat: (context: ChatContext) => void;
  onDirectOrder?: () => void;
}

const faqData = [
  {
    category: '🎯 Algemeen',
    questions: [
      {
        q: 'Wat maakt WarmeLeads anders dan andere leadgenerators?',
        a: 'Wij leveren verse leads met bewezen koopintentie uit eigen campagnes. Voor exclusieve en gedeelde verse leads starten we binnen 24u campagnes - leads komen real-time of binnen 24u binnen. Bulk leads zijn direct beschikbaar. Plus: bij exclusieve leads krijgt u een persoonlijk CRM portal!'
      },
      {
        q: 'Leveren jullie in Nederland én België?',
        a: 'Ja! Wij genereren leads in zowel Nederland 🇳🇱 als België 🇧🇪. U kunt kiezen voor alleen Nederlandse, alleen Belgische, of leads uit beide landen. Alle contactgegevens zijn compleet en geverifieerd.'
      },
      {
        q: 'Wat als ik niet tevreden ben met de leads?',
        a: 'Wij bieden 100% tevredenheidsgarantie. Slechte leads worden gratis vervangen. Exclusieve leads die niet voldoen aan kwaliteitseisen krijgt u gratis nieuw. Bij gedeelde verse en bulk leads krijgt u compensatie. Ons doel: 100% tevreden klanten!'
      },
      {
        q: 'Voor welke branches leveren jullie leads?',
        a: 'Wij zijn specialist in: Zonnepanelen ☀️, Thuisbatterijen 🔋, Warmtepompen 🏠, Airco installatie ❄️, en Financial Lease 💼. Andere branches op aanvraag!'
      }
    ]
  },
  {
    category: '💰 Prijzen & Bestellen',
    questions: [
      {
        q: 'Wat is het verschil tussen de 3 lead types?',
        a: 'We hebben 3 types: 1) VERSE EXCLUSIEVE leads (€37,50-€32,50, min. 30, real-time in portal, 100% exclusief). 2) GEDEELDE VERSE leads (€12,50, min. 250, verse campagnes, Excel 24u, 3 partijen totaal). 3) BULK leads (€4,25-€3,50, min. 100, database tot 6 mnd, Excel 24u). Kies op basis van budget en gewenste versheid!'
      },
      {
        q: 'Zijn er setup kosten of verborgen kosten?',
        a: 'Nee! Geen setup kosten, geen maandelijkse abonnementen, geen verborgen kosten. U betaalt alleen voor de leads die u ontvangt. Volledige transparantie.'
      },
      {
        q: 'Kan ik bestellen zonder account?',
        a: 'Ja! Guest checkout is mogelijk - u hoeft geen account aan te maken. Na betaling ontvangt u uw leads per email (gedeeld vers & bulk) of krijgt u toegang tot een persoonlijk portal (exclusief). U kunt later altijd een account aanmaken.'
      },
      {
        q: 'Welke betalingsmethoden accepteren jullie?',
        a: 'Wij accepteren iDEAL (Nederland), Bancontact (België), creditcard en alle andere Stripe betaalmethoden. Betaling is veilig via Stripe Checkout. Direct na betaling start het proces!'
      },
      {
        q: 'Wat zijn de minimum aantallen per type?',
        a: 'Verse Exclusieve leads: minimum 30 stuks. Gedeelde Verse leads: minimum 250 stuks. Bulk leads: minimum 100 stuks. Bij exclusieve en bulk leads krijgt u volumekorting bij grotere aantallen!'
      }
    ]
  },
  {
    category: '⚡ Levering & Proces',
    questions: [
      {
        q: 'Wanneer ontvang ik mijn leads?',
        a: 'EXCLUSIEF: We starten binnen 24u campagnes. Leads komen real-time binnen in uw portal zodra ze gegenereerd worden. GEDEELD VERS: Campagnes binnen 24u, Excel bestand binnen 24u per email. BULK: Excel bestand binnen 24u op uw email. U ontvangt automatisch een bevestiging na bestelling!'
      },
      {
        q: 'Wat gebeurt er na mijn bestelling?',
        a: 'EXCLUSIEF: 1) Toegang tot portal. 2) Campagnes starten binnen 24u. 3) Leads real-time binnen. 4) Notificaties per lead. GEDEELD VERS: 1) Campagnes binnen 24u. 2) Excel binnen 24u per email. 3) Direct importeren en aan de slag! BULK: 1) Pakket voorbereiden. 2) Excel binnen 24u per email. 3) Direct gebruiken!'
      },
      {
        q: 'Krijg ik toegang tot een CRM of portal?',
        a: 'Alleen bij VERSE EXCLUSIEVE leads krijgt u toegang tot uw persoonlijk portal met: real-time lead overview, conversie tracking, ROI analytics, Google Sheets integratie, en mobiele app. Gedeelde verse en bulk leads komen als Excel bestand dat u in uw eigen CRM kunt importeren.'
      },
      {
        q: 'Hoe worden de leads gegenereerd?',
        a: 'VERSE leads (exclusief & gedeeld vers): Via professionele online campagnes (Google, Facebook, etc.) gericht op mensen die actief zoeken. Elke lead heeft een aanvraagformulier ingevuld. BULK leads: Uit onze database, eerder gegenereerd via campagnes, tot 6 maanden oud. Alle leads hebben koopintentie getoond!'
      },
      {
        q: 'Wat is de leeftijd van de leads?',
        a: 'VERSE EXCLUSIEVE: Real-time, direct uit lopende campagnes (0-24 uur oud). GEDEELDE VERSE: Vers uit campagnes (0-48 uur oud). BULK: Database leads, tot 6 maanden oud. Hoe verser de lead, hoe hoger de conversiekans!'
      }
    ]
  },
  {
    category: '🔧 Technisch & Integratie',
    questions: [
      {
        q: 'Hoe integreer ik de leads met mijn systeem?',
        a: 'EXCLUSIEVE leads: Automatische sync met Google Sheets (bidirectioneel). Export naar CSV/Excel mogelijk. Via portal direct bellen, mailen of exporteren. GEDEELDE VERS & BULK: Excel bestand dat u direct kunt importeren in elk CRM systeem (Salesforce, HubSpot, Pipedrive, etc.).'
      },
      {
        q: 'Welke data krijg ik per lead?',
        a: 'Per lead ontvangt u: Volledige naam, telefoonnummer, email, postcode/stad, land (NL/BE), specifieke interesse (bijv. "10 zonnepanelen"), gewenste contact moment, en aanvullende opmerkingen. Alles wat u nodig heeft voor een sterk eerste contact!'
      },
      {
        q: 'Is mijn data veilig en AVG-compliant?',
        a: 'Absoluut! Wij zijn 100% AVG-compliant. Alle data wordt versleuteld opgeslagen op Nederlandse servers. Leads hebben toestemming gegeven voor contact. U bent verwerkingsverantwoordelijke voor uw eigen leads. Privacy garantie!'
      },
      {
        q: 'Kan ik het portal op mobiel gebruiken?',
        a: 'Ja! Het portal (bij exclusieve leads) is volledig responsive en werkt perfect op mobiel, tablet en desktop. Ontvang push notificaties bij nieuwe leads (opt-in). Bel direct vanuit de app. Alles wat u nodig heeft, altijd bij de hand!'
      }
    ]
  },
  {
    category: '📈 ROI & Resultaten',
    questions: [
      {
        q: 'Wat zijn de gemiddelde conversieratio\'s?',
        a: 'VERSE EXCLUSIEVE leads: 25-40% conversie (hoogste ROI). GEDEELDE VERSE leads: 15-25% conversie (goede ROI, betaalbaar). BULK leads: 5-10% conversie (laagste prijs, ideaal voor volumes). TER VERGELIJKING: Koude acquisitie is maar 2-5%!',
        chatPrompt: 'Bereken mijn verwachte ROI',
        context: 'roi' as ChatContext
      },
      {
        q: 'Wat is de verwachte ROI binnen 3 maanden?',
        a: 'Gemiddelde ROI van onze klanten: EXCLUSIEVE klanten: 280-450% ROI. GEDEELDE VERSE klanten: 180-280% ROI. BULK klanten: 120-180% ROI. Snelheid van contact is cruciaal: binnen 5 min = 80% hogere conversie!',
        chatPrompt: 'Bereken mijn specifieke ROI',
        context: 'roi' as ChatContext
      },
      {
        q: 'Welk type is het beste voor mijn situatie?',
        a: 'START met BULK (€425 voor 100 leads) om te testen. Werkt goed? Upgrade naar GEDEELD VERS voor verse leads tegen 1/3 prijs. Serieus schalen? EXCLUSIEF voor maximale conversie & zero concurrentie. 85% van klanten bestelt binnen 3 maanden opnieuw!',
        chatPrompt: 'Persoonlijk advies voor mijn situatie',
        context: 'roi' as ChatContext
      },
      {
        q: 'Hoeveel leads heb ik nodig per maand?',
        a: 'Dat hangt af van uw doelen! Voorbeeld: Bij 20% conversie en doel van 10 nieuwe klanten/maand heeft u 50 leads nodig. Start conservatief met bulk of gedeeld vers om uw persoonlijke conversieratio te bepalen, dan kunt u opschalen met exclusief.',
        chatPrompt: 'Help me mijn behoeften bepalen',
        context: 'roi' as ChatContext
      }
    ]
  }
];

export function SmartFAQ({ onBackToHome, onStartChat, onDirectOrder }: SmartFAQProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleDirectOrder = () => {
    if (onDirectOrder) {
      onDirectOrder();
    } else {
      onBackToHome();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openOrderModal'));
      }, 100);
    }
  };

  const filteredFAQ = faqData.filter(category => {
    if (selectedCategory && category.category !== selectedCategory) return false;
    
    if (searchTerm) {
      return category.questions.some(q => 
        q.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.a.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex flex-col">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between p-3 md:p-4 glass-effect"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={onBackToHome}
          className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Terug</span>
        </button>
        
        <div className="text-center">
          <h1 className="text-white font-bold text-lg md:text-xl">Veelgestelde vragen</h1>
          <p className="text-white/60 text-xs md:text-sm">Antwoorden op veelgestelde vragen</p>
        </div>
        
        <button
          onClick={onDirectOrder}
          className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold px-3 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all text-xs md:text-sm flex items-center space-x-1"
        >
          <span>🚀</span>
          <span className="hidden sm:inline">Bestellen</span>
        </button>
      </motion.div>

      {/* Search & Filters */}
      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
          <input
            type="text"
            placeholder="Zoek in vragen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:bg-white/30 focus:border-white/50 transition-all"
          />
        </div>

        {/* Category Filters */}
        <div className="flex space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`
              px-4 py-2 rounded-lg whitespace-nowrap transition-all flex-shrink-0
              ${!selectedCategory 
                ? 'bg-white text-brand-purple font-medium' 
                : 'bg-white/20 text-white hover:bg-white/30'
              }
            `}
          >
            Alle categorieën
          </button>
          {faqData.map((category) => (
            <button
              key={category.category}
              onClick={() => setSelectedCategory(category.category)}
              className={`
                px-4 py-2 rounded-lg whitespace-nowrap transition-all flex-shrink-0
                ${selectedCategory === category.category 
                  ? 'bg-white text-brand-purple font-medium' 
                  : 'bg-white/20 text-white hover:bg-white/30'
                }
              `}
            >
              {category.category}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ Content */}
      <div className="flex-1 p-4 space-y-4 pb-24">
        {filteredFAQ.map((category) => (
          <motion.div
            key={category.category}
            className="space-y-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="text-white font-semibold text-lg mb-3">
              {category.category}
            </h3>
            
            {category.questions.map((faq, index) => (
              <motion.div
                key={index}
                className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <button
                  onClick={() => setExpandedQuestion(
                    expandedQuestion === `${category.category}-${index}` 
                      ? null 
                      : `${category.category}-${index}`
                  )}
                  className="w-full p-4 text-left flex items-center justify-between text-white hover:bg-white/10 transition-colors"
                >
                  <span className="font-medium pr-4">{faq.q}</span>
                  {expandedQuestion === `${category.category}-${index}` ? (
                    <ChevronUpIcon className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 flex-shrink-0" />
                  )}
                </button>
                
                <AnimatePresence>
                  {expandedQuestion === `${category.category}-${index}` && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="p-4 pt-0 border-t border-white/10">
                        <p className="text-white/90 mb-4 leading-relaxed text-sm md:text-base">
                          {faq.a}
                        </p>
                        
                        {'chatPrompt' in faq && 'context' in faq ? (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <motion.button
                              onClick={() => onStartChat(faq.context)}
                              className="flex-1 inline-flex items-center justify-center space-x-2 text-sm bg-button-gradient text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <ChatBubbleLeftRightIcon className="w-4 h-4" />
                              <span>{faq.chatPrompt}</span>
                            </motion.button>
                            
                            <motion.button
                              onClick={handleDirectOrder}
                              className="flex-1 inline-flex items-center justify-center space-x-2 text-sm bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <RocketLaunchIcon className="w-4 h-4" />
                              <span>Direct bestellen</span>
                            </motion.button>
                          </div>
                        ) : (
                          <motion.button
                            onClick={handleDirectOrder}
                            className="w-full inline-flex items-center justify-center space-x-2 text-sm bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <RocketLaunchIcon className="w-5 h-5" />
                            <span>Direct leads bestellen</span>
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        ))}

        {/* No Results */}
        {filteredFAQ.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-white/60 mb-4">
              Geen vragen gevonden voor "{searchTerm}"
            </div>
            <motion.button
              onClick={() => onStartChat('faq')}
              className="chat-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              💬 Stel uw vraag aan Lisa
            </motion.button>
          </motion.div>
        )}

        {/* Chat Prompt */}
        <motion.div
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-white font-semibold mb-2 text-lg">
            Uw vraag er niet tussen?
          </h3>
          <p className="text-white/80 mb-4 text-sm md:text-base">
            Lisa beantwoordt al uw vragen persoonlijk en kan direct een offerte maken!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.button
              onClick={() => onStartChat('faq')}
              className="chat-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              💬 Start chat met Lisa
            </motion.button>
            <motion.button
              onClick={handleDirectOrder}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all inline-flex items-center justify-center space-x-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RocketLaunchIcon className="w-5 h-5" />
              <span>Direct bestellen</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
