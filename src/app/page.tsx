'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChatInterface } from '@/components/ChatInterface';
import { LandingPage } from '@/components/LandingPage';
import { InfoJourney } from '@/components/InfoJourney';
import { SmartFAQ } from '@/components/SmartFAQ';
import { CustomerPortal } from '@/components/CustomerPortal';
import { LoginForm } from '@/components/LoginForm';
import { GuestLogin } from '@/components/GuestLogin';
import { AccountCreation } from '@/components/AccountCreation';
import { PWAInstaller } from '@/components/PWAInstaller';
import { useAuthStore } from '@/lib/auth';
import { ChatContextManager, type ChatContext } from '@/lib/chatContext';

type PageState = 'landing' | 'chat' | 'info' | 'faq' | 'customer' | 'login' | 'guest' | 'account-creation';

export default function HomePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageState>('landing');
  const { user, isAuthenticated, init } = useAuthStore();

  useEffect(() => {
    // Initialize auth state from localStorage
    init();
    setIsLoaded(true);
    
    console.log('🏠 Homepage: Loaded, auth state:', { 
      isAuthenticated, 
      userEmail: user?.email,
      isLoading: false 
    });
    
    // Check for URL parameters to set chat context or show login
    const urlParams = new URLSearchParams(window.location.search);
    const chatParam = urlParams.get('chat');
    const loginParam = urlParams.get('login');
    
    if (chatParam === 'roi') {
      // Set ROI context and go to chat
      ChatContextManager.setContext('roi');
      setCurrentPage('chat');
    } else if (loginParam === 'true') {
      // Show login screen (e.g. after logout)
      console.log('🔐 Showing login screen from URL parameter');
      setCurrentPage('login');
      // Clean URL
      window.history.replaceState({}, '', '/');
    }
  }, [init]);

  // Note: Removed auto-redirect to portal - users should be able to visit homepage while logged in

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex items-center justify-center">
        <motion.div
          className="flex flex-col items-center space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Loading Logo */}
          <motion.div
            className="w-16 h-16 bg-lisa-gradient rounded-full flex items-center justify-center"
            animate={{
              rotate: 360,
              scale: [1, 1.1, 1],
            }}
            transition={{
              rotate: {
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              },
              scale: {
                duration: 1,
                repeat: Infinity,
                ease: 'easeInOut',
              },
            }}
          >
            <span className="text-white font-bold text-2xl">W</span>
          </motion.div>

          {/* Loading Text */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-white text-xl font-semibold mb-2">WarmeLeads</h2>
            <p className="text-white/80">Lisa wordt voor u klaargemaakt...</p>
          </motion.div>

          {/* Loading Dots */}
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-brand-pink rounded-full"
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  const handlePathSelect = (path: 'direct' | 'learn' | 'questions' | 'customer') => {
    switch (path) {
      case 'direct':
        // Set correct context for direct leads ordering
        ChatContextManager.setContext('direct');
        setCurrentPage('chat');
        break;
      case 'learn':
        setCurrentPage('info');
        break;
      case 'questions':
        setCurrentPage('faq');
        break;
      case 'customer':
        if (isAuthenticated) {
          setCurrentPage('customer');
        } else {
          setCurrentPage('login');
        }
        break;
    }
  };

  const handleLoginSuccess = () => {
    window.location.href = '/portal';
  };

  const handleGuestSuccess = () => {
    setCurrentPage('chat');
  };

  const handleAccountCreationSuccess = () => {
    window.location.href = '/portal';
  };

  const handleBackToHome = () => {
    setCurrentPage('landing');
  };

  const handleStartChat = (context?: ChatContext) => {
    // Store the context for the chat using the new context manager
    if (context) {
      ChatContextManager.setContext(context);
    } else {
      // Default to direct context if none provided
      ChatContextManager.setContext('direct');
        console.log('Geen context meegegeven, fallback naar direct');
    }
    setCurrentPage('chat');
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'landing':
        return <LandingPage onPathSelect={handlePathSelect} />;
      case 'chat':
        // Get context from the context manager
        const chatContext = ChatContextManager.getContext();
        return <ChatInterface entryPoint={chatContext} onBackToHome={handleBackToHome} onShowAccountCreation={() => setCurrentPage('account-creation')} />;
      case 'info':
        return <InfoJourney onBackToHome={handleBackToHome} onStartChat={(context: ChatContext) => handleStartChat(context)} />;
      case 'faq':
        return <SmartFAQ onBackToHome={handleBackToHome} onStartChat={(context) => handleStartChat(context)} />;
      case 'customer':
        return <CustomerPortal onBackToHome={handleBackToHome} onStartChat={() => handleStartChat('customer')} />;
      case 'login':
        return (
          <LoginForm
            onBack={handleBackToHome}
            onSwitchToRegister={() => {/* TODO: Switch to register mode */}}
            onSwitchToGuest={() => setCurrentPage('guest')}
            onSuccess={handleLoginSuccess}
          />
        );
      case 'guest':
        return (
          <GuestLogin
            onBack={() => setCurrentPage('login')}
            onSuccess={handleGuestSuccess}
          />
        );
      case 'account-creation':
        return (
          <AccountCreation
            onSuccess={handleAccountCreationSuccess}
            onSkip={handleBackToHome}
          />
        );
      default:
        return <LandingPage onPathSelect={handlePathSelect} />;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* Main Content */}
      <div className="relative z-10">
        {renderCurrentPage()}
      </div>

      {/* PWA Installer */}
      <PWAInstaller />


    </main>
  );
}