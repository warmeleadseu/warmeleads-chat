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
  XCircleIcon
} from '@heroicons/react/24/outline';
import { Loading } from '@/components/ui';

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
      const response = await fetch('/api/admin/branches');
      
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
      <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Branch Configuratie
            </h1>
            <p className="text-white/70">
              Beheer alle branches en hun spreadsheet configuraties
            </p>
          </div>

          <motion.button
            onClick={handleCreateBranch}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <PlusIcon className="w-5 h-5" />
            Nieuwe Branch
          </motion.button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-white">
            <p className="font-medium">Fout bij laden branches:</p>
            <p className="text-sm text-white/80">{error}</p>
          </div>
        )}

        {/* Branches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {branches.map((branch) => (
              <motion.div
                key={branch.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:border-white/40 transition-all"
              >
                {/* Branch Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{branch.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {branch.display_name}
                      </h3>
                      <p className="text-sm text-white/60">{branch.name}</p>
                    </div>
                  </div>

                  {branch.is_active ? (
                    <CheckCircleIcon className="w-6 h-6 text-green-400" />
                  ) : (
                    <XCircleIcon className="w-6 h-6 text-red-400" />
                  )}
                </div>

                {/* Description */}
                {branch.description && (
                  <p className="text-white/70 text-sm mb-4 line-clamp-2">
                    {branch.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                  <motion.button
                    onClick={() => handleEditBranch(branch.id)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Cog6ToothIcon className="w-4 h-4" />
                    Configureren
                  </motion.button>

                  <motion.button
                    onClick={() => handleDeleteBranch(branch.id, branch.display_name)}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </motion.button>
                </div>

                {/* Metadata */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-white/50">
                    Aangemaakt: {new Date(branch.created_at).toLocaleDateString('nl-NL')}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {branches.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-white/60 mb-4">Nog geen branches geconfigureerd</p>
            <motion.button
              onClick={handleCreateBranch}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <PlusIcon className="w-5 h-5" />
              Maak je eerste branch
            </motion.button>
          </div>
        )}

        {/* Create Branch Modal */}
        {showCreateModal && (
          <CreateBranchModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              loadBranches();
            }}
          />
        )}
      </div>
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl p-6 max-w-md w-full"
      >
        <h2 className="text-2xl font-bold mb-4">Nieuwe Branch Aanmaken</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch Naam (intern)
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="bijv. financial_lease"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Naam
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="bijv. Financial Lease"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Omschrijving
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
              placeholder="Lead tracking voor..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Icon (emoji)
            </label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-2xl text-center"
              placeholder="📋"
              maxLength={2}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
              disabled={isSubmitting}
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Aanmaken...' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}


