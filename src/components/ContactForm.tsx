'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { UserIcon, EnvelopeIcon, PhoneIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { InvoiceChatMessage } from './InvoiceChatMessage';
import { useAuthStore } from '@/lib/auth';
import { createOrUpdateCustomer, createOpenInvoice } from '@/lib/crmSystem';
import { emitCustomerCreated, emitInvoiceCreated } from '@/lib/realtimeEvents';
import { PricingCalculator } from '@/lib/pricing';

interface ContactFormProps {
  onSubmit: (contactInfo: {
    name: string;
    email: string;
    phone: string;
    company?: string;
  }) => void;
  orderData?: {
    industry: string;
    leadType: string;
    quantity: string;
    total: string;
  };
}

export function ContactForm({ onSubmit, orderData }: ContactFormProps) {
  const { user, isAuthenticated } = useAuthStore();
  
  // Get quantity from localStorage backup if available
  const backupQuantity = typeof window !== 'undefined' ? localStorage.getItem('warmeleads_selected_quantity') : null;
  
  // Override any incorrect quantity in orderData
  const correctedOrderData = {
    industry: orderData?.industry || 'Thuisbatterijen',
    leadType: orderData?.leadType || 'Exclusieve leads',
    quantity: backupQuantity || orderData?.quantity || '30 leads',
    total: orderData?.total || 'Wordt berekend...'
  };
  
  // Auto-fill form data for authenticated users
  const getInitialFormData = () => {
    if (isAuthenticated && user && !user.isGuest) {
      return {
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        company: user.company || ''
      };
    }
    return {
      name: '',
      email: '',
      phone: '',
      company: ''
    };
  };

  const [formData, setFormData] = useState(getInitialFormData());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showInvoice, setShowInvoice] = useState(false);
  const [showInlineFinalStep, setShowInlineFinalStep] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Naam is verplicht';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is verplicht';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Ongeldig email adres';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefoonnummer is verplicht';
    } else if (!/^[\+]?[\d\s\-\(\)]{8,}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Ongeldig telefoonnummer';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Create/update customer in CRM system
      const customer = await createOrUpdateCustomer({
        email: formData.email.trim(),
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        company: formData.company.trim() || undefined,
        source: 'chat'
      });

      // Emit realtime event for admin monitoring
      emitCustomerCreated(customer);

      // Calculate correct amount for invoice
      const calculateInvoiceAmount = () => {
        const { leadType, quantity, industry } = correctedOrderData;
        
        try {
          const quantityNumber = parseInt(quantity.match(/\d+/)?.[0] || '0');
          if (quantityNumber === 0) return '€0,00';
          
          const type = (leadType.toLowerCase().includes('exclusief') || 
                       leadType.toLowerCase().includes('exclusieve') ||
                       leadType.toLowerCase().includes('exclusive')) ? 'exclusive' : 'shared';
          
          const calculation = PricingCalculator.calculateOrder(industry, type, quantityNumber);
          return PricingCalculator.formatPrice(calculation.total);
        } catch (error) {
          console.error('Error calculating invoice amount:', error);
          return '€0,00';
        }
      };

      const calculatedAmount = calculateInvoiceAmount();

      // Create open invoice for follow-up
      const invoice = await createOpenInvoice(formData.email.trim(), {
        industry: correctedOrderData.industry,
        leadType: correctedOrderData.leadType,
        quantity: correctedOrderData.quantity,
        amount: calculatedAmount
      });

      // Emit realtime event for invoice creation
      emitInvoiceCreated(formData.email.trim(), invoice);

      console.log('✅ Customer created/updated in CRM:', customer.id);
      console.log('📋 Open invoice created:', invoice.id);

      // Show inline final step
      setShowInlineFinalStep(true);
    }
  };

  const handleInvoiceConfirm = () => {
    // Verberg factuur en stuur gegevens door
    setShowInvoice(false);
    onSubmit({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      company: formData.company.trim() || undefined,
    });
  };

  const handleInvoiceBack = () => {
    setShowInvoice(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // If showing inline final step, show the invoice as chat message
  if (showInlineFinalStep) {
    return (
      <InvoiceChatMessage
        orderData={{
          ...correctedOrderData,
          customerInfo: {
            name: formData.name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            company: formData.company.trim() || undefined,
          }
        }}
        onConfirm={() => {
          // Proceed with payment
          onSubmit({
            name: formData.name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            company: formData.company.trim() || undefined,
          });
        }}
        onBack={() => {
          setShowInlineFinalStep(false);
        }}
      />
    );
  }

  return (
    <motion.div
      className="mt-4 p-6 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
    >
      <div className="mb-6 text-center">
        <h3 className="text-xl font-bold text-brand-navy mb-2">Uw contactgegevens</h3>
        <p className="text-gray-600">Voor de lead delivery en ondersteuning</p>
        {isAuthenticated && user && !user.isGuest && (
          <div className="mt-2 p-3 bg-green-50 rounded-lg">
            <p className="text-green-800 text-sm">
              ✅ Gegevens automatisch ingevuld van uw account
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Field */}
        <div>
          <label className="block text-sm font-medium text-brand-navy mb-2">
            Voor- en achternaam *
          </label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Jan de Vries"
              className={`
                w-full pl-10 pr-4 py-3 border rounded-lg transition-all duration-200
                ${errors.name 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-brand-pink focus:border-brand-pink'
                }
                focus:ring-2 focus:outline-none
              `}
            />
          </div>
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Email Field */}
        <div>
          <label className="block text-sm font-medium text-brand-navy mb-2">
            Email adres *
          </label>
          <div className="relative">
            <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="jan@bedrijf.nl"
              className={`
                w-full pl-10 pr-4 py-3 border rounded-lg transition-all duration-200
                ${errors.email 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-brand-pink focus:border-brand-pink'
                }
                focus:ring-2 focus:outline-none
              `}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Phone Field */}
        <div>
          <label className="block text-sm font-medium text-brand-navy mb-2">
            Telefoonnummer *
          </label>
          <div className="relative">
            <PhoneIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="06-12345678"
              className={`
                w-full pl-10 pr-4 py-3 border rounded-lg transition-all duration-200
                ${errors.phone 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-brand-pink focus:border-brand-pink'
                }
                focus:ring-2 focus:outline-none
              `}
            />
          </div>
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
          )}
        </div>

        {/* Company Field (Optional) */}
        <div>
          <label className="block text-sm font-medium text-brand-navy mb-2">
            Bedrijfsnaam (optioneel)
          </label>
          <div className="relative">
            <BuildingOfficeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              placeholder="ABC Solar BV"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink focus:outline-none transition-all duration-200"
            />
          </div>
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          className="w-full chat-button py-4 text-lg font-semibold mt-6"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          ✅ Gegevens bevestigen
        </motion.button>

        {/* Security Note */}
        <div className="text-center text-sm text-gray-500 mt-4">
          🔒 Uw gegevens worden veilig behandeld conform AVG
        </div>
      </form>

      {/* Old Invoice Modal - Removed for inline chat message */}
    </motion.div>
  );
}
