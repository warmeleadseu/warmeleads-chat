'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  RectangleStackIcon,
  MapPinIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

interface Batch {
  id: string;
  customerEmail: string;
  customerName: string;
  batchNumber: string;
  branchId: string;
  totalBatchSize: number;
  currentBatchCount: number;
  spreadsheetUrl: string;
  sheetName: string;
  territoryType: 'radius' | 'full_country' | 'regions';
  centerPostcode?: string;
  radiusKm?: number;
  allowedRegions?: string[];
  isActive: boolean;
  isCompleted: boolean;
  createdAt: string;
  lastLeadReceivedAt?: string;
  notes?: string;
}

interface Customer {
  email: string;
  company_name?: string;
  contact_person?: string;
}

interface Branch {
  id: string;
  name: string;
  displayName: string;
  icon: string;
}

export default function AdminBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [formData, setFormData] = useState({
    customerEmail: '',
    branchId: '',
    totalBatchSize: 50,
    spreadsheetUrl: '',
    sheetName: 'Leads',
    territoryType: 'full_country' as 'radius' | 'full_country' | 'regions',
    centerPostcode: '',
    radiusKm: 95,
    allowedRegions: [] as string[],
    notes: '',
  });

  useEffect(() => {
    loadData();
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      const response = await fetch('/api/admin/configured-branches', {
        cache: 'no-store',
      });
      const data = await response.json();
      setBranches(data.branches || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    } finally {
      setLoadingBranches(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [batchesRes, customersRes] = await Promise.all([
        fetch('/api/admin/batches', { cache: 'no-store' }),
        fetch('/api/admin/customers', { cache: 'no-store' }),
      ]);

      const batchesData = await batchesRes.json();
      const customersData = await customersRes.json();

      setBatches(batchesData.batches || []);
      setCustomers(customersData.customers || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingBatch
        ? `/api/admin/batches/${editingBatch.id}`
        : '/api/admin/batches';

      const method = editingBatch ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save batch');

      await loadData();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving batch:', error);
      alert('Er ging iets mis bij het opslaan');
    }
  };

  const handleDelete = async (batchId: string) => {
    if (!confirm('Weet je zeker dat je deze batch wilt verwijderen?')) return;

    try {
      const response = await fetch(`/api/admin/batches/${batchId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      await loadData();
    } catch (error) {
      console.error('Error deleting batch:', error);
      alert('Er ging iets mis bij het verwijderen');
    }
  };

  const handleEdit = (batch: Batch) => {
    setEditingBatch(batch);
    setFormData({
      customerEmail: batch.customerEmail,
      branchId: batch.branchId,
      totalBatchSize: batch.totalBatchSize,
      spreadsheetUrl: batch.spreadsheetUrl,
      sheetName: batch.sheetName,
      territoryType: batch.territoryType,
      centerPostcode: batch.centerPostcode || '',
      radiusKm: batch.radiusKm || 95,
      allowedRegions: batch.allowedRegions || [],
      notes: batch.notes || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBatch(null);
    setFormData({
      customerEmail: '',
      branchId: '',
      totalBatchSize: 50,
      spreadsheetUrl: '',
      sheetName: 'Leads',
      territoryType: 'full_country',
      centerPostcode: '',
      radiusKm: 95,
      allowedRegions: [],
      notes: '',
    });
  };

  const toggleActive = async (batch: Batch) => {
    try {
      const response = await fetch(`/api/admin/batches/${batch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !batch.isActive }),
      });

      if (!response.ok) throw new Error('Failed to toggle');

      await loadData();
    } catch (error) {
      console.error('Error toggling batch:', error);
    }
  };

  const getProgress = (batch: Batch) => {
    return (batch.currentBatchCount / batch.totalBatchSize) * 100;
  };

  const getTerritoryLabel = (batch: Batch) => {
    if (batch.territoryType === 'radius' && batch.centerPostcode) {
      return `${batch.radiusKm}km rondom ${batch.centerPostcode}`;
    }
    if (batch.territoryType === 'regions') {
      return `${batch.allowedRegions?.length || 0} regio's`;
    }
    return 'Heel Nederland';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeBatches = batches.filter((b) => b.isActive && !b.isCompleted);
  const completedBatches = batches.filter((b) => b.isCompleted);

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-brand-navy">Batch Beheer</h1>
            <p className="text-gray-600 mt-1">
              Beheer actieve lead batches van klanten
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-lisa-gradient text-white rounded-lg hover:shadow-lg transition-all"
          >
            <PlusIcon className="w-5 h-5" />
            Nieuwe batch
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Totaal batches</div>
            <div className="text-2xl font-bold text-brand-navy">{batches.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Actief</div>
            <div className="text-2xl font-bold text-green-600">{activeBatches.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Compleet</div>
            <div className="text-2xl font-bold text-blue-600">{completedBatches.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Totaal leads verdeeld</div>
            <div className="text-2xl font-bold text-purple-600">
              {batches.reduce((sum, b) => sum + b.currentBatchCount, 0)}
            </div>
          </div>
        </div>

        {/* Active Batches */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-brand-navy mb-4">Actieve Batches</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {activeBatches.length === 0 ? (
              <div className="text-center py-12">
                <RectangleStackIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Geen actieve batches</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {activeBatches.map((batch) => (
                  <BatchCard
                    key={batch.id}
                    batch={batch}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleActive={toggleActive}
                    getProgress={getProgress}
                    getTerritoryLabel={getTerritoryLabel}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Completed Batches */}
        {completedBatches.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-brand-navy mb-4">Voltooide Batches</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="divide-y divide-gray-200">
                {completedBatches.map((batch) => (
                  <BatchCard
                    key={batch.id}
                    batch={batch}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleActive={toggleActive}
                    getProgress={getProgress}
                    getTerritoryLabel={getTerritoryLabel}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={handleCloseModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-brand-navy">
                    {editingBatch ? 'Batch bewerken' : 'Nieuwe batch'}
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Customer Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Klant *
                    </label>
                    <select
                      required
                      disabled={!!editingBatch}
                      value={formData.customerEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, customerEmail: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    >
                      <option value="">Selecteer klant...</option>
                      {customers.map((customer) => (
                        <option key={customer.email} value={customer.email}>
                          {customer.company_name || customer.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Branch */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Branche *
                    </label>
                    {loadingBranches ? (
                      <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                        Branches laden...
                      </div>
                    ) : branches.length === 0 ? (
                      <div className="w-full px-4 py-2 border border-red-300 bg-red-50 rounded-lg text-red-700 text-sm">
                        ⚠️ Geen geconfigureerde branches gevonden. Configureer eerst branches in het Branches tabblad.
                      </div>
                    ) : (
                      <select
                        required
                        value={formData.branchId}
                        onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Selecteer branche...</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.icon} {branch.displayName}
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Alleen branches met geconfigureerde spreadsheet mappings
                    </p>
                  </div>

                  {/* Batch Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Aantal leads *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.totalBatchSize}
                      onChange={(e) =>
                        setFormData({ ...formData, totalBatchSize: parseInt(e.target.value) })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Spreadsheet URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Google Spreadsheet URL *
                    </label>
                    <input
                      type="url"
                      required
                      value={formData.spreadsheetUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, spreadsheetUrl: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                    />
                  </div>

                  {/* Sheet Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sheet naam
                    </label>
                    <input
                      type="text"
                      value={formData.sheetName}
                      onChange={(e) => setFormData({ ...formData, sheetName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Leads"
                    />
                  </div>

                  {/* Territory Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Territorium type *
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="full_country"
                          checked={formData.territoryType === 'full_country'}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              territoryType: e.target.value as any,
                            })
                          }
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">Heel Nederland</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="radius"
                          checked={formData.territoryType === 'radius'}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              territoryType: e.target.value as any,
                            })
                          }
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">Straal rondom postcode</span>
                      </label>
                    </div>
                  </div>

                  {/* Radius Fields */}
                  {formData.territoryType === 'radius' && (
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Postcode centrum *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.centerPostcode}
                          onChange={(e) =>
                            setFormData({ ...formData, centerPostcode: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="8011AA"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Straal (km) *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={formData.radiusKm}
                          onChange={(e) =>
                            setFormData({ ...formData, radiusKm: parseInt(e.target.value) })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notities (optioneel)
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Annuleren
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-lisa-gradient text-white rounded-lg hover:shadow-lg transition-all"
                    >
                      {editingBatch ? 'Opslaan' : 'Aanmaken'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function BatchCard({
  batch,
  onEdit,
  onDelete,
  onToggleActive,
  getProgress,
  getTerritoryLabel,
}: {
  batch: Batch;
  onEdit: (batch: Batch) => void;
  onDelete: (id: string) => void;
  onToggleActive: (batch: Batch) => void;
  getProgress: (batch: Batch) => number;
  getTerritoryLabel: (batch: Batch) => string;
}) {
  const progress = getProgress(batch);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-brand-navy">{batch.customerName}</h3>
            <span className="text-sm text-gray-500">{batch.batchNumber}</span>
            {batch.isCompleted ? (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                ✓ Compleet
              </span>
            ) : batch.isActive ? (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                ● Actief
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                ○ Inactief
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">Voortgang</span>
              <span className="font-semibold text-brand-navy">
                {batch.currentBatchCount} / {batch.totalBatchSize} leads
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-lisa-gradient h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-gray-500">Branche:</span>
              <p className="text-sm font-medium text-brand-navy">
                {batch.branchId}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Territorium:</span>
              <p className="text-sm font-medium text-brand-navy">{getTerritoryLabel(batch)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Laatste lead:</span>
              <p className="text-sm text-gray-700">
                {batch.lastLeadReceivedAt
                  ? new Date(batch.lastLeadReceivedAt).toLocaleDateString('nl-NL')
                  : 'Nog geen leads'}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <a
              href={batch.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              → Google Spreadsheet openen
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {!batch.isCompleted && (
            <button
              onClick={() => onToggleActive(batch)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title={batch.isActive ? 'Deactiveren' : 'Activeren'}
            >
              {batch.isActive ? <CheckCircleIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-5 h-5 opacity-50" />}
            </button>
          )}
          <button
            onClick={() => onEdit(batch)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Bewerken"
          >
            <PencilIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDelete(batch.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Verwijderen"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
