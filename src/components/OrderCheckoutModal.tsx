'use client';

import React, { useState } from 'react';
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
  LockClosedIcon
} from '@heroicons/react/24/outline';
import { leadPackages, formatPrice, calculatePackagePrice, type LeadPackage } from '@/lib/stripe';
import { loadStripe } from '@stripe/stripe-js';
import { useAuthStore, authenticatedFetch } from '@/lib/auth';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

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
}

export function OrderCheckoutModal({ isOpen, onClose, userEmail, userName, userCompany, requireAuth = false, userPermissions }: OrderCheckoutModalProps) {
  const [selectedIndustry, setSelectedIndustry] = useState<string>('Thuisbatterijen');
  const [selectedPackage, setSelectedPackage] = useState<LeadPackage | null>(null);
  const [quantity, setQuantity] = useState<number>(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [showAuthFlow, setShowAuthFlow] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  
  const { login, register, isAuthenticated } = useAuthStore();

  const industries = Object.keys(leadPackages);

  const handleSelectPackage = (pkg: LeadPackage) => {
    setSelectedPackage(pkg);
    // Reset quantity to minimum for exclusive or fixed for shared
    if (pkg.type === 'exclusive') {
      setQuantity(pkg.minQuantity || 30);
    } else {
      setQuantity(pkg.quantity); // Fixed 500 for shared
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsProcessing(true);

    try {
      if (authMode === 'login') {
        await login(authEmail, authPassword);
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
      }
      
      // After successful auth, close auth flow and proceed to checkout
      setShowAuthFlow(false);
      setIsProcessing(false);
      // Automatically proceed to checkout
      setTimeout(() => handleCheckout(), 100);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Er ging iets mis');
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 overflow-y-auto"
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative w-full max-w-6xl bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl shadow-2xl">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-orange-600 to-red-600 text-white px-8 py-6 rounded-t-3xl">
                  <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                  
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                      <ShoppingCartIcon className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold">Bestel Verse Leads 🚀</h2>
                      <p className="text-orange-100 mt-1">
                        Kies je branche en ontvang leads binnen 15 minuten
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-8">
                  {showAuthFlow ? (
                    /* Auth Flow */
                    <div className="max-w-md mx-auto">
                      <div className="text-center mb-8">
                        <div className="inline-flex p-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full mb-4">
                          <UserIcon className="w-12 h-12 text-purple-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                          {authMode === 'login' ? 'Log in om door te gaan' : 'Maak een account aan'}
                        </h3>
                        <p className="text-gray-600">
                          {authMode === 'login' 
                            ? 'Log in op je account om je bestelling af te ronden'
                            : 'Maak snel een gratis account aan om te bestellen'}
                        </p>
                      </div>

                      <form onSubmit={handleAuth} className="space-y-4">
                        {authMode === 'register' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Naam
                            </label>
                            <div className="relative">
                              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                              <input
                                type="text"
                                value={authName}
                                onChange={(e) => setAuthName(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="Je volledige naam"
                                required={authMode === 'register'}
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email
                          </label>
                          <div className="relative">
                            <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="email"
                              value={authEmail}
                              onChange={(e) => setAuthEmail(e.target.value)}
                              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="je@email.nl"
                              required
                            />
                          </div>
                        </div>

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
                              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="••••••••"
                              required
                              minLength={6}
                            />
                          </div>
                        </div>

                        {authError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                            {authError}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isProcessing}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isProcessing ? 'Bezig...' : (authMode === 'login' ? 'Inloggen en bestellen' : 'Account aanmaken en bestellen')}
                        </button>

                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode(authMode === 'login' ? 'register' : 'login');
                              setAuthError('');
                            }}
                            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                          >
                            {authMode === 'login' ? 'Nog geen account? Registreer hier' : 'Al een account? Log hier in'}
                          </button>
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
                  ) : (
                    /* Normal Checkout Flow */
                    <>
                      {/* Industry Selection */}
                      <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <SparklesIcon className="w-6 h-6 text-orange-600" />
                      Stap 1: Kies je branche
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {industries.map((industry) => (
                        <button
                          key={industry}
                          onClick={() => {
                            setSelectedIndustry(industry);
                            setSelectedPackage(null);
                          }}
                          className={`p-4 rounded-xl font-medium transition-all ${
                            selectedIndustry === industry
                              ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-xl scale-105'
                              : 'bg-white text-gray-700 hover:bg-orange-50 border-2 border-gray-200 hover:border-orange-300'
                          }`}
                        >
                          {industry}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Package Selection */}
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <BoltIcon className="w-6 h-6 text-orange-600" />
                      Stap 2: Kies je pakket
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      {leadPackages[selectedIndustry]?.map((pkg) => (
                        <motion.div
                          key={pkg.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectPackage(pkg)}
                          className={`relative p-6 rounded-2xl cursor-pointer transition-all ${
                            selectedPackage?.id === pkg.id
                              ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-2xl'
                              : 'bg-white border-2 border-gray-200 hover:border-orange-400 hover:shadow-lg'
                          }`}
                        >
                          {/* Badge */}
                          <div className="absolute top-4 right-4">
                            {pkg.type === 'exclusive' ? (
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                selectedPackage?.id === pkg.id
                                  ? 'bg-white/20 text-white'
                                  : 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                              }`}>
                                🔥 EXCLUSIEF
                              </span>
                            ) : (
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                selectedPackage?.id === pkg.id
                                  ? 'bg-white/20 text-white'
                                  : 'bg-blue-500 text-white'
                              }`}>
                                💰 GEDEELD
                              </span>
                            )}
                          </div>

                          {/* Content */}
                          <div className="mt-6">
                            <h4 className={`text-2xl font-bold mb-2 ${
                              selectedPackage?.id === pkg.id ? 'text-white' : 'text-gray-900'
                            }`}>
                              {pkg.name}
                            </h4>
                            <p className={`text-sm mb-4 ${
                              selectedPackage?.id === pkg.id ? 'text-white/90' : 'text-gray-600'
                            }`}>
                              {pkg.description}
                            </p>

                            {/* Price */}
                            <div className="mb-4">
                              {pkg.type === 'exclusive' && pkg.pricingTiers ? (
                                <div className="space-y-2">
                                  <div className={`text-2xl font-bold ${
                                    selectedPackage?.id === pkg.id ? 'text-white' : 'text-orange-600'
                                  }`}>
                                    Staffelprijzen:
                                  </div>
                                  {pkg.pricingTiers.map((tier, idx) => (
                                    <div key={idx} className={`text-sm ${
                                      selectedPackage?.id === pkg.id ? 'text-white/90' : 'text-gray-700'
                                    }`}>
                                      • {tier.minQuantity}{tier.maxQuantity ? `-${tier.maxQuantity}` : '+'} leads: <strong>{formatPrice(tier.pricePerLead)}</strong> per lead
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <>
                                  <div className={`text-4xl font-bold ${
                                    selectedPackage?.id === pkg.id ? 'text-white' : 'text-orange-600'
                                  }`}>
                                    {formatPrice(pkg.price * pkg.quantity)}
                                  </div>
                                  <div className={`text-sm ${
                                    selectedPackage?.id === pkg.id ? 'text-white/80' : 'text-gray-500'
                                  }`}>
                                    {formatPrice(pkg.price)} per lead × {pkg.quantity} leads
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Features */}
                            <ul className="space-y-2">
                              {pkg.features.map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <CheckCircleIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                    selectedPackage?.id === pkg.id ? 'text-white' : 'text-green-500'
                                  }`} />
                                  <span className={`text-sm ${
                                    selectedPackage?.id === pkg.id ? 'text-white' : 'text-gray-700'
                                  }`}>
                                    {feature}
                                  </span>
                                </li>
                              ))}
                            </ul>

                            {/* Selection Indicator */}
                            {selectedPackage?.id === pkg.id && (
                              <div className="mt-4 flex items-center gap-2 text-white font-medium">
                                <CheckCircleIcon className="w-6 h-6" />
                                Geselecteerd
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Quantity Selector & Price Summary */}
                  {selectedPackage && (
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">
                        Stap 3: {selectedPackage.type === 'exclusive' ? 'Kies aantal leads' : 'Bevestig je bestelling'}
                      </h3>
                      
                      <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-6 border-2 border-orange-200">
                        {selectedPackage.type === 'exclusive' ? (
                          <div className="space-y-4">
                            {/* Quantity Input */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Aantal exclusieve leads (minimum {selectedPackage.minQuantity || 30})
                              </label>
                              <input
                                type="number"
                                min={selectedPackage.minQuantity || 30}
                                value={quantity}
                                onChange={(e) => setQuantity(Math.max(selectedPackage.minQuantity || 30, parseInt(e.target.value) || 0))}
                                className="w-full px-4 py-3 text-2xl font-bold text-gray-900 border-2 border-orange-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                              />
                            </div>
                            
                            {/* Price Calculation */}
                            {(() => {
                              const pricing = calculatePackagePrice(selectedPackage, quantity);
                              return (
                                <div className="bg-white rounded-xl p-4 space-y-2">
                                  <div className="flex justify-between text-gray-700">
                                    <span>Aantal leads:</span>
                                    <span className="font-bold">{quantity} stuks</span>
                                  </div>
                                  <div className="flex justify-between text-gray-700">
                                    <span>Prijs per lead:</span>
                                    <span className="font-bold">{formatPrice(pricing.pricePerLead)} <span className="text-xs text-gray-500">excl. BTW</span></span>
                                  </div>
                                  <div className="border-t border-gray-200 mt-2 pt-2">
                                    <div className="flex justify-between text-gray-700">
                                      <span>Subtotaal (excl. BTW):</span>
                                      <span className="font-bold">{formatPrice(pricing.totalPrice)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-700">
                                      <span>BTW (21%):</span>
                                      <span className="font-bold">{formatPrice(Math.round(pricing.totalPrice * 0.21))}</span>
                                    </div>
                                  </div>
                                  <div className="border-t-2 border-gray-200 pt-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-lg font-bold text-gray-900">Totaal (incl. BTW):</span>
                                      <span className="text-3xl font-bold text-orange-600">{formatPrice(Math.round(pricing.totalPrice * 1.21))}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 text-right mt-1">
                                      {pricing.tierInfo}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Fixed Quantity Display */}
                            <div className="bg-white rounded-xl p-4 space-y-2">
                              <div className="flex justify-between text-gray-700">
                                <span>Aantal leads:</span>
                                <span className="font-bold">{selectedPackage.quantity} stuks (vaste batch)</span>
                              </div>
                              <div className="flex justify-between text-gray-700">
                                <span>Prijs per lead:</span>
                                <span className="font-bold">{formatPrice(selectedPackage.price)}</span>
                              </div>
                              <div className="border-t-2 border-gray-200 pt-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-lg font-bold text-gray-900">Totaal:</span>
                                  <span className="text-3xl font-bold text-orange-600">{formatPrice(selectedPackage.price * selectedPackage.quantity)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Trust Indicators */}
                  <div className="bg-white rounded-2xl p-6 mb-6 border-2 border-gray-200">
                    <div className="grid md:grid-cols-3 gap-6 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                          <BoltIcon className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="font-bold text-gray-900">15 Minuten</div>
                        <div className="text-sm text-gray-600">Directe levering</div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                          <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="font-bold text-gray-900">100% Veilig</div>
                        <div className="text-sm text-gray-600">Beveiligde betaling</div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                          <SparklesIcon className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="font-bold text-gray-900">Verse Leads</div>
                        <div className="text-sm text-gray-600">Uit onze campagnes</div>
                      </div>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <div className="flex gap-4">
                    <button
                      onClick={onClose}
                      className="flex-1 px-6 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                    >
                      Annuleren
                    </button>
                    {userPermissions?.canCheckout !== false ? (
                      <button
                        onClick={handleCheckout}
                        disabled={!selectedPackage || isProcessing}
                        className="flex-1 px-6 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl font-bold hover:from-orange-700 hover:to-red-700 transition-all shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-orange-600 disabled:hover:to-red-600"
                      >
                        {isProcessing ? '⏳ Even geduld...' : '✅ Doorgaan naar betalen'}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="flex-1 px-6 py-4 bg-gray-400 text-gray-600 rounded-xl font-bold cursor-not-allowed"
                      >
                        🔒 Alleen eigenaren kunnen bestellen
                      </button>
                    )}
                  </div>

                  {/* Info Text */}
                  <p className="text-center text-sm text-gray-600 mt-4">
                    Je wordt doorgestuurd naar onze beveiligde betaalpagina (Stripe). 
                    Na succesvolle betaling ontvang je direct je leads.
                  </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

