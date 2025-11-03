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
  StarIcon
} from '@heroicons/react/24/outline';
import { Logo } from './Logo';
import { StyledContent } from './StyledContent';
import { type ChatContext } from '@/lib/chatContext';

interface InfoJourneyProps {
  onBackToHome: () => void;
  onStartChat: (context: ChatContext) => void;
}

const infoSections = [
  {
    id: 'what-are-leads',
    icon: LightBulbIcon,
    title: 'Wat zijn warme leads?',
    content: `Warme leads zijn potentiële klanten die al interesse hebben getoond in uw product of dienst. Bij WarmeLeads genereren we verse leads die:

    ✅ Vers gegenereerd uit onze actieve campagnes
    ✅ Geïnteresseerd zijn in uw specifieke branche  
    ✅ Nederlandse prospects met contactgegevens
    ✅ Kwaliteitscontrole hebben ondergaan
    
    Exclusieve leads: We starten binnen 24u campagnes speciaal voor jou
    Bulk leads: Direct beschikbaar, binnen 24u geleverd
    
    Dit betekent veel hogere conversiekansen dan koude acquisitie!`,
    cta: 'Vraag Lisa naar voorbeelden',
  },
  {
    id: 'our-branches',
    icon: UserGroupIcon,
    title: 'Onze specialisaties',
    content: `Wij leveren hoogwaardige leads voor:

    • Zonnepanelen - Huiseigenaren met interesse in solar
    • Thuisbatterijen - Energie-onafhankelijkheid zoekers  
    • Warmtepompen - Verduurzaming en besparing
    • Airco's - Comfort en klimaatbeheersing
    • Financial Lease - Bedrijven zoekend naar financiering
    
    Plus maatwerk voor andere branches op aanvraag!`,
    cta: 'Chat over mijn branche',
  },
  {
    id: 'pricing',
    icon: CurrencyEuroIcon,
    title: 'Transparante prijzen',
    content: `Exclusieve leads (alleen voor u):
    
    Thuisbatterijen: €37,50 - €42,50 per lead
    Zonnepanelen: €40,00 - €45,00 per lead
    Warmtepompen: €45,00 - €50,00 per lead
    
    📦 We starten binnen 24u campagnes voor jou
    ⚡ Leads komen real-time in je persoonlijke portal
    
    Gedeelde leads (met 2 anderen, 1/3 van de prijs):
    
    Thuisbatterijen: €12,50 per lead (min. 500)
    Zonnepanelen: €15,00 per lead (min. 500)
    Warmtepompen: €16,50 per lead (min. 500)
    
    📦 Excel bestand binnen 24 uur per email
    
    ✅ Geen setup kosten
    ✅ Geen abonnementen
    ✅ Alleen resultaat!`,
    cta: 'Bereken mijn investering',
  },
  {
    id: 'why-15-minutes',
    icon: ClockIcon,
    title: 'Waarom binnen 15 minuten?',
    content: `Snelheid = Kwaliteit
    
    • Verse leads hebben de hoogste conversiekans
    • Snelle levering voorkomt dat concurrenten er eerder bij zijn
    • Real-time systeem zorgt voor directe beschikbaarheid
    • Automatische delivery naar uw CRM of email
    
    Het verschil tussen succes en mislopen is vaak een kwestie van minuten!
    
    Onze klanten zien gemiddeld 40% hogere conversie door onze snelheid.`,
    cta: 'Test de snelheid zelf',
  },
  {
    id: 'success-stories',
    icon: StarIcon,
    title: 'Klant succesverhalen',
    content: `Solar Solutions Utrecht
    "Van 12 naar 47 klanten per maand dankzij WarmeLeads"
    
    BatterijXpert Rotterdam  
    "ROI van 340% in eerste 3 maanden met exclusieve leads"
    
    WarmtePomp Pro Eindhoven
    "Gedeelde leads waren perfect om te starten, nu exclusief"
    
    AircoMeester Amsterdam
    "15 minuten delivery is echt waar - ongelooflijk!"`,
    cta: 'Word de volgende successtory',
  },
  {
    id: 'guarantee',
    icon: ShieldCheckIcon,
    title: 'Onze garanties',
    content: `100% Tevredenheidsgarantie
    
    • Kwaliteitsgarantie - Slechte leads worden vervangen
    • Leveringsgarantie - Binnen 15 minuten of gratis
    • Geld-terug-garantie - Niet tevreden? Geld terug
    • Privacy garantie - Uw gegevens blijven veilig
    
    Wij staan 100% achter onze service!`,
    cta: 'Start risicovrij',
  },
];

