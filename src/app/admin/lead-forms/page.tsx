'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface LeadForm {
  id: string;
  formId: string;
  formName: string;
  branchId: string;
  isActive: boolean;
  totalLeadsReceived: number;
  lastLeadReceivedAt: string | null;
  createdAt: string;
  notes: string | null;
}

interface Branch {
  id: string;
  name: string;
  displayName: string;
  icon: string;
}

export default function AdminLeadFormsPage() {
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingForm, setEditingForm] = useState<LeadForm | null>(null);
  const [formData, setFormData] = useState({
    formId: '',
    formName: '',
    branchId: '',
    notes: '',
  });

  useEffect(() => {
    loadForms();
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

  const loadForms = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/lead-forms', {
        cache: 'no-store',
      });
      const data = await response.json();
      setForms(data.forms || []);
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingForm
        ? `/api/admin/lead-forms/${editingForm.id}`
        : '/api/admin/lead-forms';
      
      const method = editingForm ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save form');

      await loadForms();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving form:', error);
      alert('Er ging iets mis bij het opslaan');
    }
  };

  const handleDelete = async (formId: string) => {
    if (!confirm('Weet je zeker dat je dit formulier wilt verwijderen?')) return;

    try {
      const response = await fetch(`/api/admin/lead-forms/${formId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      await loadForms();
    } catch (error) {
      console.error('Error deleting form:', error);
      alert('Er ging iets mis bij het verwijderen');
    }
  };

  const handleEdit = (form: LeadForm) => {
    setEditingForm(form);
    setFormData({
      formId: form.formId,
      formName: form.formName,
      branchId: form.branchId,
      notes: form.notes || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingForm(null);
    setFormData({ formId: '', formName: '', branchId: '', notes: '' });
  };

  const toggleActive = async (form: LeadForm) => {
    try {
      const response = await fetch(`/api/admin/lead-forms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !form.isActive }),
      });

      if (!response.ok) throw new Error('Failed to toggle');

      await loadForms();
    } catch (error) {
      console.error('Error toggling form:', error);
    }
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
            <h1 className="text-3xl font-bold text-brand-navy">Lead Formulieren</h1>
            <p className="text-gray-600 mt-1">
              Beheer Meta/Facebook lead formulieren en koppel ze aan branches
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-lisa-gradient text-white rounded-lg hover:shadow-lg transition-all"
          >
            <PlusIcon className="w-5 h-5" />
            Nieuw formulier
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Totaal formulieren</div>
            <div className="text-2xl font-bold text-brand-navy">{forms.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Actief</div>
            <div className="text-2xl font-bold text-green-600">
              {forms.filter((f) => f.isActive).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Totaal leads ontvangen</div>
            <div className="text-2xl font-bold text-blue-600">
              {forms.reduce((sum, f) => sum + f.totalLeadsReceived, 0)}
            </div>
          </div>
        </div>

        {/* Forms List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {forms.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nog geen formulieren toegevoegd</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Voeg je eerste formulier toe
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {forms.map((form) => (
                <motion.div
                  key={form.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-brand-navy">
                          {form.formName}
                        </h3>
                        <button
                          onClick={() => toggleActive(form)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            form.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {form.isActive ? '● Actief' : '○ Inactief'}
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div>
                          <span className="text-sm text-gray-500">Form ID:</span>
                          <code className="ml-2 text-sm bg-gray-100 px-2 py-1 rounded">
                            {form.formId}
                          </code>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Branche:</span>
                          <span className="ml-2 text-sm font-medium text-brand-navy">
                            {branches.find((b) => b.id === form.branchId)?.displayName || form.branchId}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Leads ontvangen:</span>
                          <span className="ml-2 text-sm font-bold text-blue-600">
                            {form.totalLeadsReceived}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Laatste lead:</span>
                          <span className="ml-2 text-sm text-gray-700">
                            {form.lastLeadReceivedAt
                              ? new Date(form.lastLeadReceivedAt).toLocaleString('nl-NL')
                              : 'Nog geen leads'}
                          </span>
                        </div>
                      </div>

                      {form.notes && (
                        <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                          {form.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(form)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Bewerken"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(form.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Verwijderen"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
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
              <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-brand-navy">
                    {editingForm ? 'Formulier bewerken' : 'Nieuw formulier'}
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meta Form ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.formId}
                      onChange={(e) => setFormData({ ...formData, formId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="123456789012345"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Het Form ID uit Meta Business Manager
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Formulier naam *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.formName}
                      onChange={(e) => setFormData({ ...formData, formName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Thuisbatterij NL"
                    />
                  </div>

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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notities (optioneel)
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Extra informatie over dit formulier..."
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
                      {editingForm ? 'Opslaan' : 'Toevoegen'}
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
