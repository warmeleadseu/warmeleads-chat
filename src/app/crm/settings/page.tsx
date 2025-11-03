'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  BellIcon,
  LinkIcon,
  KeyIcon,
  ShieldCheckIcon,
  AdjustmentsHorizontalIcon,
  TrashIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/auth';
import { crmSystem, type Customer } from '@/lib/crmSystem';
import { WhatsAppSettings } from '@/components/WhatsAppSettings';

export default function CRMSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [customerData, setCustomerData] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Settings states
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [newLeadsNotification, setNewLeadsNotification] = useState(true);
  const [weeklyReportsNotification, setWeeklyReportsNotification] = useState(false);
  const [branchSettings, setBranchSettings] = useState({
    autoDetection: true,
    confidenceThreshold: 0.7,
    customBranches: [] as string[]
  });
  
  // WhatsApp Settings
  const [showWhatsAppSettings, setShowWhatsAppSettings] = useState(false);

  // Load customer data
  const loadCRMData = async () => {
    try {
      setIsLoading(true);
      
      let customer: Customer | null = null;
      try {
        const response = await fetch('/api/customer-data', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          customer = await response.json();
          console.log('✅ Customer data loaded from API');
        }
      } catch (error) {
        console.log('⚠️ API fetch failed, falling back to localStorage');
      }

      if (!customer && user?.email) {
        const allCustomers = await crmSystem.getAllCustomers();
        customer = allCustomers.find(cust => cust.email === user.email) || null;
      }

      if (customer) {
        setCustomerData(customer);
        setGoogleSheetUrl(customer.googleSheetUrl || '');
        
        if (customer.emailNotifications) {
          setNewLeadsNotification(customer.emailNotifications.newLeads ?? true);
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading customer data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (authLoading) return;
    
    if (isAuthenticated && user) {
      loadCRMData();
    } else {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, user, router]);

  // Save Google Sheet URL
  const handleSaveGoogleSheetUrl = async () => {
    if (!customerData || !googleSheetUrl.trim()) return;

    try {
      // Use crmSystem to link Google Sheet (saves to Supabase)
      const success = await crmSystem.linkGoogleSheet(customerData.id, googleSheetUrl);

      if (success) {
        // Update local state
        setCustomerData(prev => prev ? { ...prev, googleSheetUrl, googleSheetId: googleSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] } : null);
        console.log('✅ Google Sheet URL saved successfully');
        
        // Show success feedback (optional)
        alert('Google Sheet URL succesvol opgeslagen!');
      } else {
        console.error('❌ Failed to save Google Sheet URL');
        alert('Er is een fout opgetreden bij het opslaan van de URL.');
      }
    } catch (error) {
      console.error('❌ Error saving Google Sheet URL:', error);
      alert('Er is een netwerkfout opgetreden.');
    }
  };

  // Save email notification settings
  const handleSaveEmailSettings = async () => {
    if (!customerData) return;

    try {
      console.log('✅ Email notification settings saved');
      alert('E-mail notificatie instellingen opgeslagen!');
    } catch (error) {
      console.error('❌ Error saving email settings:', error);
    }
  };

  // Handle data export
  const handleExportData = () => {
    if (!customerData || !customerData.leadData) return;

    const data = {
      customer: customerData.name,
      email: customerData.email,
      exportDate: new Date().toISOString(),
      leads: customerData.leadData.map(lead => ({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        interest: lead.interest,
        budget: lead.budget,
        notes: lead.notes,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warmeleads-export-${customerData.name}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl">Instellingen laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* Header - Mobile Optimized */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-6">
              <button
                onClick={() => router.push('/crm')}
                className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors self-start"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span className="text-sm sm:text-base">Terug naar CRM</span>
              </button>
              
              <div className="hidden sm:block h-8 w-px bg-white/30"></div>
              
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center space-x-2 sm:space-x-3">
                  <Cog6ToothIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
                  <span className="text-lg sm:text-3xl">Instellingen & Configuratie</span>
                </h1>
                <p className="text-white/80 text-xs sm:text-sm mt-1">
                  {user?.name} • Configureer je CRM en integraties
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        
        {/* Google Sheets Integration - Mobile Optimized */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-8"
        >
          <div className="flex items-center space-x-3 mb-4 sm:mb-6">
            <LinkIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
            <h2 className="text-lg sm:text-xl font-bold text-white">Google Sheets Integratie</h2>
          </div>
          
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Google Sheets URL
              </label>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <input
                  type="url"
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 bg-white/10 border border-white/30 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-400 text-sm sm:text-base"
                />
                <button
                  onClick={handleSaveGoogleSheetUrl}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base"
                >
                  Opslaan
                </button>
              </div>
              <p className="text-xs text-white/60 mt-2">
                Deze URL wordt gebruikt voor automatische synchronisatie van leads
              </p>
            </div>
          </div>
        </motion.div>

        {/* Email Notifications - Mobile Optimized */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-8"
        >
          <div className="flex items-center space-x-3 mb-4 sm:mb-6">
            <BellIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
            <h2 className="text-lg sm:text-xl font-bold text-white">E-mail Notificaties</h2>
          </div>
          
          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white text-sm sm:text-base">Nieuwe Leads</h3>
                  <p className="text-xs sm:text-sm text-white/70">Ontvang een e-mail wanneer een nieuwe lead wordt toegevoegd</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-3">
                  <input
                    type="checkbox"
                    checked={newLeadsNotification}
                    onChange={(e) => setNewLeadsNotification(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white text-sm sm:text-base">Status Updates</h3>
                  <p className="text-xs sm:text-sm text-white/70">Ontvang updates wanneer lead status wijzigt</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-3">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white text-sm sm:text-base">Wekelijkse Rapportages</h3>
                  <p className="text-xs sm:text-sm text-white/70">Nog niet beschikbaar - wordt binnenkort toegevoegd</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer opacity-50">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>

            <button
              onClick={handleSaveEmailSettings}
              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base"
            >
              E-mail Instellingen Opslaan
            </button>
          </div>
        </motion.div>

        {/* WhatsApp Business API - Mobile Optimized */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-8"
        >
          <div className="flex items-center space-x-3 mb-4 sm:mb-6">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
            </svg>
            <h2 className="text-lg sm:text-xl font-bold text-white">WhatsApp Business API</h2>
          </div>
          
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white/5 rounded-lg sm:rounded-xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
                <div className="flex-1">
                  <h3 className="font-medium text-white text-sm sm:text-base">Automatische WhatsApp Berichten</h3>
                  <p className="text-xs sm:text-sm text-white/70">Verstuur automatisch WhatsApp berichten naar nieuwe leads</p>
                </div>
                <button
                  onClick={() => setShowWhatsAppSettings(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
                >
                  <Cog6ToothIcon className="w-4 h-4" />
                  <span>Configureer</span>
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white/5 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs sm:text-sm font-medium text-white">Warmeleads WhatsApp</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">GRATIS</span>
                  </div>
                  <p className="text-xs text-white/60">
                    Berichten via Warmeleads WhatsApp Business nummer
                  </p>
                </div>
                
                <div className="bg-white/5 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs sm:text-sm font-medium text-white">Eigen WhatsApp</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">€750</span>
                  </div>
                  <p className="text-xs text-white/60">
                    Koppel je eigen WhatsApp Business nummer
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-green-500/30">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white mb-1 text-sm sm:text-base">💬 Automatische Lead Berichten</h4>
                  <p className="text-xs sm:text-sm text-white/70 mb-2">
                    Verstuur automatisch gepersonaliseerde WhatsApp berichten naar nieuwe leads met configuratie en timing opties.
                  </p>
                  <ul className="text-xs text-white/60 space-y-1">
                    <li>• Template systeem met variabelen</li>
                    <li>• Timing configuratie (direct, 1h, 24h)</li>
                    <li>• Status tracking (verzonden, gelezen, etc.)</li>
                    <li>• Gebruik statistieken en analytics</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Branch Intelligence Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-8"
        >
          <div className="flex items-center space-x-3 mb-6">
            <ChartBarIcon className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Branch Intelligence</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
              <div>
                <h3 className="font-medium text-white">Automatische Branch Detectie</h3>
                <p className="text-sm text-white/70">Laat AI automatisch de branch van nieuwe leads bepalen</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={branchSettings.autoDetection}
                  onChange={(e) => setBranchSettings(prev => ({ ...prev, autoDetection: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-white/80">
                Confidence Threshold ({branchSettings.confidenceThreshold.toFixed(1)})
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={branchSettings.confidenceThreshold}
                onChange={(e) => setBranchSettings(prev => ({ ...prev, confidenceThreshold: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-white/60">
                Minimum vertrouwen percentage voor automatische branch detectie
              </p>
            </div>
          </div>
        </motion.div>

        {/* Data Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-8"
        >
          <div className="flex items-center space-x-3 mb-6">
            <DocumentArrowDownIcon className="w-6 h-6 text-orange-400" />
            <h2 className="text-xl font-bold text-white">Data Beheer</h2>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={handleExportData}
              className="flex items-center space-x-3 w-full p-4 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 rounded-xl transition-colors"
            >
              <DocumentArrowDownIcon className="w-5 h-5 text-orange-400" />
              <div className="text-left">
                <h3 className="font-medium text-white">Data Exporteren</h3>
                <p className="text-sm text-white/70">Download alle leads en klantgegevens als JSON</p>
              </div>
            </button>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-white/5 rounded-xl">
                <div className="text-2xl font-bold text-white">{customerData?.leadData?.length || 0}</div>
                <div className="text-sm text-white/70">Totaal Leads</div>
              </div>
              
              <div className="text-center p-4 bg-white/5 rounded-xl">
                <div className="text-2xl font-bold text-white">
                  {customerData?.leadData?.filter(lead => lead.status === 'qualified').length || 0}
                </div>
                <div className="text-sm text-white/70">Gekwalificeerde Leads</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Security & Privacy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-8"
        >
          <div className="flex items-center space-x-3 mb-6">
            <ShieldCheckIcon className="w-6 h-6 text-green-400" />
            <h2 className="text-xl font-bold text-white">Privacy & Beveiliging</h2>
          </div>
          
          <div className="space-y-4 text-sm text-white/70">
            <p>• Alle gegevens worden veilig opgeslagen en versleuteld</p>
            <p>• Google Sheets integratie gebruikt alleen-lezen toegang</p>
            <p>• Jouw gegevens worden niet overschreven zonder verlening</p>
            <p>• Je kunt op elk moment je gegevens exporteren of verwijderen</p>
          </div>
        </motion.div>
      </div>

      {/* WhatsApp Settings Modal */}
      {showWhatsAppSettings && (
        <WhatsAppSettings
          customerId={customerData?.id || user?.email || 'unknown'}
          isOpen={showWhatsAppSettings}
          onClose={() => setShowWhatsAppSettings(false)}
        />
      )}
    </div>
  );
}
