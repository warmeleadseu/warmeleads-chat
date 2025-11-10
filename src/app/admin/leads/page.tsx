'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  UserIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface LeadDistribution {
  id: string;
  customerEmail: string;
  customerName: string;
  batchId: string;
  batchNumber: string;
  distributedAt: string;
  distributionType: 'fresh' | 'returning' | 'reuse';
  distanceKm: number | null;
  territoryMatchType: string | null;
  priorityScore: number;
  addedToSheet: boolean;
  sheetRowNumber: number | null;
  sheetSyncError: string | null;
  isReturningLead: boolean;
  isReuseDistribution: boolean;
}

interface Lead {
  id: string;
  email: string;
  phone: string;
  name: string;
  branch: string;
  postcode: string | null;
  address: string | null;
  source: string;
  totalDistributionCount: number;
  uniqueCustomersCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  formSubmissionCount: number;
  isAvailableForDistribution: boolean;
  distributionNotes: string | null;
  distributions: LeadDistribution[];
}

const BRANCHES = [
  { id: 'all', name: 'Alle branches' },
  { id: 'thuisbatterijen', name: 'Thuisbatterijen' },
  { id: 'zonnepanelen', name: 'Zonnepanelen' },
  { id: 'kozijnen', name: 'Kozijnen' },
  { id: 'airco', name: 'Airco' },
  { id: 'warmtepompen', name: 'Warmtepompen' },
  { id: 'isolatie', name: 'Isolatie' },
];

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/leads', {
        cache: 'no-store',
      });
      const data = await response.json();
      setLeads(data.leads || []);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      searchTerm === '' ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm);

    const matchesBranch = branchFilter === 'all' || lead.branch === branchFilter;

    return matchesSearch && matchesBranch;
  });

  const stats = {
    total: leads.length,
    distributed: leads.filter((l) => l.totalDistributionCount > 0).length,
    available: leads.filter((l) => l.isAvailableForDistribution).length,
    totalDistributions: leads.reduce((sum, l) => sum + l.totalDistributionCount, 0),
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-brand-navy">Lead Database</h1>
            <p className="text-gray-600 mt-1">
              Alle gegenereerde leads met volledige distributie geschiedenis
            </p>
          </div>
          <button
            onClick={loadLeads}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
          >
            <ArrowPathIcon className="w-5 h-5" />
            Vernieuwen
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Totaal leads</div>
            <div className="text-2xl font-bold text-brand-navy">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Al verdeeld</div>
            <div className="text-2xl font-bold text-green-600">{stats.distributed}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Beschikbaar</div>
            <div className="text-2xl font-bold text-blue-600">{stats.available}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Totaal distributies</div>
            <div className="text-2xl font-bold text-purple-600">{stats.totalDistributions}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Zoek op naam, email of telefoon..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                {BRANCHES.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Leads List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Leads List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-brand-navy">
                {filteredLeads.length} leads gevonden
              </h2>
            </div>
            <div className="divide-y divide-gray-200 max-h-[calc(100vh-24rem)] overflow-y-auto">
              {filteredLeads.length === 0 ? (
                <div className="text-center py-12">
                  <UserIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Geen leads gevonden</p>
                </div>
              ) : (
                filteredLeads.map((lead) => (
                  <motion.button
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedLead?.id === lead.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-brand-navy">{lead.name}</h3>
                        <p className="text-sm text-gray-600">{lead.email}</p>
                        <p className="text-sm text-gray-500">{lead.phone}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-medium text-blue-600">
                          {BRANCHES.find((b) => b.id === lead.branch)?.name || lead.branch}
                        </span>
                        {lead.postcode && (
                          <span className="text-xs text-gray-500">{lead.postcode}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {lead.totalDistributionCount}x verdeeld
                      </span>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                        {lead.uniqueCustomersCount} klanten
                      </span>
                      {lead.formSubmissionCount > 1 && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                          {lead.formSubmissionCount}x ingediend
                        </span>
                      )}
                      {lead.isAvailableForDistribution && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          ● Beschikbaar
                        </span>
                      )}
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Lead Details */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {selectedLead ? (
              <>
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                  <h2 className="text-xl font-bold text-brand-navy mb-4">Lead Details</h2>
                  
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">Naam:</span>
                      <p className="font-semibold text-brand-navy">{selectedLead.name}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Email:</span>
                      <p className="font-medium text-gray-800">{selectedLead.email}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Telefoon:</span>
                      <p className="font-medium text-gray-800">{selectedLead.phone}</p>
                    </div>
                    {selectedLead.address && (
                      <div>
                        <span className="text-sm text-gray-600">Adres:</span>
                        <p className="font-medium text-gray-800">{selectedLead.address}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                      <div>
                        <span className="text-xs text-gray-500">Eerste keer gezien</span>
                        <p className="text-sm font-medium">
                          {new Date(selectedLead.firstSeenAt).toLocaleDateString('nl-NL')}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Laatste keer gezien</span>
                        <p className="text-sm font-medium">
                          {new Date(selectedLead.lastSeenAt).toLocaleDateString('nl-NL')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-semibold text-brand-navy mb-4">
                    Distributie Geschiedenis ({selectedLead.distributions.length})
                  </h3>

                  {selectedLead.distributions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <ClockIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>Deze lead is nog niet verdeeld</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[calc(100vh-32rem)] overflow-y-auto">
                      {selectedLead.distributions.map((dist, index) => (
                        <motion.div
                          key={dist.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-brand-navy">
                                {dist.customerName}
                              </h4>
                              <p className="text-sm text-gray-600">{dist.customerEmail}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500">
                                {new Date(dist.distributedAt).toLocaleString('nl-NL')}
                              </div>
                              {dist.addedToSheet ? (
                                <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                                  <CheckCircleIcon className="w-4 h-4" />
                                  Sheet #{dist.sheetRowNumber}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                                  <XCircleIcon className="w-4 h-4" />
                                  Sync fout
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">Type:</span>
                              <span
                                className={`ml-2 px-2 py-0.5 rounded ${
                                  dist.distributionType === 'fresh'
                                    ? 'bg-green-100 text-green-700'
                                    : dist.distributionType === 'returning'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}
                              >
                                {dist.distributionType === 'fresh'
                                  ? 'Nieuw'
                                  : dist.distributionType === 'returning'
                                  ? 'Terugkerend'
                                  : 'Hergebruik'}
                              </span>
                            </div>
                            {dist.distanceKm && (
                              <div>
                                <span className="text-gray-500">Afstand:</span>
                                <span className="ml-2 font-medium">{dist.distanceKm}km</span>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Prioriteit:</span>
                              <span className="ml-2 font-medium">{dist.priorityScore}</span>
                            </div>
                            {dist.territoryMatchType && (
                              <div>
                                <span className="text-gray-500">Match:</span>
                                <span className="ml-2 font-medium">{dist.territoryMatchType}</span>
                              </div>
                            )}
                          </div>

                          {dist.sheetSyncError && (
                            <div className="mt-2 text-xs bg-red-50 text-red-700 p-2 rounded">
                              {dist.sheetSyncError}
                            </div>
                          )}

                          <div className="mt-2 text-xs text-gray-500">
                            Batch: {dist.batchNumber}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 p-12 text-center">
                <div>
                  <UserIcon className="w-24 h-24 mx-auto mb-4 opacity-20" />
                  <p>Selecteer een lead om details te bekijken</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
