/**
 * Admin Branch Management Page
 * Overview of all branches with create/edit/delete functionality
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
  XCircleIcon,
  RectangleGroupIcon,
} from '@heroicons/react/24/outline';

interface Branch {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminBranchesPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load branches
  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/branches', {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load branches');
      }

      const data = await response.json();
      setBranches(data.branches || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading branches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = () => {
    setShowCreateModal(true);
  };

  const handleEditBranch = (branchId: string) => {
    router.push(`/admin/branches/${branchId}`);
  };

  const handleDeleteBranch = async (branchId: string, branchName: string) => {
    if (!confirm(`Weet je zeker dat je "${branchName}" wilt verwijderen?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/branches/${branchId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete branch');
      }

      // Reload branches
      await loadBranches();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      console.error('Error deleting branch:', err);
    }
  };

  if (isLoading) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Branches</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {branches.length} totaal • {branches.filter(b => b.is_active).length} actief
          </p>
        </div>

        <button
          onClick={handleCreateBranch}
          className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Nieuwe branch
        </button>
      </motion.div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <p className="font-medium text-red-900">Fout bij laden branches:</p>
          <p className="text-sm text-red-700">{error}</p>
        </motion.div>
      )}

      {/* Branches Grid */}
      {branches.length === 0 && !isLoading ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 bg-white rounded-lg shadow"
        >
          <RectangleGroupIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nog geen branches</h3>
          <p className="text-gray-600 mb-4">
            Maak je eerste branch aan om te beginnen met configuratie
          </p>
          <button
            onClick={handleCreateBranch}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Eerste branch aanmaken
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <AnimatePresence>
            {branches.map((branch) => (
              <motion.div
                key={branch.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200"
              >
                {/* Branch Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-brand-purple to-brand-pink rounded-lg flex items-center justify-center text-2xl">
                      {branch.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {branch.display_name}
                      </h3>
                      <p className="text-sm text-gray-500">{branch.name}</p>
                    </div>
                  </div>

                  {branch.is_active ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      ✓ Actief
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                      ○ Inactief
                    </span>
                  )}
                </div>

                {/* Description */}
                {branch.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {branch.description}
                  </p>
                )}

                {/* Metadata */}
                <div className="mb-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Aangemaakt: {new Date(branch.created_at).toLocaleDateString('nl-NL', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditBranch(branch.id)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-lg transition-all text-sm font-medium"
                  >
                    <Cog6ToothIcon className="w-4 h-4" />
                    Configureren
                  </button>

                  <button
                    onClick={() => handleDeleteBranch(branch.id, branch.display_name)}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all text-sm"
                    title="Verwijderen"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create Branch Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateBranchModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              loadBranches();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Create Branch Modal Component
function CreateBranchModal({
  onClose,
  onSuccess
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    icon: '📋'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create branch');
      }

      const { branch } = await response.json();
      
      // Redirect to configuration page
      window.location.href = `/admin/branches/${branch.id}`;
    } catch (err: any) {
      setError(err.message);
      console.error('Error creating branch:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Nieuwe branch</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch naam (intern) *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                placeholder="bijv. financial_lease"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Lowercase, geen spaties (gebruik underscores)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weergave naam *
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                placeholder="bijv. Financial Lease"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Omschrijving (optioneel)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                rows={3}
                placeholder="Lead tracking voor..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Icon (emoji)
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-2xl text-center"
                placeholder="📋"
                maxLength={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                Annuleren
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Aanmaken...' : 'Branch aanmaken'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  );
}
