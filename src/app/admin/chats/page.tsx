'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  UserIcon,
  ClockIcon,
  EyeIcon,
  ExclamationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { getAllCustomers, type Customer } from '@/lib/crmSystem';
import { realtimeEvents, type RealtimeEvent } from '@/lib/realtimeEvents';

interface LiveChatSession {
  id: string;
  customerEmail: string;
  customerName?: string;
  industry?: string;
  startTime: Date;
  lastActivity: Date;
  messageCount: number;
  status: 'active' | 'idle' | 'completed';
  currentStep?: string;
}

export default function LiveChatsPage() {
  const [liveSessions, setLiveSessions] = useState<LiveChatSession[]>([]);
  const [recentActivity, setRecentActivity] = useState<RealtimeEvent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    // Load initial data
    const loadData = async () => {
      const allCustomers = await getAllCustomers();
      setCustomers(allCustomers);

      // Load persisted events first
      const persistedEvents = realtimeEvents.loadPersistedEvents();
      const recentEvents = realtimeEvents.getRecentEvents(undefined, 100); // All event types
      const allEvents = [...persistedEvents, ...recentEvents];
      
      // Remove duplicates and sort
      const uniqueEvents = allEvents.filter((event, index, array) => 
        array.findIndex(e => e.timestamp.getTime() === event.timestamp.getTime() && e.data.customerEmail === event.data.customerEmail) === index
      ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setRecentActivity(uniqueEvents.filter(e => e.type === 'chat_message').slice(0, 50));

      // Create live sessions from all activity
      const sessions = createLiveSessionsFromActivity(uniqueEvents, allCustomers);
      setLiveSessions(sessions);
    };

    loadData();

    // Refresh data every 5 seconds for better real-time experience
    const refreshInterval = setInterval(loadData, 5000);

    // Subscribe to realtime events
    const unsubscribeChatStarted = realtimeEvents.subscribe('chat_started', (event) => {
      console.log('🔴 REALTIME: Chat started', event.data);
      
      setLiveSessions(prev => {
        const existing = prev.find(s => s.customerEmail === event.data.customerEmail);
        if (existing) {
          return prev.map(s => 
            s.customerEmail === event.data.customerEmail 
              ? { ...s, lastActivity: event.timestamp, status: 'active' as const }
              : s
          );
        } else {
          const newSession: LiveChatSession = {
            id: event.data.sessionId || Math.random().toString(36).substring(7),
            customerEmail: event.data.customerEmail,
            industry: event.data.industry,
            startTime: event.timestamp,
            lastActivity: event.timestamp,
            messageCount: 0,
            status: 'active'
          };
          return [newSession, ...prev];
        }
      });
    });

    const unsubscribeChatMessage = realtimeEvents.subscribe('chat_message', (event) => {
      console.log('🔴 REALTIME: Chat message', event.data);
      
      setRecentActivity(prev => [event, ...prev.slice(0, 49)]);
      
      setLiveSessions(prev => 
        prev.map(session => 
          session.customerEmail === event.data.customerEmail
            ? {
                ...session,
                lastActivity: event.timestamp,
                messageCount: session.messageCount + 1,
                status: 'active' as const,
                currentStep: event.data.step
              }
            : session
        )
      );
    });

    const unsubscribeCustomerCreated = realtimeEvents.subscribe('customer_created', (event) => {
      console.log('🔴 REALTIME: Customer created', event.data);
      loadData(); // Refresh all data
    });

    // Cleanup subscriptions
    return () => {
      clearInterval(refreshInterval);
      unsubscribeChatStarted();
      unsubscribeChatMessage();
      unsubscribeCustomerCreated();
    };
  }, []);

  // Mark idle sessions (no activity for 5+ minutes)
  useEffect(() => {
    const markIdleSessions = () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      setLiveSessions(prev => 
        prev.map(session => ({
          ...session,
          status: new Date(session.lastActivity) < fiveMinutesAgo ? 'idle' : session.status
        }))
      );
    };

    const interval = setInterval(markIdleSessions, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const createLiveSessionsFromActivity = (events: RealtimeEvent[], customers: Customer[]): LiveChatSession[] => {
    const sessionMap = new Map<string, LiveChatSession>();

    events.forEach(event => {
      if (event.type === 'chat_message' || event.type === 'chat_started') {
        const email = event.data.customerEmail;
        const customer = customers.find(c => c.email === email);
        const isAnonymous = email.includes('@temp.warmeleads.eu');
        
        if (!sessionMap.has(email)) {
          sessionMap.set(email, {
            id: event.data.sessionId || Math.random().toString(36).substring(7),
            customerEmail: email,
            customerName: customer?.name || (isAnonymous ? 'Anonieme bezoeker' : undefined),
            industry: event.data.industry || customer?.chatHistory[0]?.step || 'Onbekend',
            startTime: event.timestamp,
            lastActivity: event.timestamp,
            messageCount: 0,
            status: 'active'
          });
        }

        const session = sessionMap.get(email)!;
        session.lastActivity = new Date(Math.max(session.lastActivity.getTime(), event.timestamp.getTime()));
        if (event.type === 'chat_message') {
          session.messageCount++;
        }
        if (event.data.step) {
          session.currentStep = event.data.step;
        }

        // Mark as active if recent activity (last 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        if (session.lastActivity > tenMinutesAgo) {
          session.status = 'active';
        }
      }
    });

    return Array.from(sessionMap.values()).sort((a, b) => 
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'idle': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '🟢';
      case 'idle': return '🟡';
      case 'completed': return '🔵';
      default: return '⚪';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Live Chats</h1>
          <p className="text-gray-600 mt-1">
            {liveSessions.filter(s => s.status === 'active').length} actieve gesprekken • 
            {liveSessions.filter(s => s.status === 'idle').length} idle • 
            Realtime monitoring
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Live</span>
        </div>
      </motion.div>

      {/* Live Sessions */}
      {liveSessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center py-12"
        >
          <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Geen actieve chats</h3>
          <p className="text-gray-600">
            Live chat sessies verschijnen hier zodra bezoekers een gesprek starten.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Sessions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900">Actieve Gesprekken</h2>
            <div className="space-y-3">
              {liveSessions
                .filter(session => session.status === 'active')
                .map((session) => (
                  <motion.div
                    key={session.id}
                    layout
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-brand-purple to-brand-pink rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {session.customerName?.charAt(0) || session.customerEmail.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {session.customerName || session.customerEmail}
                          </div>
                          <div className="text-sm text-gray-500">
                            {session.industry && `${session.industry} • `}
                            {session.messageCount} berichten
                          </div>
                          {session.currentStep && (
                            <div className="text-xs text-blue-600">
                              Stap: {session.currentStep}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(session.status)}`}>
                          {getStatusIcon(session.status)} {session.status}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(session.lastActivity).toLocaleTimeString('nl-NL')}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
            </div>
          </motion.div>

          {/* Recent Activity Feed */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900">Recente Activiteit</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-h-96 overflow-y-auto">
              {recentActivity.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Nog geen activiteit
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentActivity.slice(0, 20).map((event, index) => (
                    <div key={index} className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          {event.data.type === 'lisa' ? '🤖' : '👤'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900">
                            <strong>{event.data.customerEmail}</strong>
                          </div>
                          <div className="text-sm text-gray-600 truncate">
                            {event.data.message}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(event.timestamp).toLocaleTimeString('nl-NL')}
                            {event.data.step && ` • ${event.data.step}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Idle Sessions */}
      {liveSessions.filter(s => s.status === 'idle').length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Idle Gesprekken</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveSessions
              .filter(session => session.status === 'idle')
              .map((session) => (
                <div key={session.id} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {session.customerName || session.customerEmail}
                      </div>
                      <div className="text-sm text-gray-600">
                        Idle sinds {new Date(session.lastActivity).toLocaleTimeString('nl-NL')}
                      </div>
                    </div>
                    <span className="text-yellow-600 text-xl">🟡</span>
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}