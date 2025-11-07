'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  UserGroupIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  ArrowTopRightOnSquareIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface LeadSummary {
  customerId: string;
  customerEmail: string;
  customerName: string;
  customerCompany: string | null;
  googleSheetUrl: string;
  hasSpreadsheet: boolean;
  totalLeadsOrdered: number;
  exclusiveLeads: number;
  sharedLeads: number;
  industries: string[];
  status: string;
  orderCount: number;
  lastOrderDate: string | null;
  createdAt: string;
}

interface Stats {
  totalCustomersWithSheets: number;
  totalLeadsOrdered: number;
  totalExclusive: number;
  totalShared: number;
  customersWithOrders: number;
  averageLeadsPerCustomer: string;
}

export default function LeadsPage() {
  const router = useRouter();
  const [leadSummaries, setLeadSummaries] = useState<LeadSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLeadsSummary();
  }, []);

  const loadLeadsSummary = async () => {
    try {
      setIsLoading(true);
      console.log('📊 Loading leads summary...');
      
      const response = await fetch('/api/admin/leads-summary');
      
      if (!response.ok) {
        throw new Error('Failed to load leads summary');
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Leads summary loaded:', data.stats);
        setLeadSummaries(data.leadSummaries);
        setStats(data.stats);
      } else {
        console.error('❌ Failed to load leads summary:', data.error);
      }
    } catch (error) {
      console.error('❌ Error loading leads summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get all unique industries
  const allIndustries = [...new Set(
    leadSummaries.flatMap(s => s.industries)
  )].filter(Boolean);

  const filteredSummaries = leadSummaries.filter(summary => {
    const matchesSearch = 
      summary.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (summary.customerCompany && summary.customerCompany.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesIndustry = selectedIndustry === 'all' || 
      summary.industries.includes(selectedIndustry);
    
    return matchesSearch && matchesIndustry;
  });

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Leads laden...</p>
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Overzicht van leads per klant (opgeslagen in Google Sheets)
          </p>
        </div>
        
        <button
          onClick={loadLeadsSummary}
          className="bg-brand-purple hover:bg-brand-purple/90 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
        >
          🔄 Ververs
        </button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <motion.div
          className="admin-card text-center p-3 sm:p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.totalCustomersWithSheets}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Klanten met CRM</div>
        </motion.div>
        
        <motion.div
          className="admin-card text-center p-3 sm:p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-2xl sm:text-3xl font-bold text-purple-600">{stats.totalLeadsOrdered}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Totaal Besteld</div>
        </motion.div>
        
        <motion.div
          className="admin-card text-center p-3 sm:p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="text-2xl sm:text-3xl font-bold text-green-600">{stats.totalExclusive}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Exclusief</div>
        </motion.div>
        
        <motion.div
          className="admin-card text-center p-3 sm:p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="text-2xl sm:text-3xl font-bold text-orange-600">{stats.totalShared}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Gedeeld</div>
        </motion.div>
        
        <motion.div
          className="admin-card text-center p-3 sm:p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="text-2xl sm:text-3xl font-bold text-brand-pink">{stats.averageLeadsPerCustomer}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Gemiddeld/Klant</div>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div
        className="admin-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Zoek klanten..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
            />
          </div>
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-pink focus:border-brand-pink"
          >
            <option value="all">Alle Branches</option>
            {allIndustries.map(industry => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Customer Summaries */}
      {filteredSummaries.length === 0 ? (
        <motion.div
          className="admin-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="text-center py-12">
            <UserGroupIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-medium text-gray-900 mb-2">Geen klanten gevonden</h3>
            <p className="text-sm sm:text-base text-gray-500">
              {searchTerm || selectedIndustry !== 'all' 
                ? 'Probeer andere zoekfilters' 
                : 'Klanten met Google Sheets CRM verschijnen hier'}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="admin-card overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Klant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branches
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Totaal Leads
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Exclusief
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gedeeld
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bestellingen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSummaries.map((summary, index) => (
                  <motion.tr
                    key={summary.customerId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{summary.customerName}</div>
                      <div className="text-xs text-gray-500">{summary.customerEmail}</div>
                      {summary.customerCompany && (
                        <div className="text-xs text-gray-500">{summary.customerCompany}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {summary.industries.slice(0, 2).map(industry => (
                          <span key={industry} className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            {industry}
                          </span>
                        ))}
                        {summary.industries.length > 2 && (
                          <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                            +{summary.industries.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-lg font-bold text-gray-900">{summary.totalLeadsOrdered}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-medium text-green-600">{summary.exclusiveLeads}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-medium text-orange-600">{summary.sharedLeads}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm text-gray-900">{summary.orderCount}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/portal/leads?customer=${summary.customerEmail}`)}
                          className="text-brand-purple hover:text-brand-pink transition-colors"
                          title="Open CRM"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                        {summary.googleSheetUrl && (
                          <a
                            href={summary.googleSheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Open spreadsheet"
                          >
                            <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-gray-200">
            {filteredSummaries.map((summary, index) => (
              <motion.div
                key={summary.customerId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">{summary.customerName}</div>
                    <div className="text-xs text-gray-500 truncate">{summary.customerEmail}</div>
                  </div>
                  <div className="flex gap-2 ml-2">
                    <button
                      onClick={() => router.push(`/portal/leads?customer=${summary.customerEmail}`)}
                      className="text-brand-purple hover:text-brand-pink transition-colors"
                    >
                      <EyeIcon className="w-5 h-5" />
                    </button>
                    {summary.googleSheetUrl && (
                      <a
                        href={summary.googleSheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                  <div>
                    <div className="text-lg font-bold text-gray-900">{summary.totalLeadsOrdered}</div>
                    <div className="text-gray-500">Totaal</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">{summary.exclusiveLeads}</div>
                    <div className="text-gray-500">Exclusief</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-orange-600">{summary.sharedLeads}</div>
                    <div className="text-gray-500">Gedeeld</div>
                  </div>
                </div>
                
                {summary.industries.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {summary.industries.map(industry => (
                      <span key={industry} className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {industry}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
