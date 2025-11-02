'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  UsersIcon,
  CurrencyEuroIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  DevicePhoneMobileIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

interface AnalyticsData {
  overview: {
    totalVisitors: number;
    totalLeads: number;
    totalRevenue: number;
    conversionRate: string;
    trends: {
      visitors: string;
      leads: string;
      revenue: string;
      conversion: string;
    };
  };
  traffic: {
    chat: number;
    website: number;
    checkout: number;
    direct: number;
    other: number;
  };
  leadTypes: {
    exclusive: number;
    shared: number;
  };
  industries: Array<{
    name: string;
    orders: number;
    revenue: number;
  }>;
  topCustomers: Array<{
    email: string;
    revenue: number;
    orders: number;
  }>;
  revenueChart: Array<{
    date: string;
    revenue: number;
  }>;
  chatActivity: {
    totalMessages: number;
    uniqueUsers: number;
    averagePerUser: string;
  };
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      console.log('📊 Loading analytics for:', timeRange);
      
      const response = await fetch(`/api/admin/analytics?timeRange=${timeRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Analytics loaded:', data.analytics);
        setAnalytics(data.analytics);
      } else {
        console.error('❌ Failed to load analytics:', data.error);
      }
    } catch (error) {
      console.error('❌ Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
  };

  const getTrendIcon = (trend: string) => {
    if (trend.startsWith('+')) {
      return <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />;
    } else if (trend.startsWith('-')) {
      return <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />;
    }
    return null;
  };

  const getTrendColor = (trend: string) => {
    if (trend.startsWith('+')) return 'text-green-600';
    if (trend.startsWith('-')) return 'text-red-600';
    return 'text-gray-600';
  };

  if (isLoading || !analytics) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Analytics laden...</p>
        </div>
      </div>
    );
  }

  const totalTraffic = Object.values(analytics.traffic).reduce((a, b) => a + b, 0);
  const totalLeadTypes = analytics.leadTypes.exclusive + analytics.leadTypes.shared;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Inzichten in website performance en conversies
          </p>
        </div>
        
        <div className="flex gap-2 sm:gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
          >
            <option value="7d">Laatste 7 dagen</option>
            <option value="30d">Laatste 30 dagen</option>
            <option value="90d">Laatste 90 dagen</option>
            <option value="year">Dit jaar</option>
          </select>
          
          <button
            onClick={loadAnalytics}
            className="bg-brand-purple hover:bg-brand-purple/90 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
          >
            🔄
          </button>
        </div>
      </motion.div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <motion.div
          className="admin-card p-4 sm:p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-3">
            <UsersIcon className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500" />
            <div className={`flex items-center gap-1 ${getTrendColor(analytics.overview.trends.visitors)}`}>
              {getTrendIcon(analytics.overview.trends.visitors)}
              <span className="text-xs sm:text-sm font-semibold">{analytics.overview.trends.visitors}</span>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">{analytics.overview.totalVisitors}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Totaal Bezoekers</div>
        </motion.div>

        <motion.div
          className="admin-card p-4 sm:p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-3">
            <ChartBarIcon className="w-8 h-8 sm:w-10 sm:h-10 text-purple-500" />
            <div className={`flex items-center gap-1 ${getTrendColor(analytics.overview.trends.leads)}`}>
              {getTrendIcon(analytics.overview.trends.leads)}
              <span className="text-xs sm:text-sm font-semibold">{analytics.overview.trends.leads}</span>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">{analytics.overview.totalLeads}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Lead Bestellingen</div>
        </motion.div>

        <motion.div
          className="admin-card p-4 sm:p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <CurrencyEuroIcon className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" />
            <div className={`flex items-center gap-1 ${getTrendColor(analytics.overview.trends.revenue)}`}>
              {getTrendIcon(analytics.overview.trends.revenue)}
              <span className="text-xs sm:text-sm font-semibold">{analytics.overview.trends.revenue}</span>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">{formatCurrency(analytics.overview.totalRevenue)}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Totale Omzet</div>
        </motion.div>

        <motion.div
          className="admin-card p-4 sm:p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-3">
            <ArrowTrendingUpIcon className="w-8 h-8 sm:w-10 sm:h-10 text-pink-500" />
            <div className={`flex items-center gap-1 ${getTrendColor(analytics.overview.trends.conversion)}`}>
              {getTrendIcon(analytics.overview.trends.conversion)}
              <span className="text-xs sm:text-sm font-semibold">{analytics.overview.trends.conversion}</span>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">{analytics.overview.conversionRate}%</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Conversie Rate</div>
        </motion.div>
      </div>

      {/* Traffic Sources & Lead Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Traffic Sources */}
        <motion.div
          className="admin-card"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Traffic Bronnen</h3>
          <div className="space-y-3">
            {Object.entries(analytics.traffic).map(([source, count]) => {
              const percentage = totalTraffic > 0 ? ((count / totalTraffic) * 100).toFixed(1) : '0';
              return (
                <div key={source}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 capitalize">{source}</span>
                    <span className="font-semibold text-gray-900">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-brand-purple h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Lead Types */}
        <motion.div
          className="admin-card"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Types</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Exclusieve Leads</div>
                <div className="text-2xl font-bold text-purple-600">{analytics.leadTypes.exclusive}</div>
              </div>
              <div className="text-3xl">⭐</div>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Gedeelde Leads</div>
                <div className="text-2xl font-bold text-blue-600">{analytics.leadTypes.shared}</div>
              </div>
              <div className="text-3xl">🤝</div>
            </div>
            <div className="text-center pt-2 border-t border-gray-200">
              <div className="text-sm text-gray-600">Totaal</div>
              <div className="text-xl font-bold text-gray-900">{totalLeadTypes} bestellingen</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Industries & Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Industries */}
        <motion.div
          className="admin-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Branches</h3>
          <div className="space-y-3">
            {analytics.industries.slice(0, 5).map((industry, index) => (
              <div key={industry.name} className="flex items-center gap-3">
                <div className="text-2xl font-bold text-gray-400">#{index + 1}</div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-900">{industry.name}</span>
                    <span className="text-gray-600">{industry.orders} orders</span>
                  </div>
                  <div className="text-xs text-gray-500">{formatCurrency(industry.revenue)} omzet</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top Customers */}
        <motion.div
          className="admin-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Klanten</h3>
          <div className="space-y-3">
            {analytics.topCustomers.slice(0, 5).map((customer, index) => (
              <div key={customer.email} className="flex items-center gap-3">
                <div className="text-2xl font-bold text-gray-400">#{index + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-900 truncate">{customer.email}</span>
                    <span className="text-gray-600 flex-shrink-0 ml-2">{customer.orders} orders</span>
                  </div>
                  <div className="text-xs text-gray-500">{formatCurrency(customer.revenue)} omzet</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Chat Activity */}
      <motion.div
        className="admin-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Chat Activiteit</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <ChatBubbleLeftRightIcon className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-600">{analytics.chatActivity.totalMessages}</div>
            <div className="text-sm text-gray-600 mt-1">Totaal Berichten</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <UsersIcon className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-600">{analytics.chatActivity.uniqueUsers}</div>
            <div className="text-sm text-gray-600 mt-1">Unieke Gebruikers</div>
          </div>
          <div className="text-center p-4 bg-pink-50 rounded-lg">
            <ChartBarIcon className="w-8 h-8 text-pink-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-pink-600">{analytics.chatActivity.averagePerUser}</div>
            <div className="text-sm text-gray-600 mt-1">Gemiddeld per Gebruiker</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
