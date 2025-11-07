'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon, 
  PlusIcon, 
  UserPlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useAuthStore, type UserPermissions, type User, authenticatedFetch } from '@/lib/auth';

interface EmployeeAccount {
  email: string;
  name: string;
  role: 'employee';
  permissions: UserPermissions;
  invitedAt: string;
  acceptedAt?: string;
  isActive: boolean;
}

interface Company {
  id: string;
  ownerEmail: string;
  companyName: string;
  employees: EmployeeAccount[];
  createdAt: string;
}

interface EmployeeManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export function EmployeeManagementModal({ isOpen, onClose, user }: EmployeeManagementModalProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: '',
    name: '',
    permissions: {
      canViewLeads: true,
      canViewOrders: true,
      canManageEmployees: false,
      canCheckout: false,
    }
  });

  // Use refs to track cleanup and prevent race conditions
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Load company data when modal opens
  useEffect(() => {
    if (isOpen && user?.email) {
      isMountedRef.current = true;
      loadCompanyData();
    }
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isOpen, user?.email]);

  const loadCompanyData = async (clearMessages = true) => {
    if (!isMountedRef.current || !user?.email) return; // Prevent state updates if component unmounted or no user
    
    setIsLoading(true);
    setError(null);
    if (clearMessages) {
      setSuccess(null);
    }
    
    try {
      const response = await authenticatedFetch(`/api/auth/company?ownerEmail=${encodeURIComponent(user.email)}`);
      const data = await response.json();
      
      // Double-check component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      if (response.ok && data.success) {
        setCompany(data.company);
      } else {
        if (response.status === 401) {
          setError('Je sessie is verlopen. Log opnieuw in om je team te beheren.');
        } else {
          setError(data.error || 'Fout bij het laden van bedrijfsgegevens');
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Fout bij het laden van bedrijfsgegevens');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleInviteEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.email) {
      setError('Gebruiker niet gevonden');
      return;
    }
    
    if (!inviteData.email || !inviteData.name) {
      setError('Email en naam zijn verplicht');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch('/api/auth/invite-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerEmail: user.email,
          employeeEmail: inviteData.email,
          employeeName: inviteData.name,
          permissions: inviteData.permissions
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Reload company data to show new employee
        await loadCompanyData();
        setShowInviteForm(false);
        setInviteData({
          email: '',
          name: '',
          permissions: {
            canViewLeads: true,
            canViewOrders: true,
            canManageEmployees: false,
            canCheckout: false,
          }
        });
      } else {
        if (response.status === 401) {
          setError('Je sessie is verlopen. Log opnieuw in om werknemers uit te nodigen.');
        } else {
          setError(result.error || 'Fout bij het uitnodigen van werknemer');
        }
      }
    } catch (err) {
      setError('Fout bij het uitnodigen van werknemer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveEmployee = async (employeeEmail: string) => {
    if (!user?.email) {
      setError('Gebruiker niet gevonden');
      return;
    }
    
    // Find employee name for better confirmation message
    const employee = company?.employees.find(emp => emp.email === employeeEmail);
    const employeeName = employee?.name || employeeEmail;
    
    if (!confirm(`Weet je zeker dat je ${employeeName} (${employeeEmail}) wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const deleteUrl = `/api/auth/company?ownerEmail=${encodeURIComponent(user.email)}&employeeEmail=${encodeURIComponent(employeeEmail)}`;
      console.log('🗑️ Delete URL:', deleteUrl);

      const response = await authenticatedFetch(deleteUrl, { method: 'DELETE' });

      console.log('🗑️ Delete response status:', response.status);
      console.log('🗑️ Delete response ok:', response.ok);
      
      const result = await response.json();
      console.log('🗑️ Delete response result:', result);

      if (response.ok && result.success) {
        // Immediately update the local state to remove the employee from UI
        if (company && isMountedRef.current) {
          const updatedCompany = {
            ...company,
            employees: company.employees.filter(emp => emp.email !== employeeEmail)
          };
          setCompany(updatedCompany);
        }
        
        // Show success message
        const successMessage = `${employeeName} is succesvol verwijderd uit het team.`;
        if (isMountedRef.current) {
          setSuccess(successMessage);
        }
        
        // Verify the deletion was successful by doing a background check
        // Only reload if we detect inconsistency
        setTimeout(async () => {
          if (!isMountedRef.current || !user?.email) return;
          
          try {
            const verifyResponse = await authenticatedFetch(`/api/auth/company?ownerEmail=${encodeURIComponent(user.email)}`);
            const verifyData = await verifyResponse.json();
            
            // Only update if there's a discrepancy (employee still exists in backend but not in UI)
            if (verifyResponse.ok && verifyData.success && verifyData.company) {
              const stillExists = verifyData.company.employees.some((emp: EmployeeAccount) => emp.email === employeeEmail);
              const uiShowsDeleted = !company?.employees.some(emp => emp.email === employeeEmail);
              
              // If backend still has employee but UI doesn't, update UI to match backend
              // This handles the race condition where deletion might have failed
              if (stillExists && uiShowsDeleted && isMountedRef.current) {
                setCompany(verifyData.company);
                setSuccess(null);
                setError(`${employeeName} kon niet worden verwijderd. Probeer het opnieuw.`);
              }
            }
          } catch (verifyError) {
            // Verification failed, but don't change UI since local update was successful
          }
        }, 1000); // Check after 1 second
        
        // Clear success message after 5 seconds with proper cleanup
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setSuccess(null);
          }
          timeoutRef.current = null;
        }, 5000);
      } else {
        console.error('❌ Delete failed:', { status: response.status, result });
        const errorMessage = response.status === 401
          ? 'Je sessie is verlopen. Log opnieuw in om werknemers te verwijderen.'
          : result.error || 'Fout bij het verwijderen van werknemer';
        setError(errorMessage);
        console.error('❌ Error message set:', errorMessage);
      }
    } catch (err) {
      console.error('❌ Delete error:', err);
      const errorMessage = 'Fout bij het verwijderen van werknemer';
      setError(errorMessage);
    } finally {
      console.log('🗑️ Delete operation finished, setting loading to false');
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="relative bg-gradient-to-r from-orange-600 to-red-600 text-white px-8 py-6 rounded-t-3xl">
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
              
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <UserPlusIcon className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold">Team Beheer</h2>
                  <p className="text-orange-100 mt-1">
                    Beheer werknemers en hun toegang
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8">
              {error && (
                <div className="mb-6 p-4 bg-red-100 border-2 border-red-300 rounded-xl text-red-700">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-6 p-4 bg-green-100 border-2 border-green-300 rounded-xl text-green-700">
                  <div className="flex items-center gap-2">
                    <CheckIcon className="w-5 h-5" />
                    {success}
                  </div>
                </div>
              )}

              {/* Invite Button */}
              <div className="mb-6 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Werknemers</h3>
                <button
                  onClick={() => setShowInviteForm(!showInviteForm)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl hover:from-orange-700 hover:to-red-700 transition-all font-medium"
                >
                  <PlusIcon className="w-5 h-5" />
                  Werknemer uitnodigen
                </button>
              </div>

              {/* Invite Form */}
              {showInviteForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 p-6 bg-white rounded-2xl border-2 border-orange-200 shadow-sm"
                >
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Nieuwe werknemer uitnodigen</h4>
                  
                  <form onSubmit={handleInviteEmployee} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email adres
                        </label>
                        <input
                          type="email"
                          required
                          value={inviteData.email}
                          onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-orange-500"
                          placeholder="werknemer@bedrijf.nl"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Volledige naam
                        </label>
                        <input
                          type="text"
                          required
                          value={inviteData.name}
                          onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-orange-500"
                          placeholder="Jan Werknemer"
                        />
                      </div>
                    </div>

                    {/* Permissions */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Toegangsrechten
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={inviteData.permissions.canViewLeads}
                            onChange={(e) => setInviteData({
                              ...inviteData,
                              permissions: { ...inviteData.permissions, canViewLeads: e.target.checked }
                            })}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">Leads bekijken</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={inviteData.permissions.canViewOrders}
                            onChange={(e) => setInviteData({
                              ...inviteData,
                              permissions: { ...inviteData.permissions, canViewOrders: e.target.checked }
                            })}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">Orders bekijken</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={inviteData.permissions.canManageEmployees}
                            onChange={(e) => setInviteData({
                              ...inviteData,
                              permissions: { ...inviteData.permissions, canManageEmployees: e.target.checked }
                            })}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">Werknemers beheren</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={inviteData.permissions.canCheckout}
                            onChange={(e) => setInviteData({
                              ...inviteData,
                              permissions: { ...inviteData.permissions, canCheckout: e.target.checked }
                            })}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">Kunnen bestellen</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl hover:from-orange-700 hover:to-red-700 transition-all font-medium disabled:opacity-50"
                      >
                        {isLoading ? 'Uitnodigen...' : 'Uitnodigen'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowInviteForm(false)}
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-xl hover:bg-gray-400 transition-all font-medium"
                      >
                        Annuleren
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* Employees List */}
              <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-sm">
                {isLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Laden...</p>
                  </div>
                ) : (company?.employees && company.employees.length > 0) ? (
                  <div className="divide-y divide-gray-200">
                    {company.employees.map((employee, index) => (
                      <div key={employee.email} className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-semibold text-gray-900">{employee.name}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                employee.isActive 
                                  ? 'bg-green-100 text-green-700 border border-green-300'
                                  : employee.acceptedAt
                                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                    : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                              }`}>
                                {employee.isActive ? 'Actief' : employee.acceptedAt ? 'Account Aangemaakt' : 'Uitgenodigd'}
                              </span>
                            </div>
                            <p className="text-gray-600 mb-2">{employee.email}</p>
                            <div className="flex flex-wrap gap-2">
                              {employee.permissions.canViewLeads && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs">Leads</span>
                              )}
                              {employee.permissions.canViewOrders && (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs">Orders</span>
                              )}
                              {employee.permissions.canManageEmployees && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs">Team</span>
                              )}
                              {employee.permissions.canCheckout && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs">Bestellen</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                              Uitgenodigd op {formatDate(employee.invitedAt)}
                              {employee.acceptedAt && (
                                <span> • Geaccepteerd op {formatDate(employee.acceptedAt)}</span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveEmployee(employee.email)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Werknemer verwijderen"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <UserPlusIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Nog geen werknemers toegevoegd</p>
                    <p className="text-sm">Nodig je eerste werknemer uit om te beginnen</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

