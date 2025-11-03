'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { LockClosedIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { createBrowserClient } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const router = useRouter();
  const supabase = createBrowserClient();

  // Verify the session on mount
  useEffect(() => {
    let mounted = true;

    const verifyResetToken = async () => {
      try {
        console.log('🔍 Starting password reset verification...');
        
        // Extract token from URL hash manually
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const tokenType = hashParams.get('type');
        
        console.log('📍 Extracted from hash:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken,
          type: tokenType 
        });
        
        if (!accessToken || tokenType !== 'recovery') {
          console.error('❌ No valid recovery token in URL');
          setError('Deze reset link is ongeldig. Vraag een nieuwe aan.');
          setIsVerifying(false);
          return;
        }
        
        // Manually set the session using the tokens from the URL
        console.log('🔄 Setting session with recovery token...');
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
        
        if (!mounted) return;
        
        if (error) {
          console.error('❌ Error setting session:', error);
          setError('Deze reset link is verlopen of ongeldig. Vraag een nieuwe aan.');
          setIsVerifying(false);
          return;
        }
        
        if (data.session && data.user) {
          console.log('✅ Valid password reset session established for:', data.user.email);
          setIsVerifying(false);
        } else {
          console.log('❌ Could not establish session');
          setError('Deze reset link is verlopen of ongeldig. Vraag een nieuwe aan.');
          setIsVerifying(false);
        }
      } catch (error) {
        console.error('❌ Verification error:', error);
        if (mounted) {
          setError('Er ging iets mis. Probeer het opnieuw.');
          setIsVerifying(false);
        }
      }
    };

    verifyResetToken();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  // Show loading state while verifying session
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-white text-lg">Link verifiëren...</p>
        </motion.div>
      </div>
    );
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password.length < 6) {
      setError('Wachtwoord moet minimaal 6 karakters zijn');
      return;
    }

    if (password !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen');
      return;
    }

    setIsLoading(true);

    try {
      // Update password using Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/?login=true');
      }, 3000);
    } catch (error: any) {
      console.error('Password reset error:', error);
      setError(error.message || 'Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Wachtwoord Gewijzigd! ✅
          </h1>
          <p className="text-gray-600 mb-6">
            Je wachtwoord is succesvol gewijzigd. Je wordt doorgestuurd naar de login pagina...
          </p>
          <div className="animate-pulse text-brand-orange font-medium">
            Doorsturen...
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-purple to-brand-pink flex flex-col">
      {/* Header */}
      <motion.div
        className="w-full bg-white/10 backdrop-blur-sm border-b border-white/20 py-6"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white">🔐 WarmeLeads</h1>
          <p className="text-white/80 text-sm mt-1">Verse Leads, Warme Resultaten</p>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-gradient-to-br from-orange-100 to-red-100 rounded-2xl mb-4">
                <LockClosedIcon className="w-10 h-10 text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Nieuw wachtwoord instellen
              </h2>
              <p className="text-gray-600">
                Kies een nieuw, sterk wachtwoord voor je account
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-6">
              {/* Password Field */}
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  Nieuw wachtwoord
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                    placeholder="Minimaal 6 karakters"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  Bevestig wachtwoord
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                    placeholder="Herhaal je wachtwoord"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Wachtwoord sterkte:</div>
                  <div className="flex gap-2">
                    <div className={`h-2 flex-1 rounded-full ${password.length >= 6 ? 'bg-orange-500' : 'bg-gray-200'}`} />
                    <div className={`h-2 flex-1 rounded-full ${password.length >= 8 ? 'bg-orange-500' : 'bg-gray-200'}`} />
                    <div className={`h-2 flex-1 rounded-full ${password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? 'bg-green-500' : 'bg-gray-200'}`} />
                  </div>
                  <div className="text-xs text-gray-500">
                    {password.length < 6 && 'Te kort (min. 6 karakters)'}
                    {password.length >= 6 && password.length < 8 && 'Redelijk (8+ karakters is beter)'}
                    {password.length >= 8 && password.length < 10 && 'Goed (voeg hoofdletter & cijfer toe voor sterk)'}
                    {password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password) && '✅ Sterk wachtwoord!'}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Bezig met wijzigen...' : 'Wachtwoord Wijzigen'}
              </button>
            </form>

            {/* Security Note */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-900">
                💡 <strong>Tip:</strong> Gebruik een uniek wachtwoord dat je nergens anders gebruikt.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

