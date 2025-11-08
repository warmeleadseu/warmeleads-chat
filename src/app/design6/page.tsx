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
  ChatBubbleLeftRightIcon,
  ArrowRightIcon,
  CalculatorIcon
} from '@heroicons/react/24/outline';
import { Logo } from '../../components/Logo';
import { ContactCard } from '../../components/ContactCard';
import { SimpleValueCard } from '../../components/SimpleValueCard';
import { ChatContextManager } from '../../lib/chatContext';
import { useAuthStore } from '../../lib/auth';
import { OrderCheckoutModal } from '../../components/OrderCheckoutModal';

type PathOption = {
  id: string;
  title: string;
  description: string;
  icon: any;
  gradient: string;
  delay: number;
};

export default function Design6Page() {
  const [visitorType, setVisitorType] = useState<'new' | 'returning' | 'customer'>('new');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const { user, isAuthenticated } = useAuthStore();

  const handleContactSelect = (method: 'phone' | 'email' | 'whatsapp') => {
    console.log('Contact method selected:', method);

    switch (method) {
      case 'phone':
        window.open('tel:+31850477067', '_self');
        break;
      case 'email':
        window.open('mailto:info@warmeleads.eu?subject=Interesse in WarmeLeads&body=Hoi,%0A%0AIk heb interesse in WarmeLeads en zou graag meer informatie ontvangen.%0A%0AMet vriendelijke groet', '_blank');
        break;
      case 'whatsapp':
        window.open('https://wa.me/31613927338?text=Hoi! Ik heb interesse in WarmeLeads en zou graag meer informatie ontvangen.', '_blank');
        break;
    }
  };

  const handleStartROIChat = () => {
    console.log('Starting ROI chat');
    ChatContextManager.setContext('roi');
    window.location.href = '/?chat=roi';
  };

  const handlePathSelect = (path: 'direct' | 'learn' | 'questions' | 'customer') => {
    // This would normally navigate to different sections
    console.log('Path selected:', path);
  };

  useEffect(() => {
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

  useEffect(() => {
    const handleOpenOrderModal = () => {
      setShowCheckoutModal(true);
    };

    window.addEventListener('openOrderModal', handleOpenOrderModal);

    return () => {
      window.removeEventListener('openOrderModal', handleOpenOrderModal);
    };
  }, []);

  const getPersonalizedMessage = () => {
    if (isAuthenticated && user) {
      if (user.isGuest) {
        return {
          title: `Welkom terug, ${user.name}! 👋`,
          subtitle: "Uw gast sessie is actief - bestel leads of maak een account aan"
        };
      } else {
        return {
          title: `Welkom terug, ${user.name}! 👋`,
          subtitle: "Ga naar uw portaal voor leads en accountbeheer"
        };
      }
    }

    if (visitorType === 'returning') {
      return {
        title: "Welkom terug! 👋",
        subtitle: "Ontdek de nieuwste mogelijkheden voor uw lead generatie"
      };
    }

    return {
      title: "Dé specialist in verse leads 🏆",
      subtitle: "Meer dan 500 installateurs vertrouwen dagelijks op onze exclusieve leads"
    };
  };

  const getPathOptions = (): PathOption[] => {
    const baseOptions: PathOption[] = [
      {
        id: 'direct',
        title: 'Direct bestellen',
        description: 'Start direct met verse leads binnen 15 minuten',
        icon: RocketLaunchIcon,
        gradient: 'from-blue-600 to-blue-700',
        delay: 0.1
      },
      {
        id: 'learn',
        title: 'Meer leren',
        description: 'Ontdek hoe ons systeem werkt en wat het oplevert',
        icon: BookOpenIcon,
        gradient: 'from-green-600 to-green-700',
        delay: 0.2
      },
      {
        id: 'questions',
        title: 'Vragen?',
        description: 'Alle antwoorden op uw vragen over leads en prijzen',
        icon: ChatBubbleBottomCenterTextIcon,
        gradient: 'from-purple-600 to-purple-700',
        delay: 0.3
      },
      {
        id: 'customer',
        title: 'Klant worden',
        description: 'Maak een account aan voor volledige toegang',
        icon: UserIcon,
        gradient: 'from-orange-600 to-orange-700',
        delay: 0.4
      }
    ];

    return baseOptions;
  };

  const message = getPersonalizedMessage();
  const pathOptions = getPathOptions();

  return (
    <div className="min-h-screen bg-white">
      {/* SEO Hidden Content */}
      <div className="sr-only">
        <h1>Leads Kopen Nederland - Thuisbatterijen, Zonnepanelen, Warmtepompen, Airco, Financial Lease</h1>
        <p>WarmeLeads is dé specialist in verse leads voor de Nederlandse markt. Wij genereren exclusieve en gedeelde leads voor thuisbatterij installateurs, zonnepaneel bedrijven, warmtepomp specialisten, airco installateurs en financial lease adviseurs.</p>
        <p>Onze leadgeneratie service richt zich op Nederlandse prospects die actieve interesse hebben getoond in uw producten en diensten. Via onze campagnes op Google, Facebook en andere platformen bereiken wij huiseigenaren en bedrijven die op zoek zijn naar uw oplossingen.</p>
      </div>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Logo />
              <span className="text-2xl font-bold text-gray-900">WarmeLeads</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Functionaliteiten</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Prijzen</a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Contact</a>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                Start Nu
              </button>
            </div>
            <button className="md:hidden bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Start
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex justify-center mb-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-gray-50 p-6 rounded-2xl border border-gray-200"
            >
              <Logo size="xl" showText={false} />
            </motion.div>
          </div>

          <motion.div
            className="text-lg text-gray-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">{message.title}</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">{message.subtitle}</p>
          </motion.div>
        </motion.div>

        {/* Path Selection */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16"
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
                  if (option.id === 'direct') {
                    setShowCheckoutModal(true);
                  } else {
                    handlePathSelect(option.id as any);
                  }
                }}
                className={`
                  relative p-8 rounded-xl text-left overflow-hidden
                  bg-white border-2 border-gray-100 hover:border-blue-200
                  hover:shadow-lg transition-all duration-300
                  group cursor-pointer
                `}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: option.delay, duration: 0.5 }}
                whileHover={{
                  y: -4,
                  scale: 1.02
                }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Content */}
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`
                      w-14 h-14 rounded-xl bg-gradient-to-br ${option.gradient}
                      flex items-center justify-center shadow-lg
                      group-hover:scale-110 transition-transform duration-300
                    `}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <ArrowRightIcon className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                    {option.title}
                  </h3>

                  <p className="text-gray-600 group-hover:text-gray-700 transition-colors leading-relaxed">
                    {option.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Additional Cards Row */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <motion.div
            whileHover={{ y: -4 }}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-100"
          >
            <ContactCard onContactSelect={handleContactSelect} />
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-xl border border-green-100"
          >
            <SimpleValueCard onStartROIChat={handleStartROIChat} />
          </motion.div>
        </motion.div>

        {/* Stats & Trust Section */}
        <motion.div
          className="bg-gray-50 rounded-2xl p-8 mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckBadgeIcon className="w-8 h-8 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">15.000+</div>
              <div className="text-gray-600">Leads geleverd</div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrophyIcon className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">98%</div>
              <div className="text-gray-600">Klanttevredenheid</div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <RocketLaunchIcon className="w-8 h-8 text-purple-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">15 min</div>
              <div className="text-gray-600">Gemiddelde levertijd</div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-xl font-bold text-gray-900 text-center mb-6">Direct contact</h3>
            <div className="flex flex-wrap justify-center items-center gap-8">
              <a
                href="tel:+31850477067"
                className="flex items-center space-x-3 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <PhoneIcon className="w-5 h-5 text-green-600" />
                </div>
                <span className="font-medium">+31 85 047 7067</span>
              </a>

              <a
                href="mailto:info@warmeleads.eu"
                className="flex items-center space-x-3 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <EnvelopeIcon className="w-5 h-5 text-blue-600" />
                </div>
                <span className="font-medium">info@warmeleads.eu</span>
              </a>

              <a
                href="https://wa.me/31613927338"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-3 text-gray-600 hover:text-green-600 transition-colors"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-green-600" />
                </div>
                <span className="font-medium">WhatsApp</span>
              </a>
            </div>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          className="text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <h2 className="text-3xl font-bold mb-4">Klaar om te starten?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Sluit je aan bij meer dan 500 installateurs die dagelijks verse leads ontvangen.
          </p>
          <button
            onClick={() => setShowCheckoutModal(true)}
            className="bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Start Gratis Trial
            <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
          </button>
        </motion.div>
      </div>

      {/* Order Checkout Modal */}
      <OrderCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        userEmail={user?.email || ''}
        userName={user?.name || ''}
        userCompany={user?.company}
        userPermissions={user?.permissions}
      />

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <Logo />
              <span className="text-xl font-bold">WarmeLeads</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400 text-sm">© 2025 WarmeLeads. Alle rechten voorbehouden.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
