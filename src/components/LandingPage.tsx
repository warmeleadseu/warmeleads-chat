'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  RocketLaunchIcon, 
  BookOpenIcon, 
  ChatBubbleBottomCenterTextIcon,
  UserIcon,
  CheckBadgeIcon,
  TrophyIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { Logo } from './Logo';
import { ContactCard } from './ContactCard';
import { SimpleValueCard } from './SimpleValueCard';
import { ChatContextManager } from '../lib/chatContext';
import { useAuthStore } from '../lib/auth';
import { OrderCheckoutModal } from './OrderCheckoutModal';

interface LandingPageProps {
  onPathSelect: (path: 'direct' | 'learn' | 'questions' | 'customer') => void;
}

export function LandingPage({ onPathSelect }: LandingPageProps) {
  const [visitorType, setVisitorType] = useState<'new' | 'returning' | 'customer'>('new');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const { user, isAuthenticated } = useAuthStore();

  const handleContactSelect = (method: 'phone' | 'email' | 'whatsapp') => {
    // Track contact method selection
    console.log('Contact method selected:', method);
    
    // Trigger appropriate action based on method
    switch (method) {
      case 'phone':
        // In production: trigger call request or redirect to phone
        window.open('tel:+31850477067', '_self');
        break;
      case 'email':
        // In production: open email client or contact form
        window.open('mailto:info@warmeleads.eu?subject=Interesse in WarmeLeads&body=Hoi,%0A%0AIk heb interesse in WarmeLeads en zou graag meer informatie ontvangen.%0A%0AMet vriendelijke groet', '_blank');
        break;
      case 'whatsapp':
        // In production: redirect to WhatsApp
        window.open('https://wa.me/31613927338?text=Hoi! Ik heb interesse in WarmeLeads en zou graag meer informatie ontvangen.', '_blank');
        break;
    }
  };

  const handleStartROIChat = () => {
    // Start ROI chat flow with proper context
    console.log('Starting ROI chat');
    // Set ROI context using the context manager
    ChatContextManager.setContext('roi');
    // Navigate to chat but DON'T call onPathSelect as it will override our context
    // Instead, we need to trigger the chat directly with ROI context
    window.location.href = '/?chat=roi';
  };

  useEffect(() => {
    // Detect visitor type based on authentication
    if (isAuthenticated && user) {
      if (user.isGuest) {
        setVisitorType('returning');
      } else {
        setVisitorType('customer');
      }
    } else {
      const hasVisited = localStorage.getItem('warmeleads_visited');
      if (hasVisited) {
        setVisitorType('returning');
      } else {
        setVisitorType('new');
        localStorage.setItem('warmeleads_visited', 'true');
      }
    }
  }, [isAuthenticated, user]);

  const getPersonalizedMessage = () => {
    if (isAuthenticated && user) {
      if (user.isGuest) {
        return {
          title: `Welkom, ${user.name}! 👋`,
          subtitle: "Uw gast sessie is actief - bestel leads of maak een account aan"
        };
      } else {
        // Echte klant
        const lastOrder = user.orders.length > 0 ? user.orders[user.orders.length - 1] : null;
        if (lastOrder) {
          return {
            title: `Welkom terug, ${user.name}! 👋`,
            subtitle: `Laatste bestelling: ${lastOrder.type} (${lastOrder.date}) - Klaar voor meer?`
          };
        } else {
          return {
            title: `Welkom terug, ${user.name}! 👋`,
            subtitle: "Uw account is klaar - bestel uw eerste leads!"
          };
        }
      }
    } else {
      // Niet ingelogd
      switch (visitorType) {
        case 'returning':
          return {
            title: "Fijn dat u terugkomt! 👋",
            subtitle: "Laten we verdergaan waar u was gebleven"
          };
        default:
          return {
            title: "Welkom bij WarmeLeads! 🚀",
            subtitle: "Koop exclusieve en gedeelde leads voor thuisbatterijen, zonnepanelen, warmtepompen, airco installatie en financial lease. Nederlandse prospects uit onze campagnes, realtime delivery in 15 minuten."
          };
      }
    }
  };

  const message = getPersonalizedMessage();

  const getPathOptions = () => {
    const baseOptions = [
      {
        id: 'direct',
        icon: RocketLaunchIcon,
        title: 'Direct leads bestellen',
        description: 'Ik weet wat ik wil - start de chat!',
        gradient: 'from-brand-pink to-brand-orange',
        delay: 0,
      },
      {
        id: 'learn',
        icon: BookOpenIcon,
        title: 'Eerst meer leren',
        description: 'Vertel me over WarmeLeads en jullie aanpak',
        gradient: 'from-brand-purple to-brand-pink',
        delay: 0.1,
      },
      {
        id: 'questions',
        icon: ChatBubbleBottomCenterTextIcon,
        title: 'Ik heb vragen',
        description: 'Specifieke vragen over leads en prijzen',
        gradient: 'from-brand-orange to-brand-red',
        delay: 0.2,
      },
    ];

    // Voeg klant optie toe op basis van login status
    if (isAuthenticated && user) {
      if (user.isGuest) {
        baseOptions.push({
          id: 'customer',
          icon: UserIcon,
          title: 'Gast Account',
          description: 'Bestellingen bekijken of account aanmaken',
          gradient: 'from-brand-red to-brand-purple',
          delay: 0.3,
        });
      } else {
        baseOptions.push({
          id: 'customer',
          icon: UserIcon,
          title: 'Klantportaal',
          description: 'Mijn bestellingen, account en support',
          gradient: 'from-brand-red to-brand-purple',
          delay: 0.3,
        });
      }
    } else {
      baseOptions.push({
        id: 'customer',
        icon: UserIcon,
        title: 'Ik ben al klant',
        description: 'Account, reorder of support',
        gradient: 'from-brand-red to-brand-purple',
        delay: 0.3,
      });
    }

    return baseOptions;
  };

  const pathOptions = getPathOptions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex flex-col justify-center items-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-brand-pink/20 rounded-full blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-orange/20 rounded-full blur-3xl"
          animate={{
            x: [0, -50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* SEO Hidden Content for Search Engines */}
      <div className="sr-only">
        <h1>Leads Kopen Nederland - Thuisbatterijen, Zonnepanelen, Warmtepompen, Airco, Financial Lease</h1>
        <p>WarmeLeads is dé specialist in verse leads voor de Nederlandse markt. Wij genereren exclusieve en gedeelde leads voor thuisbatterij installateurs, zonnepaneel bedrijven, warmtepomp specialisten, airco installateurs en financial lease adviseurs.</p>
        <p>Onze leadgeneratie service richt zich op Nederlandse prospects die actieve interesse hebben getoond in uw producten en diensten. Via onze campagnes op Google, Facebook en andere platformen bereiken wij huiseigenaren en bedrijven die op zoek zijn naar uw oplossingen.</p>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-4xl mx-auto text-center">
        {/* Header */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex justify-center mb-8">
            <Logo size="hero" showText={false} />
          </div>
          

          <motion.div
            className="text-lg text-white/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="text-2xl font-semibold mb-2">{message.title}</h2>
            <p>{message.subtitle}</p>
          </motion.div>
        </motion.div>

        {/* Path Selection */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {pathOptions.map((option) => {
            const Icon = option.icon;
            return (
              <motion.button
                key={option.id}
                onClick={() => {
                  if (option.id === 'gids') {
                    window.location.href = '/leadgeneratie-gids';
                  } else if (option.id === 'direct') {
                    // Open checkout modal directly
                    setShowCheckoutModal(true);
                  } else {
                    onPathSelect(option.id as any);
                  }
                }}
                className={`
                  relative p-8 rounded-2xl text-left overflow-hidden
                  bg-white/10 backdrop-blur-md border border-white/20
                  hover:bg-white/20 transition-all duration-300
                  group cursor-pointer
                `}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: option.delay, duration: 0.5 }}
                whileHover={{ 
                  scale: 1.02,
                  y: -4,
                }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Gradient Background */}
                <div className={`
                  absolute inset-0 bg-gradient-to-br ${option.gradient} opacity-0 
                  group-hover:opacity-20 transition-opacity duration-300
                `} />
                
                {/* Content */}
                <div className="relative z-10">
                  <div className="flex items-center mb-4">
                    <div className={`
                      w-12 h-12 rounded-xl bg-gradient-to-br ${option.gradient} 
                      flex items-center justify-center shadow-lg
                      group-hover:scale-110 transition-transform duration-300
                    `}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-white">
                    {option.title}
                  </h3>
                  
                  <p className="text-white/80 group-hover:text-white/90 transition-colors">
                    {option.description}
                  </p>

                  {/* Arrow */}
                  <motion.div
                    className="absolute top-6 right-6 text-white/60 group-hover:text-white"
                    initial={{ x: 0 }}
                    whileHover={{ x: 4 }}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </motion.div>
                </div>
              </motion.button>
            );
          })}

          {/* Smart Contact Card */}
          <ContactCard onContactSelect={handleContactSelect} />

          {/* Simple Value Calculator Card */}
          <SimpleValueCard onStartROIChat={handleStartROIChat} />
        </motion.div>

        {/* Trust Indicators & Contact Info */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center items-center gap-8 text-white/80">
            <div className="flex items-center space-x-2">
              <CheckBadgeIcon className="w-5 h-5 text-green-400" />
              <span className="text-sm">15.000+ leads geleverd</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <TrophyIcon className="w-5 h-5 text-yellow-400" />
              <span className="text-sm">98% klanttevredenheid</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <RocketLaunchIcon className="w-5 h-5 text-blue-400" />
              <span className="text-sm">Binnen 15 min geleverd</span>
            </div>
          </div>

          {/* Contact Information */}
          <div className="flex flex-wrap justify-center items-center gap-6 text-white/70">
            <a 
              href="tel:+31850477067"
              className="flex items-center space-x-2 hover:text-white transition-colors cursor-pointer"
            >
              <PhoneIcon className="w-4 h-4 text-green-400" />
              <span className="text-sm">+31 85 047 7067</span>
            </a>
            
            <a 
              href="mailto:info@warmeleads.eu"
              className="flex items-center space-x-2 hover:text-white transition-colors cursor-pointer"
            >
              <EnvelopeIcon className="w-4 h-4 text-blue-400" />
              <span className="text-sm">info@warmeleads.eu</span>
            </a>
            
            <a 
              href="https://wa.me/31613927338"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 hover:text-white transition-colors cursor-pointer"
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-green-500" />
              <span className="text-sm">+31 6 1392 7338</span>
            </a>
          </div>
        </motion.div>

        {/* Footer Navigation - Landing Pages */}
        <motion.div
          className="mt-16 bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <h3 className="text-2xl font-bold text-white mb-6 text-center">Branche-specifieke Leads</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <a 
              href="/leads-thuisbatterijen"
              className="text-center p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-all group"
            >
              <div className="text-3xl mb-2">🔋</div>
              <div className="text-white font-medium group-hover:text-yellow-300 transition-colors">Thuisbatterijen</div>
            </a>
            <a 
              href="/leads-zonnepanelen"
              className="text-center p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-all group"
            >
              <div className="text-3xl mb-2">☀️</div>
              <div className="text-white font-medium group-hover:text-yellow-300 transition-colors">Zonnepanelen</div>
            </a>
            <a 
              href="/leads-warmtepompen"
              className="text-center p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-all group"
            >
              <div className="text-3xl mb-2">🌡️</div>
              <div className="text-white font-medium group-hover:text-green-300 transition-colors">Warmtepompen</div>
            </a>
            <a 
              href="/leads-financial-lease"
              className="text-center p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-all group"
            >
              <div className="text-3xl mb-2">💼</div>
              <div className="text-white font-medium group-hover:text-blue-300 transition-colors">Financial Lease</div>
            </a>
            <a 
              href="/maatwerk-leads"
              className="text-center p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-all group"
            >
              <div className="text-3xl mb-2">🎯</div>
              <div className="text-white font-medium group-hover:text-purple-300 transition-colors">Maatwerk</div>
            </a>
          </div>
        </motion.div>

        {/* Quick Preview */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <p className="text-white/60 text-sm">
            🔒 Uw gegevens zijn veilig • 💰 Geen verborgen kosten • ⚡ Direct resultaat
          </p>
          <div className="mt-4 space-x-4">
            <a 
              href="/leadgeneratie-gids" 
              className="text-white/50 hover:text-white/80 text-xs underline transition-colors"
            >
              📖 Leadgeneratie gids
            </a>
            <span className="text-white/30">•</span>
            <a 
              href="/blog" 
              className="text-white/50 hover:text-white/80 text-xs underline transition-colors"
            >
              📝 Blog & Tips
            </a>
            <span className="text-white/30">•</span>
            <a 
              href="/algemene-voorwaarden" 
              className="text-white/50 hover:text-white/80 text-xs underline transition-colors"
            >
              📋 Algemene voorwaarden
            </a>
            <span className="text-white/30">•</span>
            <a 
              href="/privacyverklaring" 
              className="text-white/50 hover:text-white/80 text-xs underline transition-colors"
            >
              🔒 Privacyverklaring
            </a>
          </div>
          
          {/* Bedrijfsgegevens */}
          <div className="mt-6 pt-6 border-t border-white/20">
            <p className="text-white/50 text-xs">
              Warmeleads.eu • KvK: 88929280 • Stavangerweg 21-1, 9723 JC Groningen
            </p>
          </div>
        </motion.div>
      </div>


      {/* Order Checkout Modal */}
      <OrderCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        userEmail={user?.email || ''}
        userName={user?.name || ''}
        userCompany={user?.company}
        requireAuth={!isAuthenticated}
      />
    </div>
  );
}
