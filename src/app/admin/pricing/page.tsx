'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CurrencyEuroIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { type BranchPricingConfig } from '@/lib/pricing';
import { ADMIN_CONFIG } from '@/config/admin';

export default function AdminPricingPage() {
  const [pricing, setPricing] = useState<BranchPricingConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [editedPricing, setEditedPricing] = useState<BranchPricingConfig | null>(null);
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    // Get admin email from localStorage
    const storedEmail = localStorage.getItem('warmeleads_admin_user');
    if (storedEmail) {
      setAdminEmail(storedEmail);
    }

    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/pricing');
      if (response.ok) {
        const data = await response.json();
        setPricing(data);
      }
    } catch (error) {
      console.error('Error loading pricing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (branch: BranchPricingConfig) => {
    setEditingBranch(branch.branchId);
    setEditedPricing(JSON.parse(JSON.stringify(branch))); // Deep copy
  };

  const cancelEditing = () => {
    setEditingBranch(null);
    setEditedPricing(null);
  };

  const updateField = (field: string, value: any) => {
    if (!editedPricing) return;

    const keys = field.split('.');
    const updated = JSON.parse(JSON.stringify(editedPricing));
    
    let current: any = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = parseFloat(value) || value;

    setEditedPricing(updated);
  };

  const savePricing = async () => {
    if (!editedPricing || !adminEmail) return;

    try {
      setSaving(true);
      
      const response = await fetch('/api/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: editedPricing.branchId,
          updates: editedPricing
        })
      });

      if (response.ok) {
        alert('✅ Prijzen succesvol opgeslagen!');
        await loadPricing();
        cancelEditing();
      } else {
        const error = await response.json();
        alert(`❌ Fout bij opslaan: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving pricing:', error);
      alert('❌ Fout bij opslaan van prijzen');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm('⚠️ Weet je zeker dat je alle prijzen wilt resetten naar de standaardwaarden?\n\nDit kan niet ongedaan worden gemaakt!')) {
      return;
    }

    try {
      setSaving(true);
      
      // Fetch default pricing
      const response = await fetch('/api/pricing');
      if (response.ok) {
        const defaultPricing = await response.json();
        
        // Save as current pricing
        const saveResponse = await fetch('/api/pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminEmail,
            pricing: defaultPricing
          })
        });

        if (saveResponse.ok) {
          alert('✅ Prijzen gereset naar standaardwaarden!');
          await loadPricing();
        }
      }
    } catch (error) {
      console.error('Error resetting pricing:', error);
      alert('❌ Fout bij resetten van prijzen');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Prijzen laden...</p>
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
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prijsbeheer</h1>
          <p className="text-gray-600 mt-1">Beheer leadprijzen per branche</p>
        </div>

        <button
          onClick={resetToDefaults}
          disabled={isSaving}
          className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <ArrowPathIcon className="w-5 h-5" />
          Reset naar standaard
        </button>
      </motion.div>

      {/* Warning Message */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
        <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-yellow-900">Let op!</h3>
          <p className="text-yellow-800 text-sm mt-1">
            Prijswijzigingen worden direct zichtbaar op de hele website, inclusief de checkout modal, 
            landingspagina's en alle andere plaatsen waar prijzen worden getoond.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pricing.filter(p => p.branchId !== 'test').map((branch) => {
          const isEditing = editingBranch === branch.branchId;
          const displayBranch = isEditing ? editedPricing! : branch;

          return (
            <motion.div
              key={branch.branchId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-brand-purple to-brand-pink p-6">
                <div className="flex justify-between items-start">
                  <div className="text-white">
                    <h2 className="text-2xl font-bold">{branch.branchName}</h2>
                    <p className="text-white/80 text-sm mt-1">{branch.branchId}</p>
                  </div>
                  
                  {!isEditing ? (
                    <button
                      onClick={() => startEditing(branch)}
                      className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={savePricing}
                        disabled={isSaving}
                        className="bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white p-2 rounded-lg transition-colors"
                      >
                        <CheckIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={isSaving}
                        className="bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white p-2 rounded-lg transition-colors"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Exclusieve Leads */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CurrencyEuroIcon className="w-5 h-5 text-brand-purple" />
                    Exclusieve Leads
                  </h3>
                  
                  <div className="space-y-3">
                    {displayBranch.exclusive.tiers.map((tier, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">
                            Vanaf {tier.minQuantity} leads
                          </span>
                          {tier.discount && tier.discount > 0 && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              -{tier.discount.toFixed(2)}% korting
                            </span>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">€</span>
                            <input
                              type="number"
                              step="0.01"
                              value={tier.pricePerLead}
                              onChange={(e) => updateField(`exclusive.tiers.${index}.pricePerLead`, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                            />
                            <span className="text-gray-600">per lead (excl. BTW)</span>
                          </div>
                        ) : (
                          <div className="text-2xl font-bold text-gray-900">
                            €{tier.pricePerLead.toFixed(2).replace('.', ',')}
                            <span className="text-sm font-normal text-gray-600 ml-2">
                              per lead (excl. BTW)
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gedeelde Leads */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CurrencyEuroIcon className="w-5 h-5 text-brand-pink" />
                    Gedeelde Leads
                  </h3>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-2">
                      Vanaf {displayBranch.shared.minQuantity} leads
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">€</span>
                        <input
                          type="number"
                          step="0.01"
                          value={displayBranch.shared.basePrice}
                          onChange={(e) => updateField('shared.basePrice', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                        />
                        <span className="text-gray-600">per lead (excl. BTW)</span>
                      </div>
                    ) : (
                      <div className="text-2xl font-bold text-gray-900">
                        €{displayBranch.shared.basePrice.toFixed(2).replace('.', ',')}
                        <span className="text-sm font-normal text-gray-600 ml-2">
                          per lead (excl. BTW)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}