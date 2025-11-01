'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getCRMAnalytics, getOverdueInvoices } from '@/lib/crmSystem';
import {
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  CurrencyEuroIcon,
  ChartBarSquareIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeChats: 0,
    openInvoices: 0,
    overdueInvoices: 0,
    conversionRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const analytics = await getCRMAnalytics();
        const overdueInvoices = await getOverdueInvoices();
        
        setStats({
          totalCustomers: analytics.totalCustomers,
          totalOrders: analytics.totalOrders,
          totalRevenue: analytics.totalRevenue,
          activeChats: analytics.activeCustomers,
          openInvoices: analytics.openInvoices,
          overdueInvoices: overdueInvoices.length,
          conversionRate: analytics.conversionRate
        });
      } catch (error) {
        console.error('Error loading admin stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSendFollowUps = async () => {
    try {
      const response = await fetch('/api/follow-up-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ ${result.emailsSent} follow-up emails verzonden!`);
      } else {
        alert('❌ Fout bij verzenden emails');
      }
    } catch (error) {
      console.error('Error sending follow-ups:', error);
      alert('❌ Fout bij verzenden emails');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Dashboard laden...</p>
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
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overzicht van uw leadgeneratie business</p>
        </div>
        
        {stats.overdueInvoices > 0 && (
          <motion.button
            onClick={handleSendFollowUps}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <ExclamationTriangleIcon className="w-5 h-5" />
            <span>Verstuur {stats.overdueInvoices} follow-ups</span>
          </motion.button>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Customers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totaal Klanten</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalCustomers}</p>
              <p className="text-sm text-green-600">+{stats.activeChats} actief</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <UserGroupIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </motion.div>

        {/* Total Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Bestellingen</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
              <p className="text-sm text-blue-600">{stats.conversionRate.toFixed(1)}% conversie</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <ChartBarSquareIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </motion.div>

        {/* Total Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Omzet</p>
              <p className="text-3xl font-bold text-gray-900">€{stats.totalRevenue.toLocaleString()}</p>
              <p className="text-sm text-green-600">
                <ArrowTrendingUpIcon className="w-4 h-4 inline mr-1" />
                Groeiend
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <CurrencyEuroIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </motion.div>

        {/* Open Invoices */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open Facturen</p>
              <p className="text-3xl font-bold text-gray-900">{stats.openInvoices}</p>
              <p className={`text-sm ${stats.overdueInvoices > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {stats.overdueInvoices > 0 ? `${stats.overdueInvoices} te laat` : 'Alles up-to-date'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              stats.overdueInvoices > 0 ? 'bg-red-100' : 'bg-orange-100'
            }`}>
              <DocumentTextIcon className={`w-6 h-6 ${
                stats.overdueInvoices > 0 ? 'text-red-600' : 'text-orange-600'
              }`} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Alerts */}
      {stats.overdueInvoices > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-orange-50 border border-orange-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ExclamationTriangleIcon className="w-8 h-8 text-orange-600" />
              <div>
                <h3 className="font-semibold text-orange-800">
                  {stats.overdueInvoices} openstaande facturen vereisen aandacht
                </h3>
                <p className="text-orange-700">
                  Deze klanten hebben interesse getoond maar nog niet betaald. Verstuur follow-up emails voor betere conversie.
                </p>
              </div>
            </div>
            <button
              onClick={handleSendFollowUps}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              📧 Verstuur Follow-ups
            </button>
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-4">Snelle Acties</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/admin/customers"
            className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <UserGroupIcon className="w-8 h-8 text-blue-600" />
            <div>
              <div className="font-semibold text-blue-900">Bekijk Klanten</div>
              <div className="text-sm text-blue-700">Chat geschiedenis & facturen</div>
            </div>
          </a>
          
          <a
            href="/admin/chats"
            className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <ChatBubbleLeftRightIcon className="w-8 h-8 text-green-600" />
            <div>
              <div className="font-semibold text-green-900">Live Chats</div>
              <div className="text-sm text-green-700">Actieve conversaties</div>
            </div>
          </a>
          
          <button
            onClick={handleSendFollowUps}
            className="flex items-center space-x-3 p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
          >
            <ClockIcon className="w-8 h-8 text-orange-600" />
            <div>
              <div className="font-semibold text-orange-900">Follow-up Emails</div>
              <div className="text-sm text-orange-700">Openstaande facturen</div>
            </div>
          </button>
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recente Activiteit</h2>
        <p className="text-gray-600">
          CRM systeem is actief en tracked alle klantinteracties automatisch.
          Bezoek de klanten pagina voor gedetailleerde chat geschiedenis en factuur status.
        </p>
      </motion.div>
    </div>
  );
}