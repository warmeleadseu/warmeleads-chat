'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircleIcon,
  UserIcon,
  LockClosedIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../lib/auth';

interface AccountCreationProps {
  onSuccess: () => void;
  onSkip: () => void;
}

export function AccountCreation({ onSuccess, onSkip }: AccountCreationProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    company: '',
    phone: ''
  });

  const { createAccountFromGuest, isLoading, error, clearError, user } = useAuthStore();

  // Pre-fill with guest data if available
  React.useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        email: user.email,
        name: user.name,
        company: user.company || '',
        phone: user.phone || ''
      }));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (formData.password !== formData.confirmPassword) {
      // Set error manually since the store doesn't handle this
      return;
    }

    try {
      await createAccountFromGuest({
        email: formData.email,
        password: formData.password,
        name: formData.name,
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

  const passwordMismatch = formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword;

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Success Card */}
          <div className="bg-green-500/20 border border-green-500/30 rounded-2xl p-6 mb-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon className="w-8 h-8 text-green-300" />
              </div>
              <h3 className="text-green-300 font-semibold mb-2">Bestelling succesvol!</h3>
              <p className="text-green-200 text-sm">
                Uw leads worden binnen 15 minuten geleverd. 
                Maak nu een account aan voor extra voordelen!
              </p>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="text-center mb-6">
              <h2 className="text-white font-bold text-xl mb-2">Account aanmaken</h2>
              <p className="text-white/60 text-sm">
                Krijg toegang tot uw bestellingen en profiteer van klantvoordelen
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Email adres
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
                    disabled
                  />
                </div>
                <p className="text-white/40 text-xs mt-1">Email is vooraf ingevuld</p>
              </div>

              {/* Name Field */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Naam
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

              {/* Password Field */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Wachtwoord *
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Bevestig wachtwoord *
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 bg-white/10 border rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-transparent transition-all ${
                      passwordMismatch ? 'border-red-500/50' : 'border-white/20'
                    }`}
                    placeholder="••••••••"
                    required
                  />
                </div>
                {passwordMismatch && (
                  <p className="text-red-400 text-xs mt-1">Wachtwoorden komen niet overeen</p>
                )}
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
                disabled={isLoading || !!passwordMismatch}
                className="w-full chat-button py-3 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Account aanmaken...</span>
                  </div>
                ) : (
                  <span>Account aanmaken</span>
                )}
              </motion.button>
            </form>

            {/* Benefits */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center space-x-3 text-white/60 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Toegang tot alle bestellingen</span>
              </div>
              <div className="flex items-center space-x-3 text-white/60 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Klantvoordelen en kortingen</span>
              </div>
              <div className="flex items-center space-x-3 text-white/60 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Snelle herbestelling</span>
              </div>
            </div>
          </div>

          {/* Skip Option */}
          <div className="mt-6 text-center">
            <motion.button
              onClick={onSkip}
              className="text-white/60 hover:text-white transition-colors text-sm"
              whileHover={{ scale: 1.05 }}
            >
              Later account aanmaken
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
