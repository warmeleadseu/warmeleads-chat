'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  ShoppingCartIcon,
  CheckCircleIcon,
  SparklesIcon,
  BoltIcon,
  ShieldCheckIcon,
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CreditCardIcon,
  UserGroupIcon,
  MapPinIcon,
  ChartBarIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline';
import { leadPackages, formatPrice, calculatePackagePrice, type LeadPackage } from '@/lib/stripe';
import { loadStripe } from '@stripe/stripe-js';
import { useAuthStore, authenticatedFetch } from '@/lib/auth';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export type OrderPrefillConfig = {
  industry?: string;
  packageId?: string;
  leadType?: 'exclusive' | 'shared' | 'shared_fresh' | 'bulk';
  quantity?: number;
};

interface OrderCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName: string;
  userCompany?: string;
  requireAuth?: boolean; // If true, show auth flow before checkout
  userPermissions?: {
    canCheckout: boolean;
  };
  prefillConfig?: OrderPrefillConfig | null;
}

export function OrderCheckoutModal({ isOpen, onClose, userEmail, userName, userCompany, requireAuth = false, userPermissions, prefillConfig }: OrderCheckoutModalProps) {
  const [selectedIndustry, setSelectedIndustry] = useState<string>('Thuisbatterijen');
  const [selectedPackage, setSelectedPackage] = useState<LeadPackage | null>(null);
  const [quantity, setQuantity] = useState<number>(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [showAuthFlow, setShowAuthFlow] = useState(false);
  const [authMode, setAuthMode] = useState<'guest' | 'login' | 'register'>('guest');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authCompany, setAuthCompany] = useState('');
  const [authError, setAuthError] = useState('');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false); // For mobile collapsible summary
  const [isProcessInfoOpen, setIsProcessInfoOpen] = useState(false); // For "Zo werkt het" section
  
  const { login, register, isAuthenticated } = useAuthStore();

  const industries = Object.keys(leadPackages);

  // Auto-advance steps
  useEffect(() => {
    if (selectedIndustry && !selectedPackage) {
      setCurrentStep(2);
    } else if (selectedPackage && currentStep < 3) {
      setCurrentStep(3);
    }
  }, [selectedIndustry, selectedPackage, currentStep]);

  useEffect(() => {
    if (!isOpen || !prefillConfig) {
      return;
    }

    const industryFromPrefill = prefillConfig.industry && leadPackages[prefillConfig.industry]
      ? prefillConfig.industry
      : null;

    const industryToUse = industryFromPrefill || selectedIndustry;

    if (industryToUse && industries.includes(industryToUse)) {
      setSelectedIndustry(industryToUse);
      const packagesForIndustry = leadPackages[industryToUse];
      let targetPackage = prefillConfig.packageId
        ? packagesForIndustry.find(pkg => pkg.id === prefillConfig.packageId)
        : undefined;

      if (!targetPackage && prefillConfig.leadType) {
        const normalizedType = prefillConfig.leadType === 'shared' ? 'shared_fresh' : prefillConfig.leadType;
        targetPackage = packagesForIndustry.find(pkg => pkg.type === normalizedType);
      }

      if (targetPackage) {
        setSelectedPackage(targetPackage);
        const minQty = targetPackage.minQuantity || targetPackage.quantity;
        const desiredQuantity = prefillConfig.quantity ? Math.max(prefillConfig.quantity, minQty) : minQty;
        setQuantity(desiredQuantity);
        setCurrentStep(3);

        setTimeout(() => {
          const quantitySection = document.getElementById('quantity-section');
          if (quantitySection) {
            quantitySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
      }
    }
  }, [isOpen, prefillConfig, industries, selectedIndustry]);

  // Calculate pricing
  const pricing = selectedPackage ? calculatePackagePrice(selectedPackage, quantity) : null;

  // Dispatch modal open/close events for WhatsApp button
  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new Event('orderModalOpen'));
    } else {
      window.dispatchEvent(new Event('orderModalClose'));
    }
  }, [isOpen]);

  const handleSelectPackage = (pkg: LeadPackage) => {
    setSelectedPackage(pkg);
    // Reset quantity based on type
    if (pkg.type === 'exclusive') {
      setQuantity(pkg.minQuantity || 30);
    } else if (pkg.type === 'bulk') {
      setQuantity(pkg.minQuantity || 100);
    } else {
      setQuantity(pkg.quantity); // Fixed 250 for shared_fresh
    }
    
    // Auto-scroll to quantity section after package selection
    setTimeout(() => {
      const quantitySection = document.getElementById('quantity-section');
      if (quantitySection) {
        quantitySection.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });
      }
    }, 100);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsProcessing(true);

    try {
      if (authMode === 'guest') {
        // Guest checkout - just proceed with email and name
        if (!authEmail || !authName) {
          setAuthError('Email en naam zijn verplicht');
          setIsProcessing(false);
          return;
        }
        // Proceed directly to checkout with guest info
        setShowAuthFlow(false);
        setIsProcessing(false);
        setTimeout(() => handleCheckoutAsGuest(), 100);
      } else if (authMode === 'login') {
        await login(authEmail, authPassword);
        setShowAuthFlow(false);
        setIsProcessing(false);
        setTimeout(() => handleCheckout(), 100);
      } else {
        if (!authName) {
          setAuthError('Naam is verplicht');
          setIsProcessing(false);
          return;
        }
        await register({
          email: authEmail,
          password: authPassword,
          name: authName
        });
        setShowAuthFlow(false);
        setIsProcessing(false);
        setTimeout(() => handleCheckout(), 100);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Er ging iets mis');
      setIsProcessing(false);
    }
  };

  const handleCheckoutAsGuest = async () => {
    if (!selectedPackage) return;
    
    // Validate quantity
    if (selectedPackage.type === 'exclusive') {
      const minQty = selectedPackage.minQuantity || 30;
      if (quantity < minQty) {
        alert(`Minimum ${minQty} leads vereist voor exclusieve leads`);
        return;
      }
    }

    setIsProcessing(true);

    try {
      // Calculate final price
      const pricing = calculatePackagePrice(selectedPackage, quantity);
      
      // Create checkout session for guest
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackage.id,
          quantity: quantity,
          customerEmail: authEmail,
          customerName: authName,
          customerCompany: authCompany || undefined,
          isGuest: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (stripe) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          console.error('Stripe error:', error);
          alert('Er ging iets mis met de betaling. Probeer het opnieuw.');
        }
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedPackage) return;
    
    // Check if authentication is required
    if (requireAuth && !isAuthenticated) {
      setShowAuthFlow(true);
      return;
    }
    
    // Validate quantity
    if (selectedPackage.type === 'exclusive') {
      const minQty = selectedPackage.minQuantity || 30;
      if (quantity < minQty) {
        alert(`Minimum ${minQty} leads vereist voor exclusieve leads`);
        return;
      }
    }

    setIsProcessing(true);

    try {
      // Calculate final price
      const pricing = calculatePackagePrice(selectedPackage, quantity);
      
      // Create checkout session with authentication
      const response = await authenticatedFetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackage.id,
          quantity: quantity,
          customerEmail: userEmail,
          customerName: userName,
          customerCompany: userCompany,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (stripe) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          console.error('Stripe error:', error);
          alert('Er ging iets mis met de betaling. Probeer het opnieuw.');
        }
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Fullscreen Modal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-hidden"
          >
            <div className="h-full w-full bg-gradient-to-br from-orange-50 via-white to-red-50">
              
              {/* Header - Fixed Top */}
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                  <div className="flex items-center justify-between">
                    {/* Logo/Title */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl">
                        <ShoppingCartIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bestel Leads</h1>
                        <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">Verse leads binnen 15 minuten</p>
                      </div>
                    </div>

                    {/* Progress Steps - Desktop */}
                    <div className="hidden lg:flex items-center gap-3">
                      {[
                        { num: 1, label: 'Branche' },
                        { num: 2, label: 'Pakket' },
                        { num: 3, label: 'Aantal' }
                      ].map((step, idx) => (
                        <React.Fragment key={step.num}>
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                            currentStep >= step.num 
                              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' 
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              currentStep > step.num ? 'bg-white/30' : ''
                            }`}>
                              {currentStep > step.num ? '✓' : step.num}
                            </div>
                            <span className="text-sm font-medium">{step.label}</span>
                          </div>
                          {idx < 2 && <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Close Button */}
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <XMarkIcon className="w-6 h-6 text-gray-600" />
                    </button>
                  </div>

                  {/* Progress Bar - Mobile */}
                  <div className="lg:hidden mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">
                        Stap {currentStep} van 3
                      </span>
                      <span className="text-xs text-gray-500">
                        {currentStep === 1 ? 'Kies je branche' : currentStep === 2 ? 'Selecteer pakket' : 'Bevestig aantal'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${(currentStep / 3) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content - Split Layout Desktop, Stacked Mobile */}
              <div className="h-[calc(100vh-120px)] lg:h-[calc(100vh-96px)] overflow-hidden">
                <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                  <div className="h-full flex flex-col lg:flex-row gap-6">
                    
                    {/* LEFT: Main Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto pr-0 lg:pr-4 space-y-4 lg:space-y-6 pb-32 lg:pb-0">
                      
                      {showAuthFlow ? (
                        /* Auth Flow with Guest Option */
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="max-w-md mx-auto"
                        >
                          <div className="bg-white rounded-2xl shadow-lg p-8">
                            <div className="text-center mb-6">
                              <div className="inline-flex p-4 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mb-4">
                                <ShoppingCartIcon className="w-12 h-12 text-orange-600" />
                              </div>
                              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                {authMode === 'guest' ? 'Bestel snel als gast' : authMode === 'login' ? 'Log in op je account' : 'Maak een account aan'}
                              </h3>
                              <p className="text-gray-600">
                                {authMode === 'guest' 
                                  ? 'Vul je gegevens in en ga direct naar de betaling'
                                  : authMode === 'login'
                                  ? 'Log in op je account om je bestelling af te ronden'
                                  : 'Maak snel een account aan om te bestellen'}
                              </p>
                            </div>

                            <form onSubmit={handleAuth} className="space-y-4">
                              {/* Name field - for guest and register */}
                              {(authMode === 'guest' || authMode === 'register') && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Naam *
                                  </label>
                                  <div className="relative">
                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                      type="text"
                                      value={authName}
                                      onChange={(e) => setAuthName(e.target.value)}
                                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                      placeholder="Je volledige naam"
                                      required
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Email field - always visible */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Email *
                                </label>
                                <div className="relative">
                                  <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                  <input
                                    type="email"
                                    value={authEmail}
                                    onChange={(e) => setAuthEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    placeholder="je@email.nl"
                                    required
                                  />
                                </div>
                              </div>

                              {/* Company field - only for guest */}
                              {authMode === 'guest' && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Bedrijf (optioneel)
                                  </label>
                                  <input
                                    type="text"
                                    value={authCompany}
                                    onChange={(e) => setAuthCompany(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    placeholder="Je bedrijfsnaam"
                                  />
                                </div>
                              )}

                              {/* Password field - only for login and register */}
                              {(authMode === 'login' || authMode === 'register') && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Wachtwoord
                                  </label>
                                  <div className="relative">
                                    <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                      type="password"
                                      value={authPassword}
                                      onChange={(e) => setAuthPassword(e.target.value)}
                                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                      placeholder="••••••••"
                                      required
                                      minLength={6}
                                    />
                                  </div>
                                </div>
                              )}

                              {authError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                                  {authError}
                                </div>
                              )}

                              <button
                                type="submit"
                                disabled={isProcessing}
                                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isProcessing ? 'Bezig...' : (
                                  authMode === 'guest' ? 'Doorgaan naar betalen' : 
                                  authMode === 'login' ? 'Inloggen en bestellen' : 
                                  'Account aanmaken en bestellen'
                                )}
                              </button>

                              {/* Toggle between modes */}
                              <div className="space-y-2 text-center">
                                {authMode === 'guest' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAuthMode('login');
                                      setAuthError('');
                                    }}
                                    className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                                  >
                                    Al een account? Log hier in
                                  </button>
                                )}
                                {authMode === 'login' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAuthMode('guest');
                                        setAuthError('');
                                      }}
                                      className="block w-full text-orange-600 hover:text-orange-700 text-sm font-medium"
                                    >
                                      ← Bestel als gast (geen account nodig)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAuthMode('register');
                                        setAuthError('');
                                      }}
                                      className="text-gray-600 hover:text-gray-700 text-sm"
                                    >
                                      Nog geen account? Registreer hier
                                    </button>
                                  </>
                                )}
                                {authMode === 'register' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAuthMode('guest');
                                        setAuthError('');
                                      }}
                                      className="block w-full text-orange-600 hover:text-orange-700 text-sm font-medium"
                                    >
                                      ← Bestel als gast (geen account nodig)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAuthMode('login');
                                        setAuthError('');
                                      }}
                                      className="text-gray-600 hover:text-gray-700 text-sm"
                                    >
                                      Al een account? Log hier in
                                    </button>
                                  </>
                                )}
                              </div>

                              <div className="text-center">
                                <button
                                  type="button"
                                  onClick={() => setShowAuthFlow(false)}
                                  className="text-gray-500 hover:text-gray-700 text-sm"
                                >
                                  ← Terug naar bestelling
                                </button>
                              </div>
                            </form>
                          </div>
                        </motion.div>
                      ) : (
                        <>
                          {/* Step 1: Industry Selection */}
                          <div>
                            {/* Desktop: Card wrapper */}
                            <div className="hidden lg:block bg-white rounded-2xl shadow-lg p-6">
                              <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                  1
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Kies je branche</h3>
                              </div>
                              <div className="grid grid-cols-5 gap-3">
                                {industries.map((industry) => (
                                  <motion.button
                                    key={industry}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                      setSelectedIndustry(industry);
                                      setSelectedPackage(null);
                                    }}
                                    className={`p-4 rounded-xl font-medium transition-all text-sm ${
                                      selectedIndustry === industry
                                        ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg ring-2 ring-orange-300'
                                        : 'bg-gray-50 text-gray-700 hover:bg-orange-50 border-2 border-gray-200 hover:border-orange-300'
                                    }`}
                                  >
                                    {industry}
                                  </motion.button>
                                ))}
                              </div>
                            </div>

                            {/* Mobile: No card, direct buttons with larger spacing */}
                            <div className="lg:hidden">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                  1
                                </div>
                                <h3 className="text-base font-bold text-gray-900">Kies je branche</h3>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {industries.map((industry) => (
                                  <motion.button
                                    key={industry}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => {
                                      setSelectedIndustry(industry);
                                      setSelectedPackage(null);
                                    }}
                                    className={`p-3 rounded-lg font-medium transition-all text-xs shadow-sm ${
                                      selectedIndustry === industry
                                        ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-md'
                                        : 'bg-white text-gray-700 active:bg-orange-50 border border-gray-200'
                                    }`}
                                  >
                                    {industry}
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Step 2: Package Selection */}
                          {selectedIndustry && (
                            <div>
                              {/* Desktop: Card wrapper */}
                              <div className="hidden lg:block bg-white rounded-2xl shadow-lg p-6">
                                <div className="flex items-center gap-2 mb-4">
                                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                    2
                                  </div>
                                  <h3 className="text-xl font-bold text-gray-900">Kies je pakket</h3>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4">
                                  {leadPackages[selectedIndustry]?.map((pkg) => (
                                    <motion.div
                                      key={pkg.id}
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => handleSelectPackage(pkg)}
                                      className={`relative p-6 rounded-xl cursor-pointer transition-all border-2 ${
                                        selectedPackage?.id === pkg.id
                                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-xl border-green-400'
                                          : 'bg-gray-50 border-gray-200 hover:border-orange-400 hover:shadow-md'
                                      }`}
                                    >
                                      {/* Badge */}
                                      <div className="absolute top-3 right-3">
                                        {pkg.type === 'exclusive' ? (
                                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                                            selectedPackage?.id === pkg.id
                                              ? 'bg-white/20 text-white'
                                              : 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                                          }`}>
                                            <SparklesIcon className="w-3.5 h-3.5" /> EXCLUSIEF
                                          </span>
                                        ) : pkg.type === 'shared_fresh' ? (
                                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                                            selectedPackage?.id === pkg.id
                                              ? 'bg-white/20 text-white'
                                              : 'bg-blue-500 text-white'
                                          }`}>
                                            <UserGroupIcon className="w-3.5 h-3.5" /> GEDEELD VERS
                                          </span>
                                        ) : (
                                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                                            selectedPackage?.id === pkg.id
                                              ? 'bg-white/20 text-white'
                                              : 'bg-purple-500 text-white'
                                          }`}>
                                            <ArchiveBoxIcon className="w-3.5 h-3.5" /> BULK
                                          </span>
                                        )}
                                      </div>

                                      {/* Content */}
                                      <div className="mt-4">
                                        <h4 className={`text-xl font-bold mb-2 ${
                                          selectedPackage?.id === pkg.id ? 'text-white' : 'text-gray-900'
                                        }`}>
                                          {pkg.name}
                                        </h4>
                                        <p className={`text-sm mb-4 ${
                                          selectedPackage?.id === pkg.id ? 'text-white/90' : 'text-gray-600'
                                        }`}>
                                          {pkg.description}
                                        </p>

                                        {/* Delivery info per package type */}
                                        <div className={`mb-4 p-3 rounded-lg border ${
                                          selectedPackage?.id === pkg.id 
                                            ? 'bg-white/10 border-white/20' 
                                            : 'bg-blue-50 border-blue-200'
                                        }`}>
                                          <div className={`text-xs font-semibold mb-1 flex items-center gap-1 ${
                                            selectedPackage?.id === pkg.id ? 'text-white' : 'text-blue-900'
                                          }`}>
                                            <ArchiveBoxIcon className="w-3.5 h-3.5" /> Levering:
                                          </div>
                                          <div className={`text-xs ${
                                            selectedPackage?.id === pkg.id ? 'text-white/90' : 'text-blue-800'
                                          }`}>
                                            {pkg.type === 'exclusive' 
                                              ? 'Campagnes binnen 24u • Real-time in portal • Persoonlijke spreadsheet'
                                              : pkg.type === 'shared_fresh'
                                              ? 'Verse campagnes binnen 24u • Excel per email • Gedeeld met 2 anderen'
                                              : 'Excel binnen 24u per email • Database (tot 6 mnd oud) • Direct te gebruiken'}
                                          </div>
                                        </div>

                                        {/* Price */}
                                        <div className="mb-4">
                                          {pkg.type === 'exclusive' && pkg.pricingTiers ? (
                                            <div className="space-y-1">
                                              <div className={`text-lg font-bold ${
                                                selectedPackage?.id === pkg.id ? 'text-white' : 'text-orange-600'
                                              }`}>
                                                Vanaf {formatPrice(pkg.pricingTiers[0].pricePerLead)}/lead
                                              </div>
                                              <div className={`text-xs ${
                                                selectedPackage?.id === pkg.id ? 'text-white/80' : 'text-gray-500'
                                              }`}>
                                                Staffelprijzen beschikbaar
                                              </div>
                                            </div>
                                          ) : pkg.type === 'bulk' && pkg.pricingTiers ? (
                                            <div className="space-y-1">
                                              <div className={`text-lg font-bold ${
                                                selectedPackage?.id === pkg.id ? 'text-white' : 'text-purple-600'
                                              }`}>
                                                €3,50 - €4,25/lead
                                              </div>
                                              <div className={`text-xs ${
                                                selectedPackage?.id === pkg.id ? 'text-white/80' : 'text-gray-500'
                                              }`}>
                                                Vanaf 100 leads • Volumekorting
                                              </div>
                                            </div>
                                          ) : (
                                            <>
                                              <div className={`text-2xl font-bold ${
                                                selectedPackage?.id === pkg.id ? 'text-white' : 'text-orange-600'
                                              }`}>
                                                {formatPrice(pkg.price * pkg.quantity)}
                                              </div>
                                              <div className={`text-xs ${
                                                selectedPackage?.id === pkg.id ? 'text-white/80' : 'text-gray-500'
                                              }`}>
                                                {formatPrice(pkg.price)} per lead × {pkg.quantity} leads
                                              </div>
                                            </>
                                          )}
                                        </div>

                                        {/* Features */}
                                        <ul className="space-y-2">
                                          {pkg.features.slice(0, 3).map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                              <CheckCircleIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                                selectedPackage?.id === pkg.id ? 'text-white' : 'text-green-500'
                                              }`} />
                                              <span className={`text-xs ${
                                                selectedPackage?.id === pkg.id ? 'text-white' : 'text-gray-700'
                                              }`}>
                                                {feature}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>

                                        {/* Selection Indicator */}
                                        {selectedPackage?.id === pkg.id && (
                                          <div className="mt-4 flex items-center gap-2 text-white font-medium text-sm">
                                            <CheckCircleIcon className="w-5 h-5" />
                                            Geselecteerd
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>

                              {/* Mobile: Simplified cards, no nested bg */}
                              <div className="lg:hidden">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                    2
                                  </div>
                                  <h3 className="text-base font-bold text-gray-900">Kies je pakket</h3>
                                </div>
                                <div className="space-y-2">
                                  {leadPackages[selectedIndustry]?.map((pkg) => (
                                    <motion.button
                                      key={pkg.id}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => handleSelectPackage(pkg)}
                                      className={`w-full text-left p-3 rounded-lg transition-all border shadow-sm ${
                                        selectedPackage?.id === pkg.id
                                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-400 shadow-md'
                                          : 'bg-white border-gray-200 active:border-orange-400'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            {pkg.type === 'exclusive' ? (
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 ${
                                                selectedPackage?.id === pkg.id
                                                  ? 'bg-white/20 text-white'
                                                  : 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                                              }`}>
                                                <SparklesIcon className="w-3 h-3" /> EXCLUSIEF
                                              </span>
                                            ) : pkg.type === 'shared_fresh' ? (
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 ${
                                                selectedPackage?.id === pkg.id
                                                  ? 'bg-white/20 text-white'
                                                  : 'bg-blue-500 text-white'
                                              }`}>
                                                <UserGroupIcon className="w-3 h-3" /> GEDEELD
                                              </span>
                                            ) : (
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 ${
                                                selectedPackage?.id === pkg.id
                                                  ? 'bg-white/20 text-white'
                                                  : 'bg-purple-500 text-white'
                                              }`}>
                                                <ArchiveBoxIcon className="w-3 h-3" /> BULK
                                              </span>
                                            )}
                                            <div className={`text-base font-bold ${
                                              selectedPackage?.id === pkg.id ? 'text-white' : 'text-gray-900'
                                            }`}>
                                              {pkg.name}
                                            </div>
                                          </div>
                                          <div className={`text-lg font-bold mb-1 ${
                                            selectedPackage?.id === pkg.id ? 'text-white' : 'text-orange-600'
                                          }`}>
                                            {pkg.type === 'exclusive' && pkg.pricingTiers 
                                              ? `Vanaf ${formatPrice(pkg.pricingTiers[0].pricePerLead)}/lead`
                                              : pkg.type === 'bulk' && pkg.pricingTiers
                                              ? '€3,50 - €4,25/lead'
                                              : formatPrice(pkg.price * pkg.quantity)
                                            }
                                          </div>
                                        </div>
                                        {selectedPackage?.id === pkg.id && (
                                          <CheckCircleIcon className="w-5 h-5 text-white flex-shrink-0 mt-1" />
                                        )}
                                      </div>
                                      
                                      <p className={`text-xs mb-2 line-clamp-2 ${
                                        selectedPackage?.id === pkg.id ? 'text-white/90' : 'text-gray-600'
                                      }`}>
                                        {pkg.description}
                                      </p>

                                      {/* Delivery info mobile - more compact */}
                                      <div className={`text-[11px] px-2 py-1 rounded ${
                                        selectedPackage?.id === pkg.id 
                                          ? 'bg-white/10' 
                                          : 'bg-blue-50'
                                      }`}>
                                        <span className={selectedPackage?.id === pkg.id ? 'text-white/90' : 'text-blue-800'}>
                                          {pkg.type === 'exclusive' 
                                            ? 'Start 24u • Real-time portal'
                                            : pkg.type === 'shared_fresh'
                                            ? 'Vers • Excel 24u • 3 partijen'
                                            : 'Database • Excel 24u • Laagste prijs'}
                                        </span>
                                      </div>
                                    </motion.button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* "Zo werkt het" Info Section - Between Step 2 & 3 */}
                          {selectedPackage && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mb-6"
                            >
                              <button
                                onClick={() => setIsProcessInfoOpen(!isProcessInfoOpen)}
                                className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 hover:border-blue-300 transition-all duration-200 group"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </div>
                                    <div className="text-left">
                                      <h4 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                        📋 Hoe werkt het na je bestelling?
                                      </h4>
                                      <p className="text-sm text-gray-600">
                                        {isProcessInfoOpen ? 'Klik om te sluiten' : 'Klik om te bekijken'}
                                      </p>
                                    </div>
                                  </div>
                                  <motion.div
                                    animate={{ rotate: isProcessInfoOpen ? 180 : 0 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <ChevronDownIcon className="w-6 h-6 text-blue-600" />
                                  </motion.div>
                                </div>
                              </button>

                              <AnimatePresence>
                                {isProcessInfoOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="bg-white border-2 border-blue-200 border-t-0 rounded-b-2xl p-6 space-y-4">
                                      <p className="text-gray-700 font-medium mb-4">
                                        Voordat je afrekent: zo werkt het bij WarmeLeads 👇
                                      </p>

                                      {/* Process Steps - Dynamic based on package type */}
                                      <div className="space-y-4">
                                        {selectedPackage.type === 'exclusive' ? (
                                          <>
                                            <div className="flex gap-4">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
                                              <div className="flex-1">
                                                <h5 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                  <SparklesIcon className="w-4 h-4 text-orange-500" /> Je bestelt exclusieve leads
                                                </h5>
                                                <p className="text-sm text-gray-600">Na betaling starten we binnen 24u campagnes speciaal voor jou.</p>
                                              </div>
                                            </div>
                                            <div className="flex gap-4">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
                                              <div className="flex-1">
                                                <h5 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                  <ChartBarIcon className="w-4 h-4 text-blue-500" /> Toegang tot persoonlijk portal
                                                </h5>
                                                <p className="text-sm text-gray-600">Je krijgt direct toegang tot je CRM portal met Google Sheets integratie.</p>
                                              </div>
                                            </div>
                                            <div className="flex gap-4">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
                                              <div className="flex-1">
                                                <h5 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                  <BoltIcon className="w-4 h-4 text-purple-500" /> Leads real-time binnen
                                                </h5>
                                                <p className="text-sm text-gray-600">Zodra leads gegenereerd worden, verschijnen ze direct in je portal.</p>
                                              </div>
                                            </div>
                                            <div className="flex gap-4">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm">4</div>
                                              <div className="flex-1">
                                                <h5 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                  <MapPinIcon className="w-4 h-4 text-orange-500" /> 100% exclusief voor jou
                                                </h5>
                                                <p className="text-sm text-gray-600">Geen concurrentie - jij bent de enige die deze leads ontvangt.</p>
                                              </div>
                                            </div>
                                          </>
                                        ) : selectedPackage.type === 'shared_fresh' ? (
                                          <>
                                            <div className="flex gap-4">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
                                              <div className="flex-1">
                                                <h5 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                  <UserGroupIcon className="w-4 h-4 text-green-500" /> Je bestelt gedeelde verse leads
                                                </h5>
                                                <p className="text-sm text-gray-600">Na betaling starten we binnen 24u campagnes (gedeeld met 2 anderen).</p>
                                              </div>
                                            </div>
                                            <div className="flex gap-4">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
                                              <div className="flex-1">
                                                <h5 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                  <EnvelopeIcon className="w-4 h-4 text-blue-500" /> Excel binnen 24 uur
                                                </h5>
                                                <p className="text-sm text-gray-600">Je ontvangt een Excel bestand per email met alle lead data.</p>
                                              </div>
                                            </div>
                                            <div className="flex gap-4">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
                                              <div className="flex-1">
                                                <h5 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                  <BoltIcon className="w-4 h-4 text-purple-500" /> Verse leads uit campagnes
                                                </h5>
                                                <p className="text-sm text-gray-600">Alle leads zijn vers gegenereerd met bewezen koopintentie.</p>
                                              </div>
                                            </div>
                                            <div className="flex gap-4">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm">4</div>
                                              <div className="flex-1">
                                                <h5 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                  <CreditCardIcon className="w-4 h-4 text-orange-500" /> 1/3 van de prijs
                                                </h5>
                                                <p className="text-sm text-gray-600">Verse leads voor een fractie van de exclusieve prijs!</p>
                                              </div>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="flex gap-4">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
                                              <div className="flex-1">
                                                <h5 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                  <ArchiveBoxIcon className="w-4 h-4 text-green-500" /> Je bestelt bulk leads
                                                </h5>
                                                <p className="text-sm text-gray-600">Na betaling bereiden we direct je pakket voor uit onze database.</p>
                                              </div>
                                            </div>
                                            <div className="flex gap-4">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
                                              <div className="flex-1">
                                                <h5 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                  <EnvelopeIcon className="w-4 h-4 text-blue-500" /> Excel binnen 24 uur
                                                </h5>
                                                <p className="text-sm text-gray-600">Je ontvangt een Excel bestand per email met alle leads.</p>
                                              </div>
                                            </div>
                                            <div className="flex gap-4">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
                                              <div className="flex-1">
                                                <h5 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                  <CreditCardIcon className="w-4 h-4 text-purple-500" /> Laagste prijs per lead
                                                </h5>
                                                <p className="text-sm text-gray-600">Vanaf €3,50/lead - perfect voor grote volumes en testen.</p>
                                              </div>
                                            </div>
                                            <div className="flex gap-4">
                                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm">4</div>
                                              <div className="flex-1">
                                                <h5 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                  <ChartBarIcon className="w-4 h-4 text-orange-500" /> Database leads
                                                </h5>
                                                <p className="text-sm text-gray-600">Leads tot 6 maanden oud - ideaal voor cold outreach campaigns.</p>
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </div>

                                      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                                        <p className="text-sm text-blue-900 font-medium text-center">
                                          💡 Zo weet je precies wat je kunt verwachten.
                                        </p>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )}

                          {/* Step 3: Quantity & Confirmation */}
                          {selectedPackage && (
                            <div id="quantity-section">
                              {/* Desktop: Card wrapper */}
                              <div className="hidden lg:block bg-white rounded-2xl shadow-lg p-6">
                                <div className="flex items-center gap-2 mb-4">
                                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                    3
                                  </div>
                                  <h3 className="text-xl font-bold text-gray-900">
                                    {selectedPackage.type === 'shared_fresh'
                                      ? 'Bevestig je bestelling'
                                      : 'Kies aantal leads'}
                                  </h3>
                                </div>

                                {selectedPackage.type === 'shared_fresh' ? (
                                  <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="text-sm font-medium text-gray-700">Vaste batch grootte</div>
                                        <div className="text-2xl font-bold text-gray-900">{selectedPackage.quantity} leads</div>
                                      </div>
                                      <CheckCircleIcon className="w-12 h-12 text-blue-500" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {selectedPackage.type === 'exclusive' 
                                          ? `Aantal exclusieve leads (minimum ${selectedPackage.minQuantity || 30})`
                                          : `Aantal bulk leads (minimum ${selectedPackage.minQuantity || 100})`
                                        }
                                      </label>
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => setQuantity(Math.max((selectedPackage.minQuantity || 30), quantity - 10))}
                                          className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                        >
                                          <span className="text-xl font-bold">−</span>
                                        </button>
                                        <input
                                          type="number"
                                          min={selectedPackage.minQuantity || 30}
                                          value={quantity}
                                          onChange={(e) => setQuantity(Math.max(selectedPackage.minQuantity || 30, parseInt(e.target.value) || 0))}
                                          className="flex-1 px-4 py-3 text-2xl font-bold text-center text-gray-900 border-2 border-orange-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                        />
                                        <button
                                          onClick={() => setQuantity(quantity + 10)}
                                          className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                        >
                                          <span className="text-xl font-bold">+</span>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Tier Info */}
                                    {pricing && (
                                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                        <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
                                          <SparklesIcon className="w-5 h-5" />
                                          {pricing.tierInfo}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Trust Badges */}
                                <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
                                  <div className="text-center">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                      <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="text-xs font-medium text-gray-900">Kwaliteit Gegarandeerd</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                      <BoltIcon className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div className="text-xs font-medium text-gray-900">
                                      {selectedPackage?.type === 'exclusive' ? 'Start binnen 24u' : 'Levering binnen 24u'}
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                      <SparklesIcon className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div className="text-xs font-medium text-gray-900">
                                      {selectedPackage?.type === 'exclusive' ? '100% Exclusief' : 'Direct Bruikbaar'}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Mobile: Simplified, no card wrapper */}
                              <div className="lg:hidden">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                    3
                                  </div>
                                  <h3 className="text-base font-bold text-gray-900">
                                    {selectedPackage.type === 'shared_fresh' ? 'Bevestigen' : 'Kies aantal'}
                                  </h3>
                                </div>

                                {selectedPackage.type === 'shared_fresh' ? (
                                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="text-xs font-medium text-gray-600">Vaste batch</div>
                                        <div className="text-2xl font-bold text-gray-900">{selectedPackage.quantity} leads</div>
                                      </div>
                                      <CheckCircleIcon className="w-10 h-10 text-blue-500" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-white rounded-lg shadow-sm p-3 space-y-3">
                                    <div>
                                      <label className="block text-[11px] font-medium text-gray-500 mb-2 text-center">
                                        Minimum {selectedPackage.minQuantity || 30} leads
                                      </label>
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          onClick={() => setQuantity(Math.max((selectedPackage.minQuantity || 30), quantity - 10))}
                                          className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 active:from-gray-200 active:to-gray-300 rounded-lg transition-all flex items-center justify-center shadow-sm flex-shrink-0"
                                        >
                                          <span className="text-xl font-bold text-gray-700">−</span>
                                        </button>
                                        <div className="flex-1 min-w-0 max-w-[120px]">
                                          <input
                                            type="number"
                                            min={selectedPackage.minQuantity || 30}
                                            value={quantity}
                                            onChange={(e) => setQuantity(Math.max(selectedPackage.minQuantity || 30, parseInt(e.target.value) || 0))}
                                            className="w-full px-2 py-2 text-2xl font-bold text-center text-gray-900 bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                            style={{ 
                                              WebkitAppearance: 'none',
                                              MozAppearance: 'textfield'
                                            }}
                                          />
                                        </div>
                                        <button
                                          onClick={() => setQuantity(quantity + 10)}
                                          className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 active:from-gray-200 active:to-gray-300 rounded-lg transition-all flex items-center justify-center shadow-sm flex-shrink-0"
                                        >
                                          <span className="text-xl font-bold text-gray-700">+</span>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Tier Info */}
                                    {pricing && (
                                      <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="flex items-center gap-2 text-blue-700 text-[11px] font-medium">
                                          <SparklesIcon className="w-4 h-4 flex-shrink-0" />
                                          <span className="truncate">{pricing.tierInfo}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Trust Badges - Mobile - More compact */}
                                <div className="grid grid-cols-3 gap-2 mt-3">
                                  <div className="text-center bg-white rounded-lg p-2 shadow-sm">
                                    <ShieldCheckIcon className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                                    <div className="text-[10px] font-medium text-gray-900">Kwaliteit</div>
                                  </div>
                                  <div className="text-center bg-white rounded-lg p-2 shadow-sm">
                                    <BoltIcon className="w-5 h-5 text-green-600 mx-auto mb-1" />
                                    <div className="text-[10px] font-medium text-gray-900">
                                      {selectedPackage?.type === 'exclusive' ? '< 24u Start' : '< 24u'}
                                    </div>
                                  </div>
                                  <div className="text-center bg-white rounded-lg p-2 shadow-sm">
                                    <SparklesIcon className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                                    <div className="text-[10px] font-medium text-gray-900">
                                      {selectedPackage?.type === 'exclusive' ? 'Exclusief' : 'Direct'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* RIGHT: Order Summary - Sticky Desktop, Bottom Mobile */}
                    {!showAuthFlow && selectedPackage && pricing && (
                      <div className="hidden lg:block lg:w-96 flex-shrink-0">
                        <div className="sticky top-6">
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden"
                          >
                            {/* Summary Header */}
                            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">
                              <h3 className="text-xl font-bold mb-1">Jouw Bestelling</h3>
                              <p className="text-sm text-orange-100">Overzicht & totaal</p>
                            </div>

                            {/* Summary Content */}
                            <div className="p-6 space-y-4">
                              {/* Industry */}
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Branche</div>
                                <div className="font-semibold text-gray-900">{selectedIndustry}</div>
                              </div>

                              {/* Package */}
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Pakket</div>
                                <div className="flex items-center justify-between">
                                  <div className="font-semibold text-gray-900">{selectedPackage.name}</div>
                                  {selectedPackage.type === 'exclusive' ? (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">EXCLUSIEF</span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">GEDEELD</span>
                                  )}
                                </div>
                              </div>

                              <div className="border-t border-gray-200 pt-4 space-y-2">
                                {/* Quantity */}
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Aantal leads</span>
                                  <span className="font-semibold text-gray-900">{quantity}×</span>
                                </div>

                                {/* Price per lead */}
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Prijs per lead</span>
                                  <span className="font-semibold text-gray-900">{formatPrice(pricing.pricePerLead)}</span>
                                </div>

                                {/* Subtotal */}
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Subtotaal</span>
                                  <span className="font-semibold text-gray-900">{formatPrice(pricing.totalPrice)}</span>
                                </div>

                                {/* VAT */}
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">BTW (21%)</span>
                                  <span className="font-semibold text-gray-900">{formatPrice(Math.round(pricing.totalPrice * 0.21))}</span>
                                </div>
                              </div>

                              {/* Total */}
                              <div className="border-t-2 border-gray-200 pt-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-lg font-bold text-gray-900">Totaal</span>
                                  <motion.span
                                    key={pricing.totalPrice}
                                    initial={{ scale: 1.2 }}
                                    animate={{ scale: 1 }}
                                    className="text-3xl font-bold text-orange-600"
                                  >
                                    {formatPrice(Math.round(pricing.totalPrice * 1.21))}
                                  </motion.span>
                                </div>
                                <div className="text-xs text-gray-500 text-right mt-1">
                                  Inclusief BTW
                                </div>
                              </div>

                              {/* Checkout Button */}
                              {userPermissions?.canCheckout !== false ? (
                                <button
                                  onClick={handleCheckout}
                                  disabled={!selectedPackage || isProcessing}
                                  className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                  {isProcessing ? (
                                    <>⏳ Even geduld...</>
                                  ) : (
                                    <>
                                      <CreditCardIcon className="w-5 h-5" />
                                      Doorgaan naar betalen
                                    </>
                                  )}
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="w-full py-4 bg-gray-400 text-gray-600 rounded-xl font-bold cursor-not-allowed"
                                >
                                  🔒 Alleen eigenaren kunnen bestellen
                                </button>
                              )}

                              {/* Payment Info */}
                              <div className="text-xs text-center text-gray-500">
                                <ShieldCheckIcon className="w-4 h-4 inline mr-1" />
                                Beveiligde betaling via Stripe
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile: Sticky Bottom Bar with Summary - Compact */}
              {!showAuthFlow && selectedPackage && pricing && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-20">
                  {/* Collapsible Summary */}
                  <button
                    onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                    className="w-full px-3 py-2 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingCartIcon className="w-4 h-4 text-gray-600" />
                      <div className="text-left">
                        <div className="text-[10px] text-gray-500">Totaal (incl. BTW)</div>
                        <div className="text-base font-bold text-orange-600">
                          {formatPrice(Math.round(pricing.totalPrice * 1.21))}
                        </div>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isSummaryOpen ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ChevronDownIcon className="w-4 h-4 text-gray-600" />
                    </motion.div>
                  </button>

                  {/* Expanded Summary */}
                  <AnimatePresence>
                    {isSummaryOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 space-y-2 border-t border-gray-100 max-h-48 overflow-y-auto">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Branche</span>
                            <span className="font-medium text-gray-900">{selectedIndustry}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Pakket</span>
                            <span className="font-medium text-gray-900">{selectedPackage.name}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Aantal</span>
                            <span className="font-medium text-gray-900">{quantity} leads</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Per lead</span>
                            <span className="font-medium text-gray-900">{formatPrice(pricing.pricePerLead)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Subtotaal</span>
                            <span className="font-medium text-gray-900">{formatPrice(pricing.totalPrice)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">BTW (21%)</span>
                            <span className="font-medium text-gray-900">{formatPrice(Math.round(pricing.totalPrice * 0.21))}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* CTA Button */}
                  <div className="p-4">
                    {userPermissions?.canCheckout !== false ? (
                      <button
                        onClick={handleCheckout}
                        disabled={!selectedPackage || isProcessing}
                        className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isProcessing ? (
                          <>⏳ Even geduld...</>
                        ) : (
                          <>
                            <CreditCardIcon className="w-5 h-5" />
                            Doorgaan naar betalen
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full py-4 bg-gray-400 text-gray-600 rounded-xl font-bold cursor-not-allowed"
                      >
                        🔒 Alleen eigenaren kunnen bestellen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
