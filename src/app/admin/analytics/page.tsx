'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  UsersIcon,
  CurrencyEuroIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  DevicePhoneMobileIcon
} from '@heroicons/react/24/outline';

// Echte analytics data - momenteel leeg, wordt gevuld door Google Analytics
const analyticsData = {
  overview: {
    totalVisitors: 0,
    totalLeads: 0,
    totalRevenue: 0,
    conversionRate: 0,
    trends: {
      visitors: '+0%',
      leads: '+0%', 
      revenue: '+0%',
      conversion: '+0%'
    }
  },
  traffic: {
    organic: 0,
    direct: 0,
    social: 0,
    referral: 0
  },
  devices: {
    desktop: 0,
    mobile: 0,
    tablet: 0
  },
  topPages: [],
  industries: []
};

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d');

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
            Inzichten in website performance
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
        >
          <option value="1d">Vandaag</option>
          <option value="7d">Laatste 7 dagen</option>
          <option value="30d">Laatste 30 dagen</option>
          <option value="90d">Laatste 90 dagen</option>
        </select>
      </motion.div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <motion.div
          className="admin-card p-4 sm:p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">Totaal Bezoekers</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{analyticsData.overview.totalVisitors.toLocaleString()}</p>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-blue-500 flex-shrink-0">
              <UsersIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-center">
            <ArrowTrendingUpIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 mr-1" />
            <span className="text-green-600 text-xs sm:text-sm font-medium">{analyticsData.overview.trends.visitors}</span>
            <span className="text-gray-500 text-xs sm:text-sm ml-1">vs vorige periode</span>
          </div>
        </motion.div>

        <motion.div
          className="admin-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Gegenereerde Leads</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.totalLeads}</p>
            </div>
            <div className="p-3 rounded-lg bg-brand-orange">
              <ChartBarIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
            <span className="text-green-600 text-sm font-medium">{analyticsData.overview.trends.leads}</span>
            <span className="text-gray-500 text-sm ml-1">vs vorige periode</span>
          </div>
        </motion.div>

        <motion.div
          className="admin-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totale Omzet</p>
              <p className="text-2xl font-bold text-gray-900">€{analyticsData.overview.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500">
              <CurrencyEuroIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
            <span className="text-green-600 text-sm font-medium">{analyticsData.overview.trends.revenue}</span>
            <span className="text-gray-500 text-sm ml-1">vs vorige periode</span>
          </div>
        </motion.div>

        <motion.div
          className="admin-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Conversie Rate</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.conversionRate}%</p>
            </div>
            <div className="p-3 rounded-lg bg-brand-purple">
              <CursorArrowRaysIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
            <span className="text-green-600 text-sm font-medium">{analyticsData.overview.trends.conversion}</span>
            <span className="text-gray-500 text-sm ml-1">vs vorige periode</span>
          </div>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Sources */}
        <motion.div
          className="admin-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Traffic Bronnen</h2>
          <div className="space-y-4">
            {Object.entries(analyticsData.traffic).map(([source, value]) => (
              <div key={source} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 capitalize">{source}</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-brand-purple to-brand-pink h-2 rounded-full"
                      style={{ width: `${(value / Math.max(...Object.values(analyticsData.traffic))) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-900 w-16 text-right">{value.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top Pages */}
        <motion.div
          className="admin-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Top Pagina's</h2>
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">📊</div>
            <h4 className="font-medium text-gray-900 mb-2">Nog geen pagina data</h4>
            <p className="text-gray-500 text-sm">
              Top pagina's verschijnen hier wanneer er website verkeer is
            </p>
          </div>
        </motion.div>
      </div>

      {/* Industry Performance */}
      <motion.div
        className="admin-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Performance per Branche</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branche
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Leads
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Omzet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gem. Waarde
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <div className="text-gray-400 mb-4">📈</div>
                  <h4 className="font-medium text-gray-900 mb-2">Nog geen branche data</h4>
                  <p className="text-gray-500 text-sm">
                    Performance per branche verschijnt hier wanneer er bestellingen zijn
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
