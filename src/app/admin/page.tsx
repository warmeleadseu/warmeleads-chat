'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  UserGroupIcon,
  DocumentTextIcon,
  CurrencyEuroIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

export default function AdminPage() {
  const router = useRouter();

  const stats = [
    { name: 'Totaal Klanten', value: '0', icon: UserGroupIcon, color: 'from-blue-500 to-blue-600' },
    { name: 'Actieve Bestellingen', value: '0', icon: DocumentTextIcon, color: 'from-purple-500 to-purple-600' },
    { name: 'Omzet Deze Maand', value: '€0', icon: CurrencyEuroIcon, color: 'from-green-500 to-green-600' },
    { name: 'Conversie Rate', value: '0%', icon: ChartBarIcon, color: 'from-orange-500 to-orange-600' },
  ];

  const quickActions = [
    { name: 'Klanten Beheren', href: '/admin/customers', icon: UserGroupIcon },
    { name: 'Bestellingen', href: '/admin/orders', icon: DocumentTextIcon },
    { name: 'Prijsbeheer', href: '/admin/pricing', icon: CurrencyEuroIcon },
    { name: 'Analytics', href: '/admin/analytics', icon: ChartBarIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welkom terug! Hier is een overzicht van je bedrijf.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Snelle Acties</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <motion.button
              key={action.name}
              onClick={() => router.push(action.href)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white border-2 border-gray-200 hover:border-brand-purple rounded-xl p-6 text-left transition-all group"
            >
              <action.icon className="w-8 h-8 text-gray-400 group-hover:text-brand-purple transition-colors mb-3" />
              <h3 className="font-semibold text-gray-900 group-hover:text-brand-purple transition-colors">
                {action.name}
              </h3>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
