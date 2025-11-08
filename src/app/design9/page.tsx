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
  CalculatorIcon,
  MagnifyingGlassIcon,
  CursorArrowRaysIcon,
  BoltIcon
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
  targetColor: string;
};

export default function Design9Page() {
  const [visitorType, setVisitorType] = useState<'new' | 'returning' | 'customer'>('new');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [targetedElement, setTargetedElement] = useState<string | null>(null);
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
          title: `WELCOME BACK, ${user.name.toUpperCase()}!`,
          subtitle: "TARGET LOCKED - Your guest session is active. Ready to strike?"
        };
      } else {
        // Echte klant
        const lastOrder = user.orders?.length > 0 ? user.orders[user.orders.length - 1] : null;
        if (lastOrder) {
          return {
            title: `COMMANDER ${user.name.toUpperCase()}!`,
            subtitle: `LAST MISSION: ${lastOrder.type?.toUpperCase()} - Ready for another precision strike?`
          };
        } else {
          return {
            title: `COMMANDER ${user.name.toUpperCase()}!`,
            subtitle: "TARGETS ACQUIRED - Your command center is ready. Launch your first strike!"
          };
        }
      }
    } else {
      // Niet ingelogd
      switch (visitorType) {
        case 'returning':
          return {
            title: "TARGET RECONNECTED!",
            subtitle: "Precision targeting system online. Ready to resume mission?"
          };
        default:
          return {
            title: "PRECISION LEAD STRIKES!",
            subtitle: "Military-grade lead generation for installers. Dutch & Belgian prospects with confirmed purchase intent. Exclusive targeting, real-time delivery, maximum conversion."
          };
      }
    }
  };

  const getPathOptions = (): PathOption[] => {
    const baseOptions: PathOption[] = [
      {
        id: 'direct',
        title: 'DIRECT STRIKE',
        description: 'Immediate deployment of precision-targeted leads',
        icon: BoltIcon,
        gradient: 'from-red-500 to-red-600',
        targetColor: 'border-red-500',
        delay: 0.1
      },
      {
        id: 'learn',
        title: 'MISSION BRIEFING',
        description: 'Complete intel on WarmeLeads precision targeting',
        icon: BookOpenIcon,
        gradient: 'from-blue-600 to-blue-700',
        targetColor: 'border-blue-500',
        delay: 0.2
      },
      {
        id: 'questions',
        title: 'INTEL REQUEST',
        description: 'Classified information on leads and strike packages',
        icon: ChatBubbleBottomCenterTextIcon,
        gradient: 'from-slate-600 to-slate-700',
        targetColor: 'border-slate-500',
        delay: 0.3
      },
      {
        id: 'customer',
        title: 'COMMAND CENTER',
        description: 'Access your mission control and strike history',
        icon: UserIcon,
        gradient: 'from-slate-700 to-slate-800',
        targetColor: 'border-slate-500',
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
      <nav className="bg-white border-b-2 border-slate-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-slate-900 p-3 rounded-lg"
              >
                <Logo size="md" />
              </motion.div>
              <span className="text-2xl font-black text-slate-900 tracking-tight">WARMLEADS</span>
              <span className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold tracking-wider">STRIKE FORCE</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <motion.a
                whileHover={{ scale: 1.05 }}
                href="#mission"
                className="text-slate-700 hover:text-slate-900 font-semibold uppercase tracking-wide text-sm relative group"
              >
                Mission
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-500 group-hover:w-full transition-all duration-300" />
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.05 }}
                href="#intel"
                className="text-slate-700 hover:text-slate-900 font-semibold uppercase tracking-wide text-sm relative group"
              >
                Intel
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-500 group-hover:w-full transition-all duration-300" />
              </motion.a>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCheckoutModal(true)}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 font-bold uppercase tracking-wide text-sm border-2 border-red-500 hover:border-red-600 transition-all duration-200"
              >
                Launch Strike
              </motion.button>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCheckoutModal(true)}
              className="md:hidden bg-red-500 text-white px-4 py-2 font-bold uppercase text-sm border-2 border-red-500"
            >
              STRIKE
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex justify-center mb-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="relative bg-slate-900 p-8 rounded-2xl border-4 border-slate-800 shadow-2xl"
            >
              {/* Target crosshairs around logo */}
              <div className="absolute -top-2 -left-2 w-4 h-4 border-2 border-red-500 rounded-full"></div>
              <div className="absolute -top-2 -right-2 w-4 h-4 border-2 border-red-500 rounded-full"></div>
              <div className="absolute -bottom-2 -left-2 w-4 h-4 border-2 border-red-500 rounded-full"></div>
              <div className="absolute -bottom-2 -right-2 w-4 h-4 border-2 border-red-500 rounded-full"></div>
              <Logo size="xl" showText={false} />
            </motion.div>
          </div>

          <motion.div
            className="text-slate-700"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-5xl lg:text-7xl font-black text-slate-900 mb-6 tracking-tight leading-none">
              {message.title}
            </h1>
            <p className="text-xl text-slate-600 max-w-4xl mx-auto leading-relaxed">
              {message.subtitle}
            </p>
          </motion.div>
        </motion.div>

        {/* Path Selection - Precision Strike Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {pathOptions.map((option) => {
            const Icon = option.icon;
            return (
              <motion.div
                key={option.id}
                className="relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: option.delay, duration: 0.5 }}
                onHoverStart={() => setTargetedElement(option.id)}
                onHoverEnd={() => setTargetedElement(null)}
              >
                <motion.button
                  onClick={() => {
                    if (option.id === 'direct') {
                      setShowCheckoutModal(true);
                    } else {
                      handlePathSelect(option.id as any);
                    }
                  }}
                  className={`
                    relative w-full p-8 text-left overflow-hidden
                    bg-white border-4 border-slate-900 hover:border-red-500
                    transition-all duration-300 cursor-pointer
                    group shadow-lg hover:shadow-2xl
                  `}
                  whileHover={{
                    y: -8,
                    scale: 1.02,
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Target crosshair effect on hover */}
                  {targetedElement === option.id && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {/* Horizontal line */}
                      <div className="absolute top-1/2 left-0 right-0 h-1 bg-red-500 transform -translate-y-1/2"></div>
                      {/* Vertical line */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-red-500 transform -translate-x-1/2"></div>
                      {/* Center dot */}
                      <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 border-2 border-white"></div>
                    </motion.div>
                  )}

                  {/* Content */}
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-6">
                      <div className={`
                        w-16 h-16 rounded-lg bg-gradient-to-br ${option.gradient}
                        flex items-center justify-center shadow-lg border-2 border-slate-900
                        group-hover:scale-110 transition-all duration-300
                      `}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <motion.div
                        whileHover={{ x: 6 }}
                        className="text-slate-600 group-hover:text-red-500"
                      >
                        <ArrowRightIcon className="w-6 h-6" />
                      </motion.div>
                    </div>

                    <h3 className="text-2xl font-black text-slate-900 mb-3 group-hover:text-red-600 transition-colors uppercase tracking-tight">
                      {option.title}
                    </h3>

                    <p className="text-slate-600 group-hover:text-slate-700 transition-colors leading-relaxed font-medium">
                      {option.description}
                    </p>
                  </div>
                </motion.button>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Strike Zone Cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="bg-white p-8 rounded-lg border-4 border-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300"
          >
            <ContactCard onContactSelect={handleContactSelect} />
          </motion.div>

          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="bg-white p-8 rounded-lg border-4 border-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300"
          >
            <SimpleValueCard onStartROIChat={handleStartROIChat} />
          </motion.div>
        </motion.div>

        {/* Precision Metrics Dashboard */}
        <motion.div
          className="bg-slate-900 text-white rounded-2xl p-8 mb-20 border-4 border-red-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="text-center mb-8">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="inline-block mb-4"
            >
              <MagnifyingGlassIcon className="w-12 h-12 text-red-500" />
            </motion.div>
            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Strike Force Metrics</h2>
            <p className="text-slate-300 font-medium">Real-time precision targeting data</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center p-6 bg-white/10 rounded-lg border-2 border-red-500/30"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4 border-2 border-white">
                <CheckBadgeIcon className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-black text-white mb-2">15.000+</div>
              <div className="text-red-300 font-bold uppercase tracking-wide text-sm">Precision Strikes</div>
              <div className="text-slate-400 mt-1 text-xs uppercase">Targeted Leads Deployed</div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center p-6 bg-white/10 rounded-lg border-2 border-red-500/30"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4 border-2 border-white">
                <TrophyIcon className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-black text-white mb-2">98%</div>
              <div className="text-red-300 font-bold uppercase tracking-wide text-sm">Strike Accuracy</div>
              <div className="text-slate-400 mt-1 text-xs uppercase">Mission Success Rate</div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center p-6 bg-white/10 rounded-lg border-2 border-red-500/30"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4 border-2 border-white">
                <BoltIcon className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-black text-white mb-2">15min</div>
              <div className="text-red-300 font-bold uppercase tracking-wide text-sm">Strike Speed</div>
              <div className="text-slate-400 mt-1 text-xs uppercase">Rapid Deployment Time</div>
            </motion.div>
          </div>

          {/* Contact Command Center */}
          <div className="border-t-2 border-red-500/30 pt-8">
            <h3 className="text-xl font-bold text-white text-center mb-6 uppercase tracking-tight">Command Center Links</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.a
                whileHover={{ y: -4, scale: 1.02 }}
                href="tel:+31850477067"
                className="flex items-center space-x-4 p-4 bg-white/10 rounded-lg border-2 border-red-500/20 hover:border-red-500 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center border-2 border-white">
                  <PhoneIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-white uppercase tracking-wide text-sm">Voice Strike</div>
                  <div className="text-red-300 font-medium">+31 85 047 7067</div>
                </div>
              </motion.a>

              <motion.a
                whileHover={{ y: -4, scale: 1.02 }}
                href="mailto:info@warmeleads.eu"
                className="flex items-center space-x-4 p-4 bg-white/10 rounded-lg border-2 border-red-500/20 hover:border-red-500 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center border-2 border-white">
                  <EnvelopeIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-white uppercase tracking-wide text-sm">Intel Drop</div>
                  <div className="text-red-300 font-medium">info@warmeleads.eu</div>
                </div>
              </motion.a>

              <motion.a
                whileHover={{ y: -4, scale: 1.02 }}
                href="https://wa.me/31613927338"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-4 p-4 bg-white/10 rounded-lg border-2 border-red-500/20 hover:border-red-500 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center border-2 border-white">
                  <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-white uppercase tracking-wide text-sm">Secure Channel</div>
                  <div className="text-red-300 font-medium">WhatsApp Intel</div>
                </div>
              </motion.a>
            </div>
          </div>
        </motion.div>

        {/* Final Strike CTA */}
        <motion.div
          className="text-center bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-12 text-white border-4 border-red-500"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="text-6xl mb-4"
          >
            🎯
          </motion.div>
          <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 uppercase tracking-tight">
            Ready for Precision Strike?
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto font-medium">
            Join the elite force of installers using military-grade lead targeting. Lock onto your targets, deploy with precision, achieve maximum conversion.
          </p>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCheckoutModal(true)}
            className="bg-red-500 hover:bg-red-600 text-white px-12 py-5 rounded-lg font-black text-xl uppercase tracking-wide border-4 border-red-500 hover:border-red-600 transition-all duration-300 shadow-2xl shadow-red-500/30"
          >
            Launch Strike Force
            <RocketLaunchIcon className="w-6 h-6 ml-3 inline" />
          </motion.button>
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
      <footer className="bg-slate-900 text-white py-12 mt-20 border-t-4 border-red-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <Logo />
              <span className="text-xl font-black text-white uppercase tracking-tight">WarmeLeads</span>
              <span className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold tracking-wider">STRIKE FORCE</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-slate-400 text-sm font-medium">© 2025 WarmeLeads Strike Force. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
