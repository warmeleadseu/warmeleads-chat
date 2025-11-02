'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { loadStripe } from '@stripe/stripe-js';
import { PricingCalculator } from '@/lib/pricing';
import { authenticatedFetch } from '@/lib/auth';

interface StripeCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: {
    industry: string;
    leadType: string;
    quantity: string;
    total: string;
    customerInfo: {
      name: string;
      email: string;
      phone: string;
      company: string;
    };
  };
  onShowAccountCreation?: () => void;
  paymentMethod: 'ideal' | 'card';
}

// Calculate amount in cents for Stripe using correct pricing
const calculateAmountInCents = (orderData: any) => {
  const { industry, leadType, quantity } = orderData;
  
  if (!industry || !leadType || !quantity) return 0;
  
  try {
    // Parse quantity number from string like "30 leads per maand"
    const quantityNumber = parseInt(quantity.match(/\d+/)?.[0] || '0');
    
    if (quantityNumber === 0) return 0;
    
    // Determine lead type
    const type = (leadType.toLowerCase().includes('exclusief') || 
                 leadType.toLowerCase().includes('exclusieve') ||
                 leadType.toLowerCase().includes('exclusive')) ? 'exclusive' : 'shared';
    
    // Use the PricingCalculator for accurate pricing
    const calculation = PricingCalculator.calculateOrder(industry, type, quantityNumber);
    
    // Return amount in cents (multiply by 100)
    return Math.round(calculation.total * 100);
  } catch (error) {
    console.error('Error calculating amount:', error);
    return 0;
  }
};

// Use live publishable key from environment
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_dummy';

// Calculate display price for Stripe checkout using correct pricing
const calculateDisplayPrice = (orderData: any) => {
  const { industry, leadType, quantity } = orderData;

  if (!industry || !leadType || !quantity) return '€0,00';

  try {
    // Parse quantity number from string like "30 leads per maand"
    const quantityNumber = parseInt(quantity.match(/\d+/)?.[0] || '0');
    
    if (quantityNumber === 0) return '€0,00';
    
    // Determine lead type
    const type = (leadType.toLowerCase().includes('exclusief') || 
                 leadType.toLowerCase().includes('exclusieve') ||
                 leadType.toLowerCase().includes('exclusive')) ? 'exclusive' : 'shared';
    
    // Use the PricingCalculator for accurate pricing
    const calculation = PricingCalculator.calculateOrder(industry, type, quantityNumber);
    
    return PricingCalculator.formatPrice(calculation.total);
  } catch (error) {
    console.error('Error calculating display price:', error);
    return '€0,00';
  }
};

export function StripeCheckout({ 
  isOpen, 
  onClose, 
  orderData, 
  onShowAccountCreation,
  paymentMethod 
}: StripeCheckoutProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Betaling voorbereiden...');

  const handlePayment = async () => {
    setIsProcessing(true);
    setLoadingMessage('Betaling voorbereiden...');
    
    try {
      const amountInCents = calculateAmountInCents(orderData);

      setLoadingMessage('Stripe checkout aanmaken...');

      // Create Stripe Checkout Session with authentication
      const response = await authenticatedFetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInCents,
          currency: 'eur',
          customerInfo: orderData.customerInfo,
          orderDetails: {
            industry: orderData.industry,
            leadType: orderData.leadType,
            quantity: orderData.quantity,
          },
          paymentMethod: paymentMethod,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Checkout creation failed');
      }

      const { sessionId } = await response.json();
      
      setLoadingMessage('Doorsturen naar iDEAL...');
      
      // Load Stripe and redirect to checkout
      const stripe = await loadStripe(stripePublishableKey);
      
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

      // Redirect to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({
        sessionId: sessionId,
      });
      
      if (error) {
        throw new Error(error.message);
      }

      // The redirect will happen, so we won't reach this point
      // Success handling will be done on the return URL

    } catch (error) {
      console.error('Payment failed:', error);
      setIsProcessing(false);
      setLoadingMessage('Betaling voorbereiden...');
      
      // Better error message
      const errorMessage = error instanceof Error ? error.message : 'Onbekende fout';
      if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        alert('Netwerkfout. Controleer uw internetverbinding en probeer het opnieuw.');
      } else if (errorMessage.includes('Stripe')) {
        alert('Betaling tijdelijk niet beschikbaar. Probeer het over een paar minuten opnieuw of neem contact op via 085-0477067.');
      } else {
        alert('Betaling mislukt. Probeer het opnieuw of neem contact op via info@warmeleads.eu of 085-0477067.');
      }
    }
  };

  const triggerLeadDelivery = async () => {
    try {
      const response = await fetch('/api/deliver-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerInfo: orderData.customerInfo,
          orderDetails: {
            industry: orderData.industry,
            leadType: orderData.leadType,
            quantity: orderData.quantity,
          },
        }),
      });

      if (response.ok) {
        console.log('Lead delivery triggered successfully');
      }
    } catch (error) {
      console.error('Failed to trigger lead delivery:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Betalen met {paymentMethod === 'ideal' ? 'iDEAL' : 'Creditcard'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {paymentSuccess ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Bestelling succesvol!</h3>
              <p className="text-gray-600 mb-4">
                Uw leads worden binnen 15 minuten geleverd. Maak nu een account aan voor extra voordelen!
              </p>
            </motion.div>
          ) : (
            <>
              {/* Order Summary */}
              <div className="bg-gray-50 rounded-2xl p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Bestelling samenvatting</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Product:</span>
                    <span className="font-medium">{orderData.leadType} {orderData.industry}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Aantal:</span>
                    <span className="font-medium">{orderData.quantity}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold text-gray-900">Totaal:</span>
                    <span className="font-bold text-brand-purple text-lg">
                      {calculateDisplayPrice(orderData)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-gray-50 rounded-2xl p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Klantgegevens</h3>
                <div className="space-y-2 text-sm">
                  <div><strong>Naam:</strong> {orderData.customerInfo.name}</div>
                  <div><strong>Email:</strong> {orderData.customerInfo.email}</div>
                  <div><strong>Telefoon:</strong> {orderData.customerInfo.phone}</div>
                  <div><strong>Bedrijf:</strong> {orderData.customerInfo.company}</div>
                </div>
              </div>

              {/* Payment Method Info */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl mb-6">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  {paymentMethod === 'ideal' ? (
                    <span className="text-blue-600 font-bold text-xs">iDL</span>
                  ) : (
                    <span className="text-blue-600 font-bold text-xs">💳</span>
                  )}
                </div>
                <div>
                  <div className="font-medium text-blue-900">
                    {paymentMethod === 'ideal' ? 'iDEAL Betaling' : 'Creditcard Betaling'}
                  </div>
                  <div className="text-sm text-blue-700">
                    Veilig en gecodeerd via Stripe
                  </div>
                </div>
              </div>

              {/* Guarantees */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Onze garanties</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Verse leads uit campagnes binnen 15 minuten</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Realtime inladen in uw dashboard</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Nederlandse prospects</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>AVG-compliant gegevensverwerking</span>
                  </div>
                </div>
              </div>

              {/* Payment Button */}
              <button
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-brand-purple to-brand-pink text-white font-semibold py-4 rounded-2xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {loadingMessage}
                  </>
                ) : (
                  <>
                    <span className="text-lg">💳</span>
                    Betaal {calculateDisplayPrice(orderData)}
                  </>
                )}
              </button>

              <div className="mt-4 text-center">
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}