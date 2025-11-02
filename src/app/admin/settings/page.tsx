'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CogIcon,
  GlobeAltIcon,
  CurrencyEuroIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  ShieldCheckIcon,
  KeyIcon
} from '@heroicons/react/24/outline';

interface Settings {
  website: {
    title: string;
    description: string;
    contactEmail: string;
    contactPhone: string;
    whatsappNumber: string;
  };
  pricing: {
    thuisbatterijen: { exclusive: number; shared: number; };
    zonnepanelen: { exclusive: number; shared: number; };
    warmtepompen: { exclusive: number; shared: number; };
    financialLease: { exclusive: number; shared: number; };
  };
  integrations: {
    stripePublishableKey: string;
    stripeSecretKey: string;
    openaiApiKey: string;
    googleAnalyticsId: string;
  };
  notifications: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    slackWebhook: string;
  };
}

const defaultSettings: Settings = {
  website: {
    title: 'WarmeLeads - Verse Leads Nederland',
    description: 'Koop verse leads voor thuisbatterijen, zonnepanelen, warmtepompen, airco\'s en financial lease',
    contactEmail: 'info@warmeleads.eu',
    contactPhone: '+31850477067',
    whatsappNumber: '+31613927338'
  },
  pricing: {
    thuisbatterijen: { exclusive: 40.00, shared: 12.50 },
    zonnepanelen: { exclusive: 42.50, shared: 15.00 },
    warmtepompen: { exclusive: 47.50, shared: 16.50 },
    financialLease: { exclusive: 50.00, shared: 18.50 }
  },
  integrations: {
    stripePublishableKey: 'pk_live_...',
    stripeSecretKey: 'sk_live_...',
    openaiApiKey: 'sk-proj-...',
    googleAnalyticsId: 'G-PBJPRGK8VL'
  },
  notifications: {
    emailNotifications: true,
    smsNotifications: false,
    slackWebhook: ''
  }
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [activeTab, setActiveTab] = useState('website');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/settings');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Merge with default settings
          setSettings({
            ...defaultSettings,
            ...data.settings
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        const data = await response.json();
        alert('✅ ' + data.message);
      } else {
        const error = await response.json();
        alert('❌ Fout: ' + error.error);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('❌ Fout bij opslaan van instellingen');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'website', name: 'Website', icon: GlobeAltIcon },
    { id: 'pricing', name: 'Prijzen', icon: CurrencyEuroIcon },
    { id: 'integrations', name: 'Integraties', icon: KeyIcon },
    { id: 'notifications', name: 'Notificaties', icon: BellIcon }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Instellingen laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-gray-900">Instellingen</h1>
        <p className="text-gray-600 mt-1">
          Configureer uw website, prijzen en integraties
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-brand-pink text-brand-pink'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="admin-card"
      >
        {activeTab === 'website' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Website Instellingen</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Website Titel</label>
                <input
                  type="text"
                  value={settings.website.title}
                  onChange={(e) => setSettings({
                    ...settings,
                    website: { ...settings.website, title: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                <input
                  type="email"
                  value={settings.website.contactEmail}
                  onChange={(e) => setSettings({
                    ...settings,
                    website: { ...settings.website, contactEmail: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telefoon</label>
                <input
                  type="tel"
                  value={settings.website.contactPhone}
                  onChange={(e) => setSettings({
                    ...settings,
                    website: { ...settings.website, contactPhone: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp Nummer</label>
                <input
                  type="tel"
                  value={settings.website.whatsappNumber}
                  onChange={(e) => setSettings({
                    ...settings,
                    website: { ...settings.website, whatsappNumber: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Website Beschrijving</label>
              <textarea
                value={settings.website.description}
                onChange={(e) => setSettings({
                  ...settings,
                  website: { ...settings.website, description: e.target.value }
                })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
              />
            </div>
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Prijzen per Branche</h3>
            
            {Object.entries(settings.pricing).map(([industry, prices]) => (
              <div key={industry} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-4 capitalize">
                  {industry.replace(/([A-Z])/g, ' $1').trim()}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Exclusief (€ per lead)</label>
                    <input
                      type="number"
                      step="0.50"
                      value={prices.exclusive}
                      onChange={(e) => setSettings({
                        ...settings,
                        pricing: {
                          ...settings.pricing,
                          [industry]: { ...prices, exclusive: parseFloat(e.target.value) }
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Gedeeld (€ per lead)</label>
                    <input
                      type="number"
                      step="0.50"
                      value={prices.shared}
                      onChange={(e) => setSettings({
                        ...settings,
                        pricing: {
                          ...settings.pricing,
                          [industry]: { ...prices, shared: parseFloat(e.target.value) }
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">API Integraties</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stripe Publishable Key</label>
                <input
                  type="text"
                  value={settings.integrations.stripePublishableKey}
                  onChange={(e) => setSettings({
                    ...settings,
                    integrations: { ...settings.integrations, stripePublishableKey: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
                  placeholder="pk_live_..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">OpenAI API Key</label>
                <input
                  type="password"
                  value={settings.integrations.openaiApiKey}
                  onChange={(e) => setSettings({
                    ...settings,
                    integrations: { ...settings.integrations, openaiApiKey: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
                  placeholder="sk-proj-..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Google Analytics ID</label>
                <input
                  type="text"
                  value={settings.integrations.googleAnalyticsId}
                  onChange={(e) => setSettings({
                    ...settings,
                    integrations: { ...settings.integrations, googleAnalyticsId: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
                  placeholder="G-XXXXXXXXXX"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Notificatie Instellingen</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">Email Notificaties</div>
                  <div className="text-sm text-gray-500">Ontvang emails bij nieuwe bestellingen</div>
                </div>
                <button
                  onClick={() => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, emailNotifications: !settings.notifications.emailNotifications }
                  })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.notifications.emailNotifications ? 'bg-brand-pink' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.notifications.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">SMS Notificaties</div>
                  <div className="text-sm text-gray-500">Ontvang SMS bij urgente zaken</div>
                </div>
                <button
                  onClick={() => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, smsNotifications: !settings.notifications.smsNotifications }
                  })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.notifications.smsNotifications ? 'bg-brand-pink' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.notifications.smsNotifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Slack Webhook URL</label>
                <input
                  type="url"
                  value={settings.notifications.slackWebhook}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, slackWebhook: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
                  placeholder="https://hooks.slack.com/..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-gradient-to-r from-brand-purple to-brand-pink text-white px-6 py-3 rounded-lg font-semibold hover:scale-105 transition-transform disabled:opacity-50"
          >
            {isSaving ? 'Opslaan...' : 'Instellingen Opslaan'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}






