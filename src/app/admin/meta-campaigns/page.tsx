'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
  MapPinIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { Logo } from '@/components/Logo';
import { GeographicUtils } from '@/lib/geographicUtils';

interface MetaCampaign {
  id: string;
  customerEmail: string;
  metaCampaignId: string;
  metaFormId: string;
  campaignName?: string;
  branchId: string;
  totalBatchSize: number;
  currentBatchCount: number;
  isBatchActive: boolean;
  territoryType: 'radius' | 'full_country' | 'regions';
  centerPostcode?: string;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  allowedRegions?: string[];
  isActive: boolean;
  createdAt: string;
  lastLeadReceived?: string;
  batchCompletedAt?: string;
}

interface CampaignStats {
  totalLeads: number;
  qualifiedLeads: number;
  rejectedLeads: number;
  conversionRate: number;
  topRejectionReasons: { reason: string; count: number }[];
}

export default function MetaCampaignsAdmin() {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MetaCampaign | null>(null);
  const [selectedStats, setSelectedStats] = useState<CampaignStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await fetch('/api/admin/meta-campaigns', {
        cache: 'no-store'
      });
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = () => {
    setEditingCampaign(null);
    setShowCreateModal(true);
  };

  const handleEditCampaign = (campaign: MetaCampaign) => {
    setEditingCampaign(campaign);
    setShowCreateModal(true);
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Weet je zeker dat je deze campagne wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/meta-campaigns/${campaignId}`, {
        method: 'DELETE',
        cache: 'no-store'
      });

      if (response.ok) {
        setCampaigns(prev => prev.filter(c => c.id !== campaignId));
      }
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      alert('Fout bij verwijderen campagne');
    }
  };

  const handleViewStats = async (campaign: MetaCampaign) => {
    setStatsLoading(true);
    try {
      const response = await fetch(`/api/admin/meta-campaigns/${campaign.id}/stats`, {
        cache: 'no-store'
      });
      if (response.ok) {
        const stats = await response.json();
        setSelectedStats(stats);
      }
    } catch (error) {
      console.error('Failed to load campaign stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const getStatusBadge = (campaign: MetaCampaign) => {
    if (!campaign.isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <XCircleIcon className="w-4 h-4 mr-1" />
          Inactief
        </span>
      );
    }

    if (campaign.batchCompletedAt) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircleIcon className="w-4 h-4 mr-1" />
          Compleet
        </span>
      );
    }

    if (campaign.isBatchActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <ArrowPathIcon className="w-4 h-4 mr-1" />
          Actief
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
        Gepauzeerd
      </span>
    );
  };

  const getTerritoryDescription = (campaign: MetaCampaign) => {
    return GeographicUtils.getTerritoryDescription({
      type: campaign.territoryType,
      centerPostcode: campaign.centerPostcode,
      centerLat: campaign.centerLat,
      centerLng: campaign.centerLng,
      radiusKm: campaign.radiusKm,
      allowedRegions: campaign.allowedRegions
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white">
          <div className="h-12 w-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-sm">Meta campagnes laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Meta Campaign Management</h1>
              <p className="mt-2 text-white/70">
                Beheer Meta/Facebook campagnes en monitor lead qualifying
              </p>
            </div>
            <button
              onClick={handleCreateCampaign}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-purple hover:bg-white/90 transition"
            >
              <PlusIcon className="w-4 h-4" />
              Nieuwe Campagne
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/70">Totaal Campagnes</p>
                <p className="text-2xl font-bold text-white">{campaigns.length}</p>
              </div>
              <ChartBarIcon className="w-8 h-8 text-white/60" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/70">Actieve Campagnes</p>
                <p className="text-2xl font-bold text-white">
                  {campaigns.filter(c => c.isActive && c.isBatchActive).length}
                </p>
              </div>
              <CheckCircleIcon className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/70">Volledige Batches</p>
                <p className="text-2xl font-bold text-white">
                  {campaigns.filter(c => c.batchCompletedAt).length}
                </p>
              </div>
              <UserGroupIcon className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/70">Leads Ontvangen</p>
                <p className="text-2xl font-bold text-white">
                  {campaigns.reduce((sum, c) => sum + c.currentBatchCount, 0)}
                </p>
              </div>
              <MapPinIcon className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </motion.div>

        {/* Campaigns Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Meta Campagnes</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Campagne
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Klant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branche
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gebied
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Batch Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {campaign.campaignName || `Campaign ${campaign.metaCampaignId.slice(-8)}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          {campaign.metaCampaignId}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {campaign.customerEmail}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {campaign.branchId}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getTerritoryDescription(campaign)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {campaign.currentBatchCount} / {campaign.totalBatchSize}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(campaign.currentBatchCount / campaign.totalBatchSize) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(campaign)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleViewStats(campaign)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Bekijk statistieken"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditCampaign(campaign)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Bewerken"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Verwijderen"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {campaigns.length === 0 && (
            <div className="px-6 py-12 text-center">
              <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Geen campagnes</h3>
              <p className="mt-1 text-sm text-gray-500">
                Er zijn nog geen Meta campagnes geconfigureerd.
              </p>
              <div className="mt-6">
                <button
                  onClick={handleCreateCampaign}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Eerste campagne toevoegen
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Stats Modal */}
        <AnimatePresence>
          {selectedStats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
              onClick={() => setSelectedStats(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Campagne Statistieken</h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{selectedStats.totalLeads}</div>
                      <div className="text-sm text-gray-600">Totaal ontvangen</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{selectedStats.qualifiedLeads}</div>
                      <div className="text-sm text-gray-600">Gekwalificeerd</div>
                    </div>
                  </div>

                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{selectedStats.conversionRate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-600">Conversie ratio</div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Top afwijzingsredenen</h4>
                    <div className="space-y-2">
                      {selectedStats.topRejectionReasons.map((reason, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-gray-600">{reason.reason}</span>
                          <span className="font-medium">{reason.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setSelectedStats(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Sluiten
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create/Edit Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <CampaignModal
              campaign={editingCampaign}
              onClose={() => {
                setShowCreateModal(false);
                setEditingCampaign(null);
              }}
              onSave={() => {
                setShowCreateModal(false);
                setEditingCampaign(null);
                loadCampaigns();
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Campaign Modal Component
function CampaignModal({ campaign, onClose, onSave }: {
  campaign: MetaCampaign | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    customerEmail: campaign?.customerEmail || '',
    metaCampaignId: campaign?.metaCampaignId || '',
    metaFormId: campaign?.metaFormId || '',
    campaignName: campaign?.campaignName || '',
    branchId: campaign?.branchId || 'thuisbatterijen',
    totalBatchSize: campaign?.totalBatchSize || 50,
    territoryType: campaign?.territoryType || 'radius',
    centerPostcode: campaign?.centerPostcode || '',
    radiusKm: campaign?.radiusKm || 95,
    allowedRegions: campaign?.allowedRegions || [],
    isActive: campaign?.isActive ?? true
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = campaign
        ? `/api/admin/meta-campaigns/${campaign.id}`
        : '/api/admin/meta-campaigns';

      const response = await fetch(url, {
        method: campaign ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        cache: 'no-store'
      });

      if (response.ok) {
        onSave();
      } else {
        const error = await response.json();
        alert(`Fout: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to save campaign:', error);
      alert('Fout bij opslaan campagne');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {campaign ? 'Campagne bewerken' : 'Nieuwe campagne'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Klant Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.customerEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campagne Naam (optioneel)
                </label>
                <input
                  type="text"
                  value={formData.campaignName}
                  onChange={(e) => setFormData(prev => ({ ...prev, campaignName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta Campaign ID
                </label>
                <input
                  type="text"
                  required
                  value={formData.metaCampaignId}
                  onChange={(e) => setFormData(prev => ({ ...prev, metaCampaignId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta Form ID
                </label>
                <input
                  type="text"
                  required
                  value={formData.metaFormId}
                  onChange={(e) => setFormData(prev => ({ ...prev, metaFormId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branche
                </label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData(prev => ({ ...prev, branchId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="thuisbatterijen">Thuisbatterijen</option>
                  <option value="kozijnen">Kozijnen</option>
                  <option value="warmtepompen">Warmtepompen</option>
                  <option value="financial-lease">Financial Lease</option>
                  <option value="zonnepanelen">Zonnepanelen</option>
                  <option value="airco">Airco</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch Grootte
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.totalBatchSize}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalBatchSize: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gebied Type
              </label>
              <select
                value={formData.territoryType}
                onChange={(e) => setFormData(prev => ({ ...prev, territoryType: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="radius">Straal rondom postcode</option>
                <option value="full_country">Heel Nederland</option>
                <option value="regions">Specifieke provincies</option>
              </select>
            </div>

            {formData.territoryType === 'radius' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Centrum Postcode
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.centerPostcode}
                    onChange={(e) => setFormData(prev => ({ ...prev, centerPostcode: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="8011AA"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Straal (km)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.radiusKm}
                    onChange={(e) => setFormData(prev => ({ ...prev, radiusKm: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                Campagne actief
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Opslaan...' : (campaign ? 'Bijwerken' : 'Aanmaken')}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