export function InfoJourney({ onBackToHome, onStartChat }: InfoJourneyProps) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex flex-col">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between p-4 glass-effect"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={onBackToHome}
          className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>Terug</span>
        </button>
        
        <div className="text-center">
          <Logo size="sm" showText={false} className="mx-auto mb-2" />
          <h1 className="text-white font-bold text-xl">WarmeLeads Info</h1>
          <p className="text-white/60 text-sm">
            {currentSection + 1} van {infoSections.length}
          </p>
        </div>
        
        <button
          onClick={() => onStartChat('info')}
          className="chat-button px-4 py-2 text-sm"
        >
          💬 Chat Nu
        </button>
      </motion.div>

      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <div className="w-full bg-white/20 rounded-full h-2">
          <motion.div
            className="bg-white h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentSection + 1) / infoSections.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
            >
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-lisa-gradient rounded-2xl flex items-center justify-center">
                  <Icon className="w-8 h-8 text-white" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-3xl font-bold text-brand-navy text-center mb-6">
                {currentInfo.title}
              </h2>

              {/* Content */}
              <div className="mb-8">
                <StyledContent content={currentInfo.content} />
              </div>

              {/* CTA Button */}
              <div className="text-center mb-6">
                <motion.button
                  onClick={() => {
                    // Bepaal context op basis van sectie
                    let context: ChatContext = 'info';
                    if (currentInfo.id === 'what-are-leads') context = 'examples';
                    if (currentInfo.id === 'our-branches') context = 'branches';
                    if (currentInfo.id === 'pricing') context = 'pricing';
                    if (currentInfo.id === 'why-15-minutes') context = 'delivery';
                    if (currentInfo.id === 'success-stories') context = 'roi';
                    if (currentInfo.id === 'guarantee') context = 'quality';
                    onStartChat(context);
                  }}
                  className="chat-button inline-flex items-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChatBubbleLeftRightIcon className="w-5 h-5" />
                  <span>{currentInfo.cta}</span>
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
                  <span>Vorige</span>
                </button>

                <div className="flex space-x-2">
                  {infoSections.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSection(index)}
                      className={`
                        w-3 h-3 rounded-full transition-all duration-300
                        ${index === currentSection 
                          ? 'bg-brand-pink scale-125' 
                          : 'bg-gray-300 hover:bg-gray-400'
                        }
                      `}
                    />
                  ))}
                </div>

                <button
                  onClick={nextSection}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-brand-purple hover:bg-brand-purple/10 transition-all"
                >
                  <span>
                    {currentSection === infoSections.length - 1 ? 'Klaar' : 'Volgende'}
                  </span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Chat Button */}
      <motion.button
        onClick={() => onStartChat('info')}
        className="fixed bottom-6 right-6 w-16 h-16 bg-button-gradient rounded-full shadow-2xl flex items-center justify-center z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 200 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <ChatBubbleLeftRightIcon className="w-8 h-8 text-white" />
      </motion.button>

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
                <div className="w-16 h-16 bg-lisa-gradient rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <StarIcon className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-2xl font-bold text-brand-navy mb-4">
                  Geweldig! 🎉
                </h3>
                
                <p className="text-gray-600 mb-6">
                  U kent WarmeLeads nu goed. Klaar om uw eerste verse leads te krijgen?
                </p>
                
                <div className="space-y-3">
                  <motion.button
                    onClick={() => onStartChat('info')}
                    className="w-full chat-button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    💬 Ja, start chat met Lisa!
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
