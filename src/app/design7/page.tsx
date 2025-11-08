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
  CpuChipIcon,
  BoltIcon,
  SignalIcon
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
  glow: string;
};

export default function Design7Page() {
  const [visitorType, setVisitorType] = useState<'new' | 'returning' | 'customer'>('new');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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
          title: `Welkom terug, ${user.name}! ⚡`,
          subtitle: "Neural network actief - start met lead generatie"
        };
      } else {
        return {
          title: `Welkom terug, ${user.name}! 🚀`,
          subtitle: "AI-systeem online - toegang tot je lead intelligence"
        };
      }
    }

    if (visitorType === 'returning') {
      return {
        title: "Welkom terug! 🔄",
        subtitle: "AI heeft je herkend - ontdek nieuwe mogelijkheden"
      };
    }

    return {
      title: "AI-Powered Lead Intelligence 🤖",
      subtitle: "Machine learning voor perfect getimede, hoog-converterende leads"
    };
  };

  const getPathOptions = (): PathOption[] => {
    const baseOptions: PathOption[] = [
      {
        id: 'direct',
        title: 'Instant Launch',
        description: 'AI-geoptimaliseerde leads binnen 15 minuten geleverd',
        icon: BoltIcon,
        gradient: 'from-cyan-400 via-blue-500 to-purple-600',
        glow: 'shadow-cyan-500/50',
        delay: 0.1
      },
      {
        id: 'learn',
        title: 'AI Training',
        description: 'Leer hoe ons neurale netwerk werkt en resultaten optimaliseert',
        icon: CpuChipIcon,
        gradient: 'from-green-400 via-emerald-500 to-teal-600',
        glow: 'shadow-green-500/50',
        delay: 0.2
      },
      {
        id: 'questions',
        title: 'Smart FAQ',
        description: 'AI-gedreven antwoorden op al je vragen over leads en prijzen',
        icon: SignalIcon,
        gradient: 'from-purple-400 via-pink-500 to-rose-600',
        glow: 'shadow-purple-500/50',
        delay: 0.3
      },
      {
        id: 'customer',
        title: 'Neural Account',
        description: 'Maak verbinding met ons AI-systeem voor volledige toegang',
        icon: UserIcon,
        gradient: 'from-orange-400 via-red-500 to-pink-600',
        glow: 'shadow-orange-500/50',
        delay: 0.4
      }
    ];

    return baseOptions;
  };

  const message = getPersonalizedMessage();
  const pathOptions = getPathOptions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }} />
        </div>

        {/* Floating Particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-400/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2,
            }}
          />
        ))}

        {/* Mouse-following glow */}
        <motion.div
          className="absolute w-96 h-96 bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-full blur-3xl"
          animate={{
            x: mousePosition.x * 0.02 - 200,
            y: mousePosition.y * 0.02 - 200,
          }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
        />
      </div>

      {/* SEO Hidden Content */}
      <div className="sr-only">
        <h1>Leads Kopen Nederland - Thuisbatterijen, Zonnepanelen, Warmtepompen, Airco, Financial Lease</h1>
        <p>WarmeLeads is dé specialist in verse leads voor de Nederlandse markt. Wij genereren exclusieve en gedeelde leads voor thuisbatterij installateurs, zonnepaneel bedrijven, warmtepomp specialisten, airco installateurs en financial lease adviseurs.</p>
        <p>Onze leadgeneratie service richt zich op Nederlandse prospects die actieve interesse hebben getoond in uw producten en diensten. Via onze campagnes op Google, Facebook en andere platformen bereiken wij huiseigenaren en bedrijven die op zoek zijn naar uw oplossingen.</p>
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative z-50 bg-black/80 backdrop-blur-xl border-b border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <motion.div
                whileHover={{ rotate: 15, scale: 1.1 }}
                className="p-2"
              >
                <Logo />
              </motion.div>
              <span className="text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                WarmeLeads
              </span>
              <span className="text-xs bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent font-bold">
                AI
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <motion.a
                whileHover={{ scale: 1.05 }}
                href="#features"
                className="text-gray-300 hover:text-white transition-colors relative group font-medium"
              >
                Neural Network
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-400 group-hover:w-full transition-all duration-300" />
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.05 }}
                href="#pricing"
                className="text-gray-300 hover:text-white transition-colors relative group font-medium"
              >
                Intelligence
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-pink-400 group-hover:w-full transition-all duration-300" />
              </motion.a>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCheckoutModal(true)}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-6 py-2 rounded-full font-bold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300"
              >
                Neural Link
              </motion.button>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCheckoutModal(true)}
              className="md:hidden bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 rounded-full text-sm font-bold shadow-lg"
            >
              Link
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="inline-flex items-center bg-gradient-to-r from-cyan-900/50 to-blue-900/50 border border-cyan-500/30 px-6 py-3 rounded-full text-sm font-medium text-cyan-300 mb-8 backdrop-blur-sm"
            whileHover={{ scale: 1.05 }}
          >
            <CpuChipIcon className="w-4 h-4 mr-2 text-cyan-400" />
            Neural Network Active
          </motion.div>

          <motion.h1
            className="text-5xl lg:text-7xl font-bold mb-6 leading-tight bg-gradient-to-r from-white via-cyan-200 to-blue-200 bg-clip-text text-transparent"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            {message.title}
          </motion.h1>

          <motion.p
            className="text-xl lg:text-2xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {message.subtitle}
          </motion.p>
        </motion.div>

        {/* Path Selection */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20"
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
                  relative p-8 rounded-2xl text-left overflow-hidden
                  bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl
                  border border-white/10 hover:border-cyan-400/50
                  hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-500
                  group cursor-pointer
                `}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: option.delay, duration: 0.5 }}
                whileHover={{
                  y: -8,
                  scale: 1.02,
                }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Animated background glow */}
                <div className={`absolute inset-0 bg-gradient-to-br ${option.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

                {/* Floating elements */}
                <motion.div
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="absolute top-4 right-4 w-16 h-16 bg-white/5 rounded-full blur-sm"
                />

                {/* Content */}
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className={`
                      w-16 h-16 rounded-2xl bg-gradient-to-br ${option.gradient}
                      flex items-center justify-center shadow-2xl ${option.glow}
                      group-hover:scale-110 transition-all duration-300
                    `}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <motion.div
                      whileHover={{ x: 6 }}
                      className="text-cyan-400 group-hover:text-cyan-300"
                    >
                      <ArrowRightIcon className="w-6 h-6" />
                    </motion.div>
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-cyan-200 transition-colors">
                    {option.title}
                  </h3>

                  <p className="text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
                    {option.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Enhanced Cards Row */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 backdrop-blur-xl p-8 rounded-2xl border border-cyan-500/20 hover:border-cyan-400/50 transition-all duration-500"
          >
            <ContactCard onContactSelect={handleContactSelect} />
          </motion.div>

          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur-xl p-8 rounded-2xl border border-purple-500/20 hover:border-purple-400/50 transition-all duration-500"
          >
            <SimpleValueCard onStartROIChat={handleStartROIChat} />
          </motion.div>
        </motion.div>

        {/* AI Stats Dashboard */}
        <motion.div
          className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-3xl p-8 mb-20 border border-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Neural Network Statistics</h2>
            <p className="text-gray-400">Real-time AI performance metrics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center p-6 bg-gradient-to-br from-cyan-900/50 to-blue-900/50 rounded-2xl border border-cyan-500/30"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/25">
                <CheckBadgeIcon className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-bold text-white mb-2">15.000+</div>
              <div className="text-cyan-300 font-medium">Neural Links</div>
              <div className="text-sm text-gray-400 mt-1">AI-geoptimaliseerde leads</div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center p-6 bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-2xl border border-green-500/30"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/25">
                <TrophyIcon className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-bold text-white mb-2">98%</div>
              <div className="text-green-300 font-medium">AI Accuracy</div>
              <div className="text-sm text-gray-400 mt-1">Neural network precisie</div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center p-6 bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-2xl border border-purple-500/30"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/25">
                <BoltIcon className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-bold text-white mb-2">15min</div>
              <div className="text-purple-300 font-medium">Quantum Speed</div>
              <div className="text-sm text-gray-400 mt-1">Instant neural processing</div>
            </motion.div>
          </div>

          {/* Contact Matrix */}
          <div className="border-t border-white/10 pt-8">
            <h3 className="text-xl font-bold text-white text-center mb-6">Neural Contact Matrix</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.a
                whileHover={{ y: -4, scale: 1.02 }}
                href="tel:+31850477067"
                className="flex items-center space-x-4 p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl border border-green-500/20 hover:border-green-400/50 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-500 rounded-lg flex items-center justify-center">
                  <PhoneIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-white">Voice Neural Link</div>
                  <div className="text-sm text-green-300">+31 85 047 7067</div>
                </div>
              </motion.a>

              <motion.a
                whileHover={{ y: -4, scale: 1.02 }}
                href="mailto:info@warmeleads.eu"
                className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-xl border border-blue-500/20 hover:border-blue-400/50 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center">
                  <EnvelopeIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-white">Digital Neural Link</div>
                  <div className="text-sm text-blue-300">info@warmeleads.eu</div>
                </div>
              </motion.a>

              <motion.a
                whileHover={{ y: -4, scale: 1.02 }}
                href="https://wa.me/31613927338"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-4 p-4 bg-gradient-to-r from-green-900/30 to-teal-900/30 rounded-xl border border-green-500/20 hover:border-green-400/50 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-teal-500 rounded-lg flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-white">Quantum Neural Link</div>
                  <div className="text-sm text-green-300">WhatsApp Intelligence</div>
                </div>
              </motion.a>
            </div>
          </div>
        </motion.div>

        {/* Final CTA */}
        <motion.div
          className="text-center bg-gradient-to-r from-cyan-900 via-blue-900 to-purple-900 rounded-3xl p-12 border border-cyan-500/20"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <motion.div
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "linear",
            }}
            className="inline-block mb-6"
          >
            <div className="text-6xl mb-4">🚀</div>
          </motion.div>

          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6 bg-gradient-to-r from-white via-cyan-200 to-blue-200 bg-clip-text text-transparent">
            Join the Neural Revolution
          </h2>
          <p className="text-xl text-cyan-100 mb-8 max-w-3xl mx-auto">
            Sluit je aan bij de toekomst van lead generatie. AI-powered, quantum-speed, enterprise-grade intelligence.
          </p>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCheckoutModal(true)}
            className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:via-blue-400 hover:to-purple-500 px-12 py-5 rounded-full font-bold text-xl text-white shadow-2xl shadow-cyan-500/30 transition-all duration-300"
          >
            Activate Neural Link
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
      <footer className="relative z-10 bg-black border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <Logo />
              <span className="text-xl font-bold text-white">WarmeLeads</span>
              <span className="text-xs bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent font-bold">
                AI
              </span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400 text-sm">© 2025 WarmeLeads Neural Network. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
