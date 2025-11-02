'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BellIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { getFirstAdminEmail } from '@/config/admin';

export function AdminHeader() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [liveStats, setLiveStats] = useState<any>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Load live stats
  useEffect(() => {
    loadLiveStats();
    const interval = setInterval(loadLiveStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadLiveStats = async () => {
    try {
      const response = await fetch('/api/admin/stats');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLiveStats(data.stats);
        }
      }
    } catch (error) {
      console.error('Error loading live stats:', error);
    }

    // Also load notification count
    try {
      const notifResponse = await fetch('/api/admin/notifications?limit=10');
      if (notifResponse.ok) {
        const data = await notifResponse.json();
        if (data.success) {
          setUnreadNotifications(data.stats.unread || 0);
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  // Search functionality
  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchTerm.length >= 2) {
        performSearch(searchTerm);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const performSearch = async (query: string) => {
    try {
      // Search customers
      const customersResponse = await fetch('/api/admin/customers');
      const ordersResponse = await fetch('/api/admin/orders');
      
      const customersData = await customersResponse.json();
      const ordersData = await ordersResponse.json();
      
      const results: any[] = [];
      
      // Search in customers
      if (customersData.success) {
        const matchingCustomers = customersData.customers
          .filter((c: any) => 
            c.email?.toLowerCase().includes(query.toLowerCase()) ||
            c.name?.toLowerCase().includes(query.toLowerCase()) ||
            c.company?.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 3)
          .map((c: any) => ({
            type: 'customer',
            title: c.name || c.email,
            subtitle: c.email,
            link: '/admin/customers'
          }));
        
        results.push(...matchingCustomers);
      }
      
      // Search in orders
      if (ordersData.success) {
        const matchingOrders = ordersData.orders
          .filter((o: any) => 
            o.orderNumber?.toLowerCase().includes(query.toLowerCase()) ||
            o.customerEmail?.toLowerCase().includes(query.toLowerCase()) ||
            o.customerName?.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 3)
          .map((o: any) => ({
            type: 'order',
            title: o.orderNumber,
            subtitle: o.customerName,
            link: '/admin/orders'
          }));
        
        results.push(...matchingOrders);
      }
      
      setSearchResults(results);
      setShowResults(results.length > 0);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(0)}`;
  };

  return (
    <motion.header
      className="bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-6 py-3 lg:py-4 relative z-30"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Search - Hidden on very small screens, shown on sm and up */}
        <div className="hidden sm:flex flex-1 max-w-xs lg:max-w-lg relative">
          <div className="relative w-full">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-gray-400 z-10" />
            <input
              type="text"
              placeholder="Zoek klanten, orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              className="w-full pl-8 lg:pl-10 pr-3 lg:pr-4 py-1.5 lg:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-transparent"
            />
          </div>
          
          {/* Search Results Dropdown */}
          <AnimatePresence>
            {showResults && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50"
              >
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      router.push(result.link);
                      setSearchTerm('');
                      setShowResults(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {result.type === 'customer' ? '👤' : '📦'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{result.title}</div>
                        <div className="text-xs text-gray-500 truncate">{result.subtitle}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 ml-auto">
          {/* Live Stats - Hidden on mobile */}
          {liveStats && (
            <div className="hidden lg:flex items-center space-x-4 xl:space-x-6 text-xs xl:text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-gray-600">{liveStats.activeOrders} Actief</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-brand-orange rounded-full" />
                <span className="text-gray-600">{formatCurrency(liveStats.revenueThisMonth)} Deze Maand</span>
              </div>
            </div>
          )}

          {/* Notifications */}
          <motion.button
            onClick={() => router.push('/admin/notifications')}
            className="relative p-1.5 lg:p-2 text-gray-400 hover:text-gray-600 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <BellIcon className="w-5 h-5 lg:w-6 lg:h-6" />
            {unreadNotifications > 0 && (
              <span className="absolute top-0.5 right-0.5 lg:top-1 lg:right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </motion.button>

          {/* User Menu */}
          <div className="relative group">
            <motion.button
              className="flex items-center gap-1 sm:gap-2 p-1 sm:p-2 text-gray-600 hover:text-gray-800 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <UserCircleIcon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 flex-shrink-0" />
              <div className="hidden lg:block text-left">
                <div className="text-sm font-medium">Admin</div>
                <div className="text-xs text-gray-500 truncate max-w-[120px]">{getFirstAdminEmail()}</div>
              </div>
            </motion.button>
            
            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-2 w-40 sm:w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="py-2">
                <button
                  onClick={() => router.push('/admin/settings')}
                  className="w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  ⚙️ Instellingen
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('warmeleads_admin_token');
                    localStorage.removeItem('warmeleads_admin_user');
                    window.location.href = '/admin/login';
                  }}
                  className="w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  🚪 Uitloggen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
