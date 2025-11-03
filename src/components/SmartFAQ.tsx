'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import { Logo } from './Logo';
import { type ChatContext } from '@/lib/chatContext';

interface SmartFAQProps {
  onBackToHome: () => void;
  onStartChat: (context: ChatContext) => void;
}

const faqData = [
  {
    category: 'Algemeen',
    questions: [
      {
        q: 'Wat maakt WarmeLeads anders dan andere leadgenerators?',
        a: 'Wij leveren binnen 15 minuten verse leads die maximaal 24 uur oud zijn. De meeste concurrenten verkopen leads die dagen of weken oud zijn, waardoor de conversiekans veel lager is.',
        chatPrompt: 'Vraag Lisa naar concrete voorbeelden',
        context: 'examples' as ChatContext as ChatContext
      },
      {
        q: 'Hoe werkt de lead delivery precies?',
        a: 'Wij genereren verse leads via onze campagnes op verschillende platformen. Deze echte geïnteresseerde prospects worden realtime (op kwartier nauwkeurig) ingeladen in uw persoonlijke dashboard zodra ze gegenereerd zijn. U krijgt complete contactgegevens, interesse niveau en beste contact moment.',
        chatPrompt: 'Chat over CRM integratie',
        context: 'delivery' as ChatContext as ChatContext
      },
      {
        q: 'Wat als ik niet tevreden ben met de leads?',
        a: 'Wij bieden 100% tevredenheidsgarantie. Slechte leads worden gratis vervangen of u krijgt uw geld terug. Onze kwaliteitscontrole zorgt ervoor dat dit zelden voorkomt.',
        chatPrompt: 'Meer over kwaliteitsgarantie',
        context: 'quality' as ChatContext as ChatContext
      }
    ]
  },
  {
    category: 'Prijzen & Pakketten',
    questions: [
      {
        q: 'Wat is het verschil tussen exclusieve en gedeelde leads?',
        a: 'Exclusieve leads zijn alleen voor u (hogere conversie, premium prijs). Gedeelde leads worden met maximaal 2 andere bedrijven gedeeld (1/3 van de prijs, nog steeds hoge kwaliteit).',
        chatPrompt: 'Help me kiezen tussen exclusief/gedeeld',
        context: 'pricing' as ChatContext
      },
      {
        q: 'Zijn er setup kosten of verborgen kosten?',
        a: 'Nee! U betaalt alleen voor de leads die u ontvangt. Geen setup kosten, geen maandelijkse abonnementen, geen verborgen kosten. Volledige transparantie.',
        chatPrompt: 'Bereken mijn totale investering',
        context: 'pricing' as ChatContext
      },
      {
        q: 'Kan ik ook kleinere aantallen bestellen?',
        a: 'Exclusieve leads vanaf 30 stuks. Gedeelde leads hebben een minimum van 500 stuks voor optimale prijs-kwaliteit verhouding. Voor maatwerk kunt u altijd contact opnemen.',
        chatPrompt: 'Vraag naar maatwerk opties',
        context: 'pricing' as ChatContext
      }
    ]
  },
  {
    category: 'Technisch',
    questions: [
      {
        q: 'Hoe integreren jullie met mijn CRM systeem?',
        a: 'Wij ondersteunen API integraties met HubSpot, Salesforce, Pipedrive en custom CRM systemen. Ook mogelijk via webhook, CSV export of direct email delivery.',
        chatPrompt: 'Setup CRM integratie',
        context: 'delivery' as ChatContext
      },
      {
        q: 'Hoe worden leads gegenereerd?',
        a: 'Via een combinatie van online marketing, partnerships en eigen data sources. Alle leads worden gescreend op interesse en kwaliteit voordat ze worden geleverd.',
        chatPrompt: 'Meer over lead kwaliteit',
        context: 'quality' as ChatContext
      },
      {
        q: 'Wat voor data krijg ik per lead?',
        a: 'Per lead ontvangt u: volledige naam, telefoonnummer, email, postcode, interesse niveau (1-10), beste contact moment en specifieke interesse punten.',
        chatPrompt: 'Bekijk voorbeeld lead',
        context: 'examples' as ChatContext
      }
    ]
  }
];

export function SmartFAQ({ onBackToHome, onStartChat }: SmartFAQProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
          <h1 className="text-white font-bold text-xl">Veelgestelde vragen</h1>
          <p className="text-white/60 text-sm">Of chat direct met Lisa</p>
        </div>
        
        <button
          onClick={() => onStartChat('faq')}
          className="chat-button px-4 py-2 text-sm"
        >
          💬 Chat Nu
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
        <div className="flex space-x-2 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`
              px-4 py-2 rounded-lg whitespace-nowrap transition-all
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
                px-4 py-2 rounded-lg whitespace-nowrap transition-all
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
      <div className="flex-1 p-4 space-y-4">
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
                transition={{ delay: index * 0.1 }}
              >
                <button
                  onClick={() => setExpandedQuestion(
                    expandedQuestion === `${category.category}-${index}` 
                      ? null 
                      : `${category.category}-${index}`
                  )}
                  className="w-full p-4 text-left flex items-center justify-between text-white hover:bg-white/10 transition-colors"
                >
                  <span className="font-medium">{faq.q}</span>
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
                        <p className="text-white/90 mb-4 leading-relaxed">
                          {faq.a}
                        </p>
                        
                        <motion.button
                          onClick={() => onStartChat(faq.context)}
                          className="inline-flex items-center space-x-2 text-sm bg-lisa-gradient text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <ChatBubbleLeftRightIcon className="w-4 h-4" />
                          <span>{faq.chatPrompt}</span>
                        </motion.button>
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
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-white font-semibold mb-2">
            Uw vraag er niet tussen?
          </h3>
          <p className="text-white/80 mb-4">
            Lisa beantwoordt al uw vragen persoonlijk en kan direct een offerte maken!
          </p>
          <motion.button
            onClick={() => onStartChat('faq')}
            className="chat-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            💬 Start Chat met Lisa
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
