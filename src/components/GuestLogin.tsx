'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeftIcon,
  UserIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../lib/auth';

interface GuestLoginProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function GuestLogin({ onBack, onSuccess }: GuestLoginProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: ''
  });

  const { loginAsGuest, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await loginAsGuest({
        name: formData.name,
        email: formData.email,
        company: formData.company,
        phone: formData.phone
      });
      onSuccess();
    } catch (error) {
      // Error is handled by the store
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center p-4 glass-effect"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>Terug</span>
        </button>
        
        <div className="text-center flex-1">
          <h1 className="text-white font-bold text-xl">Doorgaan als gast</h1>
          <p className="text-white/60 text-sm">Geen account nodig - direct bestellen</p>
        </div>
      </motion.div>

      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Info Card */}
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-2xl p-6 mb-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserIcon className="w-8 h-8 text-blue-300" />
              </div>
              <h3 className="text-blue-300 font-semibold mb-2">Gast bestelling</h3>
              <p className="text-blue-200 text-sm">
                Bestel leads zonder account aan te maken. 
                U kunt later altijd nog een account aanmaken.
              </p>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Field */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Naam *
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-transparent transition-all"
                    placeholder="Jouw naam"
                    required
                  />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Email adres *
                </label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-transparent transition-all"
                    placeholder="jouw@email.nl"
                    required
                  />
                </div>
              </div>

              {/* Company Field */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Bedrijfsnaam (optioneel)
                </label>
                <div className="relative">
                  <BuildingOfficeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-transparent transition-all"
                    placeholder="Jouw bedrijf"
                  />
                </div>
              </div>

              {/* Phone Field */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Telefoonnummer (optioneel)
                </label>
                <div className="relative">
                  <PhoneIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-transparent transition-all"
                    placeholder="06 12345678"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.div>
              )}

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={isLoading}
                className="w-full chat-button py-3 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Bezig...</span>
                  </div>
                ) : (
                  <span>Doorgaan als gast</span>
                )}
              </motion.button>
            </form>

            {/* Benefits */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center space-x-3 text-white/60 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Geen wachtwoord nodig</span>
              </div>
              <div className="flex items-center space-x-3 text-white/60 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Direct bestellen</span>
              </div>
              <div className="flex items-center space-x-3 text-white/60 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Later account aanmaken mogelijk</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
