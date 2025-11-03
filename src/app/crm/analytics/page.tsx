'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ChartBarIcon,
  CurrencyEuroIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  EyeIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/auth';
import { crmSystem, type Customer, type Lead } from '@/lib/crmSystem';
import { branchIntelligence, type BranchAnalytics } from '@/lib/branchIntelligence';

export default function CRMAnalyticsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [customerData, setCustomerData] = useState<Customer | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [branchAnalytics, setBranchAnalytics] = useState<BranchAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load CRM data
  const loadCRMData = async () => {
    try {
      setIsLoading(true);
      
      let customer: Customer | null = null;
      try {
        const response = await fetch('/api/customer-data');
        if (response.ok) {
          customer = await response.json();
        }
      } catch (error) {
        console.log('API fetch failed, using localStorage');
      }

      if (!customer && user?.email) {
        const allCustomers = await crmSystem.getAllCustomers();
        customer = allCustomers.find(cust => cust.email === user.email) || null;
      }

      if (customer) {
        setCustomerData(customer);
        
        if (customer.leadData && customer.leadData.length > 0) {
          setLeads(customer.leadData);
          const analytics = branchIntelligence.analyzeBranchPerformance(customer.leadData);
          setBranchAnalytics(analytics);
        }
      }
      
    } catch (error) {
      console.error('Error loading CRM data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (authLoading) return;
    
    if (isAuthenticated && user) {
      loadCRMData();
    } else {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, user, router]);

  // Calculate overall stats
  const getOverallStats = () => {
    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter(lead => lead.status === 'qualified').length;
    const conversionRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;
    
    let totalRevenue = 0;
    branchAnalytics.forEach(analytics => {
      totalRevenue += analytics.revenue;
    });
    
    const avgLeadValue = totalLeads > 0 ? totalRevenue / totalLeads : 0;

    return {
      revenue: totalRevenue,
      totalLeads,
      conversions: qualifiedLeads,
      conversionRate,
      avgLeadValue
    };
  };

  const overallStats = getOverallStats();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl">Analytics laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            {/* Left side */}
            <div className="flex items-center space-x-6">
              <button
                onClick={() => router.push('/crm')}
                className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span>Terug naar CRM</span>
              </button>
              
              <div className="h-8 w-px bg-white/30"></div>
              
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
                  <ChartBarIcon className="w-8 h-8 text-purple-400" />
                  <span>Geavanceerde Analytics</span>
                </h1>
                <p className="text-white/80 text-sm mt-1">
                  {user?.name} • {overallStats.totalLeads} leads totaal
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Overview Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <CurrencyEuroIcon className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">€{Math.round(overallStats.revenue / 1000)}K</div>
                <div className="text-xs text-white/60">Totale Omzet</div>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <UserGroupIcon className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{overallStats.totalLeads}</div>
                <div className="text-xs text-white/60">Totaal Leads</div>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-green-400" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{overallStats.conversionRate.toFixed(1)}%</div>
                <div className="text-xs text-white/60">Conversie Rate</div>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <ArrowUpIcon className="w-6 h-6 text-orange-400" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">€{Math.round(overallStats.avgLeadValue)}</div>
                <div className="text-xs text-white/60">Gem. Lead Waarde</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Branch Analytics */}
        {branchAnalytics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                <EyeIcon className="w-6 h-6 text-blue-400" />
                <span>Branch Prestatie Analyse</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {branchAnalytics.map((analytics, index) => (
                <motion.div
                  key={analytics.branch}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white text-lg flex items-center space-x-2">
                      {analytics.branch === 'Thuisbatterijen' && <span>🔋</span>}
                      {analytics.branch === 'Financial Lease' && <span>🚗</span>}
                      {analytics.branch === 'Warmtepompen' && <span>🔥</span>}
                      {analytics.branch === 'Zonnepanelen' && <span>☀️</span>}
                      <span>{analytics.branch}</span>
                    </h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Leads:</span>
                      <span className="font-bold text-white">{analytics.totalLeads}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Conversie:</span>
                      <span className="font-bold text-purple-400">{analytics.conversionRate.toFixed(1)}%</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Omzet:</span>
                      <span className="font-bold text-green-400">€{Math.round(analytics.revenue / 1000)}K</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Gem. Waarde:</span>
                      <span className="font-bold text-blue-400">€{Math.round(analytics.avgLeadValue)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* AI Recommendations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl p-8 border border-purple-500/30"
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
            <SparklesIcon className="w-7 h-7 text-yellow-400" />
            <span>AI-Aanbevelingen</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">🎯 Optimale Focus Branches</h3>
              <div className="space-y-3">
                {branchAnalytics
                  .sort((a, b) => b.conversionRate - a.conversionRate)
                  .slice(0, 2)
                  .map((analytics) => (
                    <div key={analytics.branch} className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                      <span className="text-white font-medium">{analytics.branch}</span>
                      <span className="text-green-400 font-bold">{analytics.conversionRate.toFixed(1)}% conversie</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
