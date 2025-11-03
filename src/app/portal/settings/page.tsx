'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeftIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  LockClosedIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/auth';

export default function AccountSettingsPage() {
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    company: '',
    phone: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  
  const { user, logout, updateProfile } = useAuthStore();
  const router = useRouter();

  // Load user data on mount
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        company: user.company || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user?.email,
          updates: profileData
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Profiel succesvol bijgewerkt!' });
        
        // Update local auth store
        updateProfile(profileData);
        
        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: result.error || 'Er is een fout opgetreden bij het bijwerken van uw profiel.' });
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setMessage({ type: 'error', text: 'Er is een netwerkfout opgetreden. Probeer het opnieuw.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Nieuwe wachtwoorden komen niet overeen.' });
      setIsLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Nieuw wachtwoord moet minimaal 6 karakters bevatten.' });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user?.email,
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Wachtwoord succesvol gewijzigd!' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        
        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: result.error || 'Er is een fout opgetreden bij het wijzigen van uw wachtwoord.' });
      }
    } catch (error) {
      console.error('Password change error:', error);
      setMessage({ type: 'error', text: 'Er is een netwerkfout opgetreden. Probeer het opnieuw.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    // Logout handles redirect to login screen automatically
    logout();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">Niet ingelogd</h1>
          <p className="mb-6">U moet ingelogd zijn om deze pagina te bekijken.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-white/90 transition-colors"
          >
            Terug naar Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between p-4 glass-effect"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => router.push('/portal')}
          className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="text-sm">Terug naar Portal</span>
        </button>
        
        <div className="text-center flex-1 px-4">
          <h1 className="text-white font-bold text-xl">Account Instellingen</h1>
          <p className="text-white/60 text-sm">
            Beheer uw profiel en beveiligingsinstellingen
          </p>
        </div>
        
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-all"
        >
          <UserIcon className="w-4 h-4" />
          <span className="text-sm">Uitloggen</span>
        </button>
      </motion.div>

      <div className="p-4 max-w-4xl mx-auto">
        {/* Tab Navigation */}
        <motion.div
          className="flex space-x-1 bg-white/10 backdrop-blur-sm rounded-xl p-1 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'profile'
                ? 'bg-white text-purple-600 shadow-lg'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <UserIcon className="w-4 h-4 inline mr-2" />
            Profiel
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'password'
                ? 'bg-white text-purple-600 shadow-lg'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <LockClosedIcon className="w-4 h-4 inline mr-2" />
            Wachtwoord
          </button>
        </motion.div>

        {/* Message Display */}
        {message && (
          <motion.div
            className={`mb-6 p-4 rounded-xl flex items-center space-x-3 ${
              message.type === 'success'
                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                : 'bg-red-500/20 border border-red-500/30 text-red-400'
            }`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {message.type === 'success' ? (
              <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
            ) : (
              <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="font-medium">{message.text}</span>
          </motion.div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <motion.div
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-white font-bold text-xl mb-6">Profiel Informatie</h2>
            
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    <UserIcon className="w-4 h-4 inline mr-2" />
                    Volledige Naam
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                    placeholder="Uw volledige naam"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    <EnvelopeIcon className="w-4 h-4 inline mr-2" />
                    E-mailadres
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white/60 cursor-not-allowed"
                    placeholder="Uw e-mailadres"
                  />
                  <p className="text-white/50 text-xs mt-1">E-mailadres kan niet worden gewijzigd</p>
                </div>

                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    <BuildingOfficeIcon className="w-4 h-4 inline mr-2" />
                    Bedrijf
                  </label>
                  <input
                    type="text"
                    value={profileData.company}
                    onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                    placeholder="Uw bedrijfsnaam"
                  />
                </div>

                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    <PhoneIcon className="w-4 h-4 inline mr-2" />
                    Telefoonnummer
                  </label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                    placeholder="+31 6 12345678"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <motion.button
                  type="submit"
                  disabled={isLoading}
                  className="bg-white text-purple-600 px-8 py-3 rounded-xl font-semibold hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  whileHover={{ scale: isLoading ? 1 : 1.02 }}
                  whileTap={{ scale: isLoading ? 1 : 0.98 }}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Opslaan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>Profiel Opslaan</span>
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <motion.div
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-white font-bold text-xl mb-6">Wachtwoord Wijzigen</h2>
            
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  <LockClosedIcon className="w-4 h-4 inline mr-2" />
                  Huidig Wachtwoord
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                  placeholder="Voer uw huidige wachtwoord in"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Nieuw Wachtwoord
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                    placeholder="Minimaal 6 karakters"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Bevestig Nieuw Wachtwoord
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                    placeholder="Herhaal uw nieuwe wachtwoord"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4">
                <h3 className="text-blue-300 font-medium mb-2">Wachtwoord Vereisten:</h3>
                <ul className="text-blue-200 text-sm space-y-1">
                  <li>• Minimaal 6 karakters</li>
                  <li>• Gebruik een uniek wachtwoord</li>
                  <li>• Wijzig regelmatig uw wachtwoord</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <motion.button
                  type="submit"
                  disabled={isLoading}
                  className="bg-white text-purple-600 px-8 py-3 rounded-xl font-semibold hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  whileHover={{ scale: isLoading ? 1 : 1.02 }}
                  whileTap={{ scale: isLoading ? 1 : 0.98 }}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Wijzigen...</span>
                    </>
                  ) : (
                    <>
                      <LockClosedIcon className="w-4 h-4" />
                      <span>Wachtwoord Wijzigen</span>
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
