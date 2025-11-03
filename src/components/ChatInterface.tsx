'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { ChatButton } from './ChatButton';
import { TextInput } from './TextInput';
import { ContactForm } from './ContactForm';
import { ROICalculator } from './ROICalculator';
import { StripeCheckout } from './StripeCheckout';
import { Logo } from './Logo';
import { useChatStore } from '@/store/chatStore';
import { getNextMessage } from '@/lib/chatLogic';
import { ChatContextManager, type ChatContext } from '@/lib/chatContext';
import { calculateOrderTotal } from '@/lib/pricing';
import { chatLogger } from '@/lib/logger';
import { useAuthStore } from '@/lib/auth';
import { crmSystem, createOrUpdateCustomer, createOpenInvoice, logChatMessage } from '@/lib/crmSystem';
import { emitChatStarted, emitChatMessage } from '@/lib/realtimeEvents';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface Message {
  id: string;
  type: 'lisa' | 'user';
  content: string;
  timestamp: Date;
  options?: string[];
}

interface ChatInterfaceProps {
  entryPoint?: ChatContext;
  onBackToHome?: () => void;
  onShowAccountCreation?: () => void;
}

export function ChatInterface({ entryPoint = 'direct', onBackToHome, onShowAccountCreation }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentStep, setCurrentStep] = useState('welcome');
  const [showStripeCheckout, setShowStripeCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'ideal' | 'card'>('ideal');
  const [lastSelectedQuantity, setLastSelectedQuantity] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const { userProfile, updateProfile } = useChatStore();
  const { user, isAuthenticated } = useAuthStore();

  // Track the last selected quantity directly
  const getLastSelectedQuantity = () => {
    return lastSelectedQuantity;
  };

  // Helper function to manage timers with automatic cleanup
  const setTimerWithCleanup = (callback: () => void, delay: number): NodeJS.Timeout => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);
    timersRef.current.add(timer);
    return timer;
  };

  // Use the centralized pricing calculator

  const scrollToBottom = () => {
    setTimerWithCleanup(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStep, showStripeCheckout]);

  // Auto-scroll when special components are shown
  useEffect(() => {
    if (currentStep === 'express_contact_details' || currentStep === 'roi_calculator') {
      scrollToBottom();
    }
  }, [currentStep]);

  useEffect(() => {
    let isMounted = true;

    // NUCLEAR FIX: Clear any bad persisted quantity data
    if (userProfile.quantity === '100 leads') {
      updateProfile({ quantity: undefined });
    }

    // Get context configuration from the context manager
    const contextConfig = ChatContextManager.getContextConfig(entryPoint);
    chatLogger.debug('ChatInterface starting', { entryPoint, contextConfig });

    // Lisa's welkomstbericht
    const welcomeMessage: Message = {
      id: `welcome-${Date.now()}`,
      type: 'lisa',
      content: contextConfig.welcomeMessage,
      timestamp: new Date(),
    };

    setMessages([welcomeMessage]);

    // Emit chat started event for realtime monitoring with unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const anonymousEmail = `anonymous_${sessionId}@temp.warmeleads.eu`;
    
    // Store session ID for tracking
    localStorage.setItem('warmeleads_session_id', sessionId);
    localStorage.setItem('warmeleads_session_email', anonymousEmail);
    
    emitChatStarted(anonymousEmail, userProfile.industry || 'Onbekend');

    // Log welcome message if customer email is known
    if (userProfile.contactInfo?.email) {
      logChatMessage(userProfile.contactInfo.email, {
        id: welcomeMessage.id,
        type: welcomeMessage.type,
        content: welcomeMessage.content,
        timestamp: welcomeMessage.timestamp,
        step: 'welcome'
      });
    }

    // Tweede bericht na korte delay
    const timer1 = setTimerWithCleanup(() => {
      if (!isMounted) return;
      setIsTyping(true);
      
      setTimerWithCleanup(() => {
        if (!isMounted) return;
        setIsTyping(false);
        const secondMessage: Message = {
          id: `intro-${Date.now()}`,
          type: 'lisa',
          content: contextConfig.introMessage,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, secondMessage]);

        // Vraag na nog een delay
        setTimerWithCleanup(() => {
          if (!isMounted) return;
          setIsTyping(true);
          
          setTimerWithCleanup(() => {
            if (!isMounted) return;
            setIsTyping(false);
            const questionMessage: Message = {
              id: `question-${Date.now()}`,
              type: 'lisa',
              content: contextConfig.questionMessage,
              timestamp: new Date(),
              options: contextConfig.options,
            };
            setMessages(prev => [...prev, questionMessage]);
            setCurrentStep(contextConfig.initialStep);
          }, 1500);
        }, 1000);
      }, 2000);
    }, 1500);

    // Cleanup function
    return () => {
      isMounted = false;
      // Clear all pending timers
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [entryPoint]); // Run when entryPoint changes

  const handleUserResponse = (response: string) => {
    // Track interaction
    updateProfile({ interactions: (userProfile.interactions || 0) + 1 });
    
    // DIRECT CAPTURE: If this is a quantity selection, capture it immediately
    if (currentStep === 'express_quantity' && response.includes('leads')) {
      console.log('🎯 Quantity selected:', response);
      setLastSelectedQuantity(response);
    }

    // Emit realtime event for user message
    const sessionEmail = userProfile.contactInfo?.email || localStorage.getItem('warmeleads_session_email');
    if (sessionEmail) {
      emitChatMessage(sessionEmail, response, 'user', currentStep);
    }
    
    // Auto-fill contact info for logged in users in express flow
    if (isAuthenticated && user && !user.isGuest && 
        (currentStep === 'express_checkout' || currentStep === 'express_contact_details')) {
      // Pre-fill contact info from authenticated user
      const autoFilledInfo = {
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        company: user.company || '',
      };
      
      updateProfile({ contactInfo: autoFilledInfo });
      chatLogger.debug('Auto-filled contact info for logged in user', { autoFilledInfo });
      
      // Skip contact details step and go directly to payment for logged in users
      if (currentStep === 'express_checkout' && response === 'Contactgegevens invullen') {
        const autoResponse = `${user.name}, ${user.email}, ${user.phone || '06-12345678'}${user.company ? ', ' + user.company : ''}`;
        handleUserResponse(autoResponse);
        return;
      }
    }
    
    // Debug: log current state
    chatLogger.debug('User response received', { currentStep, response, userProfile });

    // Voeg gebruikersantwoord toe
    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      content: response,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Get next message from appropriate flow based on context configuration
    let nextMessage;
    
    // Always use the main chatLogic flow (which now includes express steps)
      nextMessage = getNextMessage(currentStep, response, userProfile);

    // Handle special actions before getting next message
    if (response.includes('Betalen met')) {
      const method = response.includes('iDEAL') ? 'ideal' : 'card';
      setPaymentMethod(method);
      setShowStripeCheckout(true);
      return;
    }

    // Handle login redirect
    if (response === 'Naar inlogpagina' && onBackToHome) {
      // Store current context for return after login
      ChatContextManager.setContext('direct');
      // Navigate to login page
      window.location.href = '/?page=login';
      return;
    }

    if (!nextMessage) {
      // End of conversation or special action
      if ((response.includes('homepage') || currentStep === 'back_to_home') && onBackToHome) {
        onBackToHome();
        return;
      }
      return;
    }

    // Lisa's reactie met typing indicator
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        
        // Resolve options if they are a function
        const resolvedOptions = typeof nextMessage.options === 'function' 
          ? (nextMessage.options as any)(userProfile) 
          : nextMessage.options;
        
        const lisaResponse: Message = {
          id: `lisa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'lisa',
          content: nextMessage.message,
          timestamp: new Date(),
          options: resolvedOptions,
        };

        setMessages(prev => [...prev, lisaResponse]);
        setCurrentStep(nextMessage.id);
      }, nextMessage.delay);
    }, 500);
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* Header met Logo */}
      <motion.div 
        className="flex items-center justify-between p-4 glass-effect"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Back Button */}
        {onBackToHome && (
          <motion.button
            onClick={onBackToHome}
            className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-sm">Terug</span>
          </motion.button>
        )}
        
        {/* Logo - centered */}
        <div className={`${onBackToHome ? 'flex-1 flex justify-center' : 'flex justify-center w-full'}`}>
          <Logo size="md" showText={true} />
        </div>
        
        {/* Spacer for centering when back button exists */}
        {onBackToHome && <div className="w-16" />}
      </motion.div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </AnimatePresence>

        {isTyping && <TypingIndicator />}

        {/* Action Buttons or Text Input */}
        {messages.length > 0 && !isTyping && (
          <motion.div 
            className="space-y-4 mt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {/* Show special components for specific steps */}
            {currentStep === 'express_contact_details' ? (
              <ContactForm
                orderData={{
                  industry: userProfile.industry || 'Thuisbatterijen',
                  leadType: userProfile.leadType || 'Exclusieve leads',
                  quantity: getLastSelectedQuantity() || userProfile.quantity || '30 leads',
                  total: calculateOrderTotal(userProfile),
                }}
                onSubmit={(contactInfo) => {
                  updateProfile({ contactInfo });
                  const response = `${contactInfo.name}, ${contactInfo.email}, ${contactInfo.phone}${contactInfo.company ? ', ' + contactInfo.company : ''}`;
                  handleUserResponse(response);
                }}
              />
            ) : currentStep === 'roi_calculator' ? (
              <ROICalculator
                industry={userProfile.industry || 'Thuisbatterijen'}
                onComplete={(results) => {
                  // Update profile with ROI calculator selections
                  const leadType = results.investment / results.expectedLeads <= 18 ? 'Gedeelde leads' : 'Exclusieve leads';
                  const quantity = `${results.expectedLeads} leads`;
                  
                  console.log('🧮 ROI Calculator completed:', {
                    results,
                    leadType,
                    quantity,
                    investment: results.investment
                  });
                  
                  updateProfile({ 
                    leadType,
                    quantity,
                    budget: `€${results.investment.toLocaleString()}`
                  });
                  
                  // Direct naar bestelling
                  const response = `Ja, ik wil ${results.expectedLeads} ${leadType.toLowerCase()} bestellen voor €${results.investment.toLocaleString()}`;
                  handleUserResponse(response);
                }}
              />
            ) : (currentStep === 'contact_details' || currentStep === 'order_process') ? (
              <TextInput
                placeholder="Uw volledige naam"
                example="Jan de Vries"
                onSubmit={handleUserResponse}
              />
            ) : (
              /* Regular buttons */
              messages[messages.length - 1]?.options?.map((option, index) => (
                <ChatButton
                  key={option}
                  text={option}
                  onClick={() => handleUserResponse(option)}
                  delay={index * 0.1}
                />
              ))
            )}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Footer */}
      <motion.div 
        className="p-4 glass-effect text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p className="text-white/60 text-xs">
          🔒 Uw gegevens zijn veilig • Verse leads binnen 15 minuten gegarandeerd
        </p>
      </motion.div>

      {/* Stripe Checkout Modal */}
      <StripeCheckout
        isOpen={showStripeCheckout}
        onClose={() => setShowStripeCheckout(false)}
        onShowAccountCreation={onShowAccountCreation}
        paymentMethod={paymentMethod}
        orderData={{
          industry: userProfile.industry || 'Thuisbatterijen',
          leadType: userProfile.leadType || 'Exclusieve leads',
          quantity: userProfile.quantity || '30 leads per maand',
          total: calculateOrderTotal(userProfile),
          customerInfo: {
            name: userProfile.contactInfo?.name || 'Klant',
            email: userProfile.contactInfo?.email || 'email@example.com',
            phone: userProfile.contactInfo?.phone || '06-12345678',
            company: userProfile.contactInfo?.company || '',
          },
        }}
      />
    </div>
  );
}
