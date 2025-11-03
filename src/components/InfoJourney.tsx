'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftIcon,
  LightBulbIcon,
  CurrencyEuroIcon,
  UserGroupIcon,
  ClockIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ComputerDesktopIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline';
import { Logo } from './Logo';
import { StyledContent } from './StyledContent';
import { type ChatContext } from '@/lib/chatContext';

interface InfoJourneyProps {
  onBackToHome: () => void;
  onStartChat: (context: ChatContext) => void;
  onDirectOrder?: () => void;
}

const infoSections = [
  {
    id: 'what-are-leads',
    icon: LightBulbIcon,
    title: 'Wat zijn warme leads?',
    content: `Warme leads zijn potentiële klanten die al interesse hebben getoond in uw product of dienst. Bij WarmeLeads genereren we verse leads die:

    ✅ Vers gegenereerd uit onze actieve campagnes
    ✅ Geïnteresseerd zijn in uw specifieke branche  
    ✅ Nederlandse en Belgische prospects met contactgegevens
    ✅ Kwaliteitscontrole hebben ondergaan
    
    **Exclusieve leads (alleen voor u):**
    • We starten binnen 24u campagnes speciaal voor u
    • Leads komen real-time binnen in uw persoonlijke portal
    • 100% exclusief, geen concurrentie
    
    **Bulk leads (gedeeld, voordelig):**
    • Direct beschikbaar uit onze database
    • Binnen 24u per email geleverd (Excel bestand)
    • Bewezen koopintentie, 1/3 van de prijs
    
    Dit betekent veel hogere conversiekansen dan koude acquisitie!`,
    cta: 'Vraag Lisa naar voorbeelden',
  },
  {
    id: 'our-branches',
    icon: UserGroupIcon,
    title: 'Onze specialisaties',
    content: `Wij leveren hoogwaardige leads voor:

    • **Zonnepanelen** - Huiseigenaren met interesse in solar  
    • **Thuisbatterijen** - Energie-onafhankelijkheid zoekers  
    • **Warmtepompen** - Verduurzaming en besparing  
    • **Airco installatie** - Comfort en klimaatbeheersing  
    • **Financial Lease** - Bedrijven zoekend naar financiering
    
    🇳🇱 Nederlandse markt + 🇧🇪 Belgische markt
    
    Plus maatwerk voor andere branches op aanvraag!`,
    cta: 'Chat over mijn branche',
  },
  {
    id: 'pricing',
    icon: CurrencyEuroIcon,
    title: 'Transparante prijzen',
    content: `**1️⃣ Verse Exclusieve Leads** 💎
    
    • Thuisbatterijen: €37,50 - €42,50
    • Zonnepanelen: €40,00 - €45,00
    • Warmtepompen: €45,00 - €50,00
    • Airco: €35,00 - €40,00
    • Financial Lease: €45,00 - €55,00
    
    📦 Min. 30 leads • Campagnes binnen 24u
    ⚡ Real-time in uw portal • 100% exclusief
    
    **2️⃣ Gedeelde Verse Leads** 🤝
    
    • 1/3 van exclusieve prijs (€12-€18)
    • Min. 250 leads • Verse campagnes
    • Binnen 24u per email • 3 partijen totaal
    
    **3️⃣ Bulk Leads** 📦
    
    • €3,50 - €4,25 per lead (alle branches)
    • Min. 100 leads • Binnen 24u per email
    • Database (tot 6 mnd oud) • Laagste prijs
    
    ✅ Geen setup kosten • Geen abonnementen!`,
    cta: 'Bereken mijn investering',
  },
  {
    id: 'how-it-works',
    icon: ClockIcon,
    title: 'Zo werkt het',
    content: `**Verse Exclusieve Leads** 💎
    
    1️⃣ U kiest uw pakket en betaalt
    2️⃣ Wij starten binnen 24u campagnes voor u
    3️⃣ Leads komen real-time binnen in uw portal
    4️⃣ U ontvangt automatisch notificaties
    5️⃣ Direct contact opnemen = maximale conversie!
    
    **Gedeelde Verse Leads** 🤝
    
    1️⃣ U bestelt min. 250 leads
    2️⃣ Wij starten binnen 24u campagnes
    3️⃣ Leads worden binnen 24u per email geleverd
    4️⃣ Gedeeld met 2 andere partijen (3 totaal)
    
    **Bulk Leads** 📦
    
    1️⃣ U bestelt vanaf 100 leads
    2️⃣ Wij bereiden het Excel bestand voor
    3️⃣ Binnen 24u ontvangt u de leads per email
    4️⃣ Database leads (tot 6 mnd oud)
    
    💡 **Tip:** Start met bulk (€425) om te testen!`,
    cta: 'Start nu',
  },
  {
    id: 'your-portal',
    icon: ComputerDesktopIcon,
    title: 'Uw persoonlijke portal',
    content: `Bij WarmeLeads krijgt u toegang tot uw eigen dashboard:
    
    📊 **Real-time Lead Overview**
    • Alle leads op één plek
    • Status tracking per lead
    • Notificaties bij nieuwe leads
    
    📈 **Analytics & Insights**
    • Conversie statistieken
    • ROI berekeningen
    • Performance tracking
    
    🔗 **CRM Integratie**
    • Direct gekoppeld aan uw Google Sheet
    • Automatische synchronisatie
    • Bidirectionele updates
    
    ✅ Toegang op elk apparaat - mobiel, tablet, desktop`,
    cta: 'Bekijk demo portal',
  },
  {
    id: 'success-stories',
    icon: ChartBarIcon,
    title: 'Bewezen resultaten',
    content: `**Echte statistieken van onze klanten:**
    
    📈 **Gemiddelde conversieratio:**
    • Verse Exclusieve leads: 25-40% conversie
    • Gedeelde Verse leads: 15-25% conversie
    • Bulk leads: 5-10% conversie
    • Koude acquisitie: 2-5% conversie
    
    💰 **ROI binnen 3 maanden:**
    • Exclusieve klanten: 280-450% ROI
    • Gedeelde verse klanten: 180-280% ROI
    • Bulk klanten: 120-180% ROI
    
    ⚡ **Snelheid maakt verschil:**
    • Contact binnen 5 min: 80% hogere conversie
    • Contact binnen 1 uur: 40% hogere conversie
    • Contact na 24 uur: Gemiddelde conversie
    
    🎯 **85% van onze klanten bestelt opnieuw binnen 3 maanden**`,
    cta: 'Word de volgende successtory',
  },
  {
    id: 'guarantee',
    icon: ShieldCheckIcon,
    title: 'Onze garanties',
    content: `**100% Tevredenheidsgarantie**
    
    ✅ **Kwaliteitsgarantie**
    Slechte leads? We vervangen ze gratis!
    
    ✅ **Levertijdgarantie**  
    Exclusief: Real-time zodra gegenereerd
    Bulk: Binnen 24u of gratis extra leads
    
    ✅ **Geld-terug-garantie**
    Niet tevreden? Geld terug binnen 7 dagen
    
    ✅ **Privacy & Veiligheid**
    • AVG-compliant
    • Versleutelde data
    • Nederlandse servers
    
    🛡️ Wij staan 100% achter onze service!`,
    cta: 'Start risicovrij',
  },
];

