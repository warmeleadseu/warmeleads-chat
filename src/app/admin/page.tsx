'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  UserGroupIcon,
  DocumentTextIcon,
  CurrencyEuroIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalCustomers: number;
  newCustomersThisMonth: number;
  totalOrders: number;
  activeOrders: number;
  ordersThisMonth: number;
  totalRevenue: number;
  revenueThisMonth: number;
  conversionRate: number;
  trends: {
    revenue: string;
    orders: string;
    customers: string;
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      console.log('📊 Dashboard: Loading stats...');
      
      const response = await fetch('/api/admin/stats');
      
      if (!response.ok) {
        throw new Error('Failed to load stats');
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Dashboard stats loaded:', data.stats);
        setStats(data.stats);
      } else {
        console.error('❌ Failed to load stats:', data.error);
      }
    } catch (error) {
      console.error('❌ Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
  };

  const getTrendIcon = (trend: string) => {
    if (trend.startsWith('+')) {
      return <ArrowTrendingUpIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />;
    } else if (trend.startsWith('-')) {
      return <ArrowTrendingDownIcon className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />;
    }
    return null;
  };

  const getTrendColor = (trend: string) => {
    if (trend.startsWith('+')) return 'text-green-600';
    if (trend.startsWith('-')) return 'text-red-600';
    return 'text-gray-600';
  };

  const displayStats = stats ? [
    { 
      name: 'Totaal Klanten', 
      value: stats.totalCustomers.toString(), 
      icon: UserGroupIcon, 
      color: 'from-blue-500 to-blue-600',
      trend: stats.trends.customers,
      subtitle: `${stats.newCustomersThisMonth} deze maand`
    },
    { 
      name: 'Actieve Bestellingen', 
      value: stats.activeOrders.toString(), 
      icon: DocumentTextIcon, 
      color: 'from-purple-500 to-purple-600',
      trend: stats.trends.orders,
      subtitle: `${stats.ordersThisMonth} deze maand`
    },
    { 
      name: 'Omzet Deze Maand', 
      value: formatCurrency(stats.revenueThisMonth), 
      icon: CurrencyEuroIcon, 
      color: 'from-green-500 to-green-600',
      trend: stats.trends.revenue,
      subtitle: `${formatCurrency(stats.totalRevenue)} totaal`
    },
    { 
      name: 'Conversie Rate', 
      value: `${stats.conversionRate}%`, 
      icon: ChartBarIcon, 
      color: 'from-pink-500 to-pink-600',
      subtitle: 'Klanten → Bestellingen'
    },
  ] : [];

  const quickActions = [
    { name: 'Klanten Beheren', href: '/admin/customers', icon: UserGroupIcon },
    { name: 'Bestellingen', href: '/admin/orders', icon: DocumentTextIcon },
    { name: 'Prijsbeheer', href: '/admin/pricing', icon: CurrencyEuroIcon },
    { name: 'Analytics', href: '/admin/analytics', icon: ChartBarIcon },
  ];

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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Welkom terug! Hier is een overzicht van je bedrijf.</p>
        </div>
        
        <button
          onClick={loadStats}
          className="bg-brand-purple hover:bg-brand-purple/90 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
        >
          🔄 Ververs
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {displayStats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              {stat.trend && (
                <div className={`flex items-center gap-1 ${getTrendColor(stat.trend)}`}>
                  {getTrendIcon(stat.trend)}
                  <span className="text-xs sm:text-sm font-semibold">{stat.trend}</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">{stat.name}</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              {stat.subtitle && (
                <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Snelle Acties</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {quickActions.map((action) => (
            <motion.button
              key={action.name}
              onClick={() => router.push(action.href)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white border-2 border-gray-200 hover:border-brand-purple rounded-xl p-4 sm:p-6 text-left transition-all group"
            >
              <action.icon className="w-6 h-6 sm:w-8 sm:h-8 text-brand-purple mb-2 sm:mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{action.name}</h3>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recent Activity Preview */}
      {stats && stats.ordersThisMonth > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6"
        >
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Deze Maand</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.newCustomersThisMonth}</div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">Nieuwe Klanten</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600">{stats.ordersThisMonth}</div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">Bestellingen</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
              <div className="text-2xl sm:text-3xl font-bold text-green-600">{formatCurrency(stats.revenueThisMonth)}</div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">Omzet (incl. BTW)</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
