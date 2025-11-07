'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ChartBarIcon, 
  ChatBubbleLeftRightIcon, 
  CheckCircleIcon, 
  EyeIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface WhatsAppAnalyticsProps {
  customerId: string;
}

interface AnalyticsData {
  overview: {
    totalMessagesSent: number;
    messagesDelivered: number;
    messagesRead: number;
    responsesReceived: number;
    deliveryRate: number;
    readRate: number;
    responseRate: number;
    usagePercentage: number;
    messagesRemaining: number;
  };
  dailyStats: Array<{
    date: string;
    messagesSent: number;
    messagesDelivered: number;
    messagesRead: number;
    responses: number;
  }>;
  recentMessages: Array<{
    id: string;
    phoneNumber: string;
    message: string;
    timestamp: string;
    status: string;
    direction: string;
  }>;
  config: {
    enabled: boolean;
    businessName: string;
    messagesLimit: number;
    planType: string;
  };
}

export function WhatsAppAnalytics({ customerId }: WhatsAppAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [customerId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/whatsapp/analytics?customerId=${customerId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      
      const data = await response.json();
      setAnalytics(data.analytics);
    } catch (err) {
      console.error('Failed to load WhatsApp analytics', err);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'text-blue-600 bg-blue-100';
      case 'delivered': return 'text-green-600 bg-green-100';
      case 'read': return 'text-emerald-600 bg-emerald-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <ClockIcon className="w-4 h-4" />;
      case 'delivered': return <CheckCircleIcon className="w-4 h-4" />;
      case 'read': return <EyeIcon className="w-4 h-4" />;
      case 'failed': return <ExclamationTriangleIcon className="w-4 h-4" />;
      default: return <ClockIcon className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <ChartBarIcon className="w-8 h-8 mx-auto mb-2" />
          <p>Geen analytics data beschikbaar</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/20 p-4 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">WhatsApp Analytics</h3>
            <p className="text-sm text-white/70">{analytics.config.businessName}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            analytics.config.enabled 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-white/10 text-white/70 border border-white/20'
          }`}>
            {analytics.config.enabled ? 'Actief' : 'Inactief'}
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
              <ChatBubbleLeftRightIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            </div>
            <div className="text-right">
              <div className="text-lg sm:text-2xl font-bold text-white">{analytics.overview.totalMessagesSent}</div>
              <div className="text-xs text-white/60">Verzonden</div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
              <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
            </div>
            <div className="text-right">
              <div className="text-lg sm:text-2xl font-bold text-white">{analytics.overview.messagesDelivered}</div>
              <div className="text-xs text-white/60">Bezorgd</div>
              <div className="text-xs text-green-400">{analytics.overview.deliveryRate}%</div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
              <EyeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
            <div className="text-right">
              <div className="text-lg sm:text-2xl font-bold text-white">{analytics.overview.messagesRead}</div>
              <div className="text-xs text-white/60">Gelezen</div>
              <div className="text-xs text-emerald-400">{analytics.overview.readRate}%</div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500/20 rounded-lg sm:rounded-xl flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            </div>
            <div className="text-right">
              <div className="text-lg sm:text-2xl font-bold text-white">{analytics.overview.responsesReceived}</div>
              <div className="text-xs text-white/60">Reacties</div>
              <div className="text-xs text-purple-400">{analytics.overview.responseRate}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white/80">Gebruik</span>
          <span className="text-sm text-white/60">
            {analytics.overview.messagesRemaining} van {analytics.config.messagesLimit} berichten over
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              analytics.overview.usagePercentage > 90 
                ? 'bg-red-500' 
                : analytics.overview.usagePercentage > 70 
                ? 'bg-yellow-500' 
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(analytics.overview.usagePercentage, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Recent Messages */}
      <div>
        <h4 className="text-md font-semibold text-white mb-4">Recente Berichten</h4>
        <div className="space-y-3">
          {analytics.recentMessages.length > 0 ? (
            analytics.recentMessages.map((message) => (
              <div key={message.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-white">
                      {message.phoneNumber}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(message.status)}`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(message.status)}
                        <span>{message.status}</span>
                      </div>
                    </span>
                  </div>
                  <p className="text-sm text-white/70 truncate">{message.message}</p>
                  <p className="text-xs text-white/50">{formatTime(message.timestamp)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-white/50">
              <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nog geen berichten verzonden</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