export function InfoJourney({ onBackToHome, onStartChat, onDirectOrder }: InfoJourneyProps) {
  const [currentSection, setCurrentSection] = useState(0);
  const [hasReadAll, setHasReadAll] = useState(false);

  const nextSection = () => {
    if (currentSection < infoSections.length - 1) {
      setCurrentSection(currentSection + 1);
    } else {
      setHasReadAll(true);
    }
  };

  const prevSection = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const currentInfo = infoSections[currentSection];
  const Icon = currentInfo.icon;

  const handleDirectOrder = () => {
    if (onDirectOrder) {
      onDirectOrder();
    } else {
      // Fallback to home and trigger order modal
      onBackToHome();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openOrderModal'));
      }, 100);
    }
  };

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
          <Logo size="sm" showText={false} className="mx-auto mb-1" />
          <h1 className="text-white font-bold text-lg md:text-xl">WarmeLeads Info</h1>
          <p className="text-white/60 text-xs md:text-sm">
            {currentSection + 1} van {infoSections.length}
          </p>
        </div>
        
        <button
          onClick={() => onStartChat('info')}
          className="chat-button px-3 py-2 text-xs md:text-sm"
        >
          💬 <span className="hidden sm:inline">Chat</span>
        </button>
      </motion.div>

      {/* Progress Bar */}
      <div className="px-4 pb-2 pt-1">
        <div className="w-full bg-white/20 rounded-full h-2">
          <motion.div
            className="bg-white h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentSection + 1) / infoSections.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        {/* Section Labels - Desktop Only */}
        <div className="hidden md:flex justify-between mt-2 text-xs text-white/60">
          {infoSections.map((section, index) => (
            <button
              key={index}
              onClick={() => setCurrentSection(index)}
              className={`hover:text-white transition-colors ${
                index === currentSection ? 'text-white font-semibold' : ''
              }`}
            >
              {section.title}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-2xl"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
            >
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-button-gradient rounded-2xl flex items-center justify-center shadow-lg">
                  <Icon className="w-8 h-8 text-white" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl md:text-3xl font-bold text-brand-navy text-center mb-6">
                {currentInfo.title}
              </h2>

              {/* Content */}
              <div className="mb-8">
                <StyledContent content={currentInfo.content} />
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <motion.button
                  onClick={() => {
                    // Bepaal context op basis van sectie
                    let context: ChatContext = 'info';
                    if (currentInfo.id === 'what-are-leads') context = 'examples';
                    if (currentInfo.id === 'our-branches') context = 'branches';
                    if (currentInfo.id === 'pricing') context = 'pricing';
                    if (currentInfo.id === 'how-it-works') context = 'delivery';
                    if (currentInfo.id === 'your-portal') context = 'customer';
                    if (currentInfo.id === 'success-stories') context = 'roi';
                    if (currentInfo.id === 'guarantee') context = 'quality';
                    onStartChat(context);
                  }}
                  className="flex-1 chat-button inline-flex items-center justify-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <ChatBubbleLeftRightIcon className="w-5 h-5" />
                  <span>{currentInfo.cta}</span>
                </motion.button>
                
                <motion.button
                  onClick={handleDirectOrder}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all inline-flex items-center justify-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <RocketLaunchIcon className="w-5 h-5" />
                  <span>Direct bestellen</span>
                </motion.button>
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center">
                <button
                  onClick={prevSection}
                  disabled={currentSection === 0}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg transition-all
                    ${currentSection === 0 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : 'text-brand-purple hover:bg-brand-purple/10'
                    }
                  `}
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Vorige</span>
                </button>

                <div className="flex space-x-2">
                  {infoSections.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSection(index)}
                      className={`
                        w-2 h-2 md:w-3 md:h-3 rounded-full transition-all duration-300
                        ${index === currentSection 
                          ? 'bg-brand-pink scale-125' 
                          : 'bg-gray-300 hover:bg-gray-400'
                        }
                      `}
                      aria-label={`Ga naar ${infoSections[index].title}`}
                    />
                  ))}
                </div>

                <button
                  onClick={nextSection}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-brand-purple hover:bg-brand-purple/10 transition-all"
                >
                  <span className="hidden sm:inline">
                    {currentSection === infoSections.length - 1 ? 'Klaar' : 'Volgende'}
                  </span>
                  <span className="sm:hidden">→</span>
                  <svg className="w-4 h-4 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Completion Modal */}
      <AnimatePresence>
        {hasReadAll && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setHasReadAll(false)} />
            
            <motion.div
              className="relative bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-button-gradient rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ChartBarIcon className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-2xl font-bold text-brand-navy mb-4">
                  Geweldig! 🎉
                </h3>
                
                <p className="text-gray-600 mb-6">
                  U kent WarmeLeads nu goed. Klaar om uw eerste verse leads te krijgen?
                </p>
                
                <div className="space-y-3">
                  <motion.button
                    onClick={handleDirectOrder}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all inline-flex items-center justify-center space-x-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <RocketLaunchIcon className="w-5 h-5" />
                    <span>Direct bestellen</span>
                  </motion.button>
                  
                  <motion.button
                    onClick={() => onStartChat('info')}
                    className="w-full chat-button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    💬 Chat met Lisa
                  </motion.button>
                  
                  <button
                    onClick={() => setHasReadAll(false)}
                    className="w-full text-gray-500 hover:text-gray-700 py-2"
                  >
                    Nog even rondkijken
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
