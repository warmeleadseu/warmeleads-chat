'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BellIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

interface Notification {
  id: string;
  type: 'order' | 'customer' | 'chat';
  title: string;
  message: string;
  amount?: number;
  status?: string;
  source?: string;
  preview?: string;
  timestamp: string;
  link: string;
  icon: string;
  priority: 'high' | 'normal' | 'low';
}

interface NotificationStats {
  total: number;
  last24h: number;
  unread: number;
  byType: {
    orders: number;
    customers: number;
    chats: number;
  };
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'order' | 'customer' | 'chat'>('all');

  useEffect(() => {
    loadNotifications();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      console.log('🔔 Loading notifications...');
      
      const response = await fetch('/api/admin/notifications?limit=100');
      
      if (!response.ok) {
        throw new Error('Failed to load notifications');
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Notifications loaded:', data.stats);
        setNotifications(data.notifications);
        setStats(data.stats);
      } else {
        console.error('❌ Failed to load notifications:', data.error);
      }
    } catch (error) {
      console.error('❌ Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Nu';
    if (minutes < 60) return `${minutes} min geleden`;
    if (hours < 24) return `${hours} uur geleden`;
    if (days < 7) return `${days} dag${days > 1 ? 'en' : ''} geleden`;
    
    return date.toLocaleDateString('nl-NL', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50';
      case 'normal': return 'border-l-blue-500 bg-white';
      case 'low': return 'border-l-gray-300 bg-gray-50';
      default: return 'border-l-gray-300 bg-white';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'order': return 'bg-green-100 text-green-800';
      case 'customer': return 'bg-blue-100 text-blue-800';
      case 'chat': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === filter);

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Notificaties laden...</p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Notificaties</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {stats && `${stats.unread} nieuwe • ${stats.total} totaal`}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={loadNotifications}
            className="bg-brand-purple hover:bg-brand-purple/90 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
          >
            🔄 Ververs
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <motion.div
            className="admin-card text-center p-3 sm:p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="text-2xl font-bold text-brand-purple">{stats.total}</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">Totaal</div>
          </motion.div>
          
          <motion.div
            className="admin-card text-center p-3 sm:p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-2xl font-bold text-green-600">{stats.byType.orders}</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">Bestellingen</div>
          </motion.div>
          
          <motion.div
            className="admin-card text-center p-3 sm:p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="text-2xl font-bold text-blue-600">{stats.byType.customers}</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">Klanten</div>
          </motion.div>
          
          <motion.div
            className="admin-card text-center p-3 sm:p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="text-2xl font-bold text-purple-600">{stats.byType.chats}</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">Chats</div>
          </motion.div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 'all', label: 'Alle', count: stats?.total || 0 },
          { id: 'order', label: 'Bestellingen', count: stats?.byType.orders || 0 },
          { id: 'customer', label: 'Klanten', count: stats?.byType.customers || 0 },
          { id: 'chat', label: 'Chats', count: stats?.byType.chats || 0 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              filter === tab.id
                ? 'bg-brand-purple text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <motion.div
          className="admin-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="text-center py-12">
            <BellIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-medium text-gray-900 mb-2">
              {filter === 'all' ? 'Nog geen notificaties' : `Geen ${filter} notificaties`}
            </h3>
            <p className="text-sm sm:text-base text-gray-500">
              Nieuwe activiteit verschijnt hier automatisch
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="space-y-2 sm:space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {filteredNotifications.map((notification, index) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => router.push(notification.link)}
              className={`${getPriorityColor(notification.priority)} border-l-4 rounded-lg p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl sm:text-3xl flex-shrink-0">{notification.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(notification.type)} mr-2`}>
                        {notification.type}
                      </span>
                      <span className="font-semibold text-gray-900 text-sm sm:text-base">{notification.title}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                      <ClockIcon className="w-3 h-3" />
                      {formatTimestamp(notification.timestamp)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{notification.message}</p>
                  {notification.amount && (
                    <div className="text-sm font-semibold text-green-600">
                      {formatCurrency(notification.amount)}
                    </div>
                  )}
                  {notification.preview && (
                    <div className="text-xs text-gray-500 italic mt-1">
                      "{notification.preview}"
                    </div>
                  )}
                </div>
                <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
