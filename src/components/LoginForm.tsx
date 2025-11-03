'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeftIcon,
  EyeIcon,
  EyeSlashIcon,
  UserIcon,
  LockClosedIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../lib/auth';
import { ADMIN_CONFIG } from '@/config/admin';

interface LoginFormProps {
  onBack: () => void;
  onSwitchToRegister: () => void;
  onSwitchToGuest: () => void;
  onSuccess: () => void;
}

export function LoginForm({ onBack, onSwitchToRegister, onSwitchToGuest, onSuccess }: LoginFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    company: '',
    phone: ''
  });

  const { login, register, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          company: formData.company,
          phone: formData.phone
        });
      }
      onSuccess();
    } catch (error) {
      // Error is handled by the store
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    
    try {
      // Call Supabase password reset
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });

      if (!response.ok) {
        throw new Error('Er ging iets mis');
      }

      setResetSent(true);
    } catch (error) {
      setResetError('Er ging iets mis. Probeer het opnieuw.');
    }
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col"
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
          <h1 className="text-white font-bold text-xl">
            {isLogin ? 'Inloggen' : 'Account aanmaken'}
          </h1>
          <p className="text-white/60 text-sm">
            {isLogin ? 'Log in op je account' : 'Maak een nieuw account aan'}
          </p>
        </div>
      </motion.div>

      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Form Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
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
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Wachtwoord
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
                {isLogin && (
                  <div className="text-right mt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetModal(true)}
                      className="text-sm text-white/60 hover:text-white transition-colors"
                    >
                      Wachtwoord vergeten?
                    </button>
                  </div>
                )}
              </div>

              {/* Additional fields for registration */}
              {!isLogin && (
                <>
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

                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Bedrijfsnaam (optioneel)
                    </label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-transparent transition-all"
                      placeholder="Jouw bedrijf"
                    />
                  </div>

                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Telefoonnummer (optioneel)
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-transparent transition-all"
                      placeholder="06 12345678"
                    />
                  </div>
                </>
              )}

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
                    <span>{isLogin ? 'Inloggen...' : 'Aanmaken...'}</span>
                  </div>
                ) : (
                  <span>{isLogin ? 'Inloggen' : 'Account aanmaken'}</span>
                )}
              </motion.button>
            </form>

            {/* Demo Info */}
            {ADMIN_CONFIG.demoAccount && (
              <div className="mt-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl">
                <p className="text-blue-300 text-sm text-center">
                  <strong>Demo account:</strong><br />
                  Email: {ADMIN_CONFIG.demoAccount.email}<br />
                  Wachtwoord: {ADMIN_CONFIG.demoAccount.password}
                </p>
              </div>
            )}
          </div>

          {/* Action Links */}
          <div className="mt-6 text-center space-y-4">
            <motion.button
              onClick={() => setIsLogin(!isLogin)}
              className="text-white/60 hover:text-white transition-colors text-sm"
              whileHover={{ scale: 1.05 }}
            >
              {isLogin ? 'Nog geen account? Maak er een aan' : 'Al een account? Log in'}
            </motion.button>

            <div className="text-white/40 text-xs">of</div>

            <motion.button
              onClick={onSwitchToGuest}
              className="text-brand-pink hover:text-brand-orange transition-colors text-sm font-medium"
              whileHover={{ scale: 1.05 }}
            >
              Doorgaan als gast (geen account nodig)
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {showResetModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div 
                className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-2xl max-w-md w-full p-8"
                onClick={(e) => e.stopPropagation()}
              >
                {!resetSent ? (
                  <>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      Wachtwoord vergeten?
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Geen probleem! Vul je email adres in en we sturen je een link om je wachtwoord opnieuw in te stellen.
                    </p>

                    <form onSubmit={handlePasswordReset} className="space-y-4">
                      <div>
                        <label className="block text-gray-700 text-sm font-medium mb-2">
                          Email adres
                        </label>
                        <div className="relative">
                          <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-pink focus:border-transparent"
                            placeholder="jouw@email.nl"
                            required
                          />
                        </div>
                      </div>

                      {resetError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                          {resetError}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowResetModal(false);
                            setResetEmail('');
                            setResetError('');
                          }}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                        >
                          Annuleren
                        </button>
                        <button
                          type="submit"
                          className="flex-1 px-4 py-3 bg-gradient-to-r from-brand-purple to-brand-pink text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                        >
                          Verstuur link
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        Email verstuurd! ✅
                      </h3>
                      <p className="text-gray-600 mb-6">
                        We hebben een wachtwoord reset link gestuurd naar <span className="font-semibold">{resetEmail}</span>. Check je inbox!
                      </p>
                      <button
                        onClick={() => {
                          setShowResetModal(false);
                          setResetSent(false);
                          setResetEmail('');
                        }}
                        className="w-full px-4 py-3 bg-gradient-to-r from-brand-purple to-brand-pink text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                      >
                        Sluiten
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
