'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserGroupIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  PhoneIcon,
  XMarkIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { crmSystem, type Customer } from '@/lib/crmSystem';
import { ADMIN_CONFIG, getFirstAdminEmail } from '@/config/admin';

// Customer Detail Modal Component
function CustomerDetailModal({ customer, onClose, onRefresh }: { customer: Customer; onClose: () => void; onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState<'info' | 'chat' | 'orders' | 'invoices' | 'notes' | 'account'>('info');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-purple to-brand-pink text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {customer.name?.charAt(0) || customer.email.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold">{customer.name || 'Naamloos'}</h2>
                <p className="text-white/80">{customer.email}</p>
                {customer.company && <p className="text-white/60 text-sm">{customer.company}</p>}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Quick Actions */}
              <div className="flex space-x-2">
                <a
                  href={`mailto:${customer.email}`}
                  className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors"
                  title="Email versturen"
                >
                  <EnvelopeIcon className="w-5 h-5" />
                </a>
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors"
                    title="Bellen"
                  >
                    <PhoneIcon className="w-5 h-5" />
                  </a>
                )}
                {customer.phone && (
                  <a
                    href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors"
                    title="WhatsApp"
                  >
                    💬
                  </a>
                )}
              </div>
              <button onClick={onClose} className="text-white/80 hover:text-white">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6 overflow-x-auto">
            {[
              { id: 'info', label: 'Info', icon: UserGroupIcon },
              { id: 'chat', label: `Chat (${customer.chatHistory.length})`, icon: ChatBubbleLeftRightIcon },
              { id: 'orders', label: `Bestellingen (${customer.orders.length})`, icon: DocumentTextIcon },
              { id: 'invoices', label: `Facturen (${customer.openInvoices.length})`, icon: ClockIcon },
              { id: 'notes', label: 'Notities', icon: DocumentTextIcon },
              ...(customer.hasAccount ? [{ id: 'account', label: 'Account Beheer', icon: UserGroupIcon }] : [])
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-brand-purple text-brand-purple'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Contact Info</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Naam:</strong> {customer.name || 'Niet opgegeven'}</div>
                    <div><strong>Email:</strong> {customer.email}</div>
                    <div><strong>Telefoon:</strong> {customer.phone || 'Niet opgegeven'}</div>
                    <div><strong>Bedrijf:</strong> {customer.company || 'Niet opgegeven'}</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Statistieken</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Status:</strong> {customer.status}</div>
                    <div><strong>Bron:</strong> {customer.source}</div>
                    <div><strong>Chat berichten:</strong> {customer.chatHistory.length}</div>
                    <div><strong>Bestellingen:</strong> {customer.orders.length}</div>
                    <div><strong>Totale waarde:</strong> €{customer.orders.reduce((sum, o) => sum + o.amount, 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {customer.dataHistory.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Wijzigingsgeschiedenis</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {customer.dataHistory.slice(-10).map((change, index) => (
                      <div key={index} className="text-sm bg-gray-50 p-3 rounded-lg">
                        <strong>{change.field}:</strong> "{change.oldValue || 'leeg'}" → "{change.newValue}"
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(change.timestamp).toLocaleString('nl-NL')} via {change.source}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Chat Geschiedenis</h3>
              {customer.chatHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nog geen chat berichten</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto bg-gray-50 p-4 rounded-lg">
                  {customer.chatHistory.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.type === 'lisa' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-xs px-4 py-2 rounded-lg ${
                        msg.type === 'lisa' 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'bg-brand-purple text-white'
                      }`}>
                        <div className="text-sm">{msg.content}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString('nl-NL')}
                          {msg.step && ` (${msg.step})`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Open Facturen</h3>
                {customer.openInvoices.length > 0 && (
                  <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    📧 Verstuur reminder
                  </button>
                )}
              </div>
              {customer.openInvoices.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Geen openstaande facturen</p>
              ) : (
                <div className="space-y-3">
                  {customer.openInvoices.map((invoice) => (
                    <div key={invoice.id} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{invoice.quantity} {invoice.leadType}</div>
                          <div className="text-sm text-gray-600">{invoice.industry}</div>
                          <div className="text-lg font-bold text-orange-600">{invoice.amount}</div>
                          <div className="text-xs text-gray-500">
                            Aangemaakt: {new Date(invoice.createdAt).toLocaleString('nl-NL')}
                          </div>
                          {invoice.lastReminderSent && (
                            <div className="text-xs text-gray-500">
                              Laatste reminder: {new Date(invoice.lastReminderSent).toLocaleString('nl-NL')}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {invoice.status}
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {invoice.reminderCount} reminder{invoice.reminderCount !== 1 ? 's' : ''}
                          </div>
                          <div className="mt-2">
                            <button className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded transition-colors">
                              💌 Verstuur reminder
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Klant Notities</h3>
              <div className="space-y-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Voeg notities toe over deze klant..."
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple resize-none"
                />
                <button className="bg-brand-purple hover:bg-brand-purple/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  💾 Notitie opslaan
                </button>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-900 mb-2">Eerdere notities:</h4>
                <p className="text-gray-500 text-sm">Nog geen notities toegevoegd</p>
              </div>
            </div>
          )}

          {activeTab === 'account' && customer.hasAccount && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-brand-purple/10 to-brand-pink/10 rounded-xl p-6 border border-brand-purple/20">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-2xl">👤</span>
                  Account Beheer
                </h3>
                
                <div className="space-y-4">
                  {/* Account Status */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                    <div>
                      <p className="font-medium text-gray-900">Account Status</p>
                      <p className="text-sm text-gray-500">Activeer of deactiveer toegang tot het leadportaal</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        customer.hasAccount ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {customer.hasAccount ? '✅ Actief' : '⏸️ Inactief'}
                      </span>
                      <button
                        onClick={async () => {
                          if (isProcessing) return;
                          setIsProcessing(true);
                          
                          const action = customer.hasAccount ? 'deactivate' : 'activate';
                          const confirmed = confirm(`Weet je zeker dat je dit account wilt ${action === 'activate' ? 'activeren' : 'deactiveren'}?`);
                          
                          if (confirmed) {
                            try {
                              const response = await fetch('/api/auth/manage-account', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action,
                                  email: customer.email,
                                  adminEmail: getFirstAdminEmail()
                                })
                              });

                              const result = await response.json();
                              
                              if (result.success) {
                                alert(`✅ ${result.message}`);
                                onRefresh();
                                onClose();
                              } else {
                                alert(`❌ ${result.message || 'Er ging iets mis'}`);
                              }
                            } catch (error) {
                              console.error('Error managing account:', error);
                              alert('❌ Fout bij het beheren van account');
                            }
                          }
                          
                          setIsProcessing(false);
                        }}
                        disabled={isProcessing}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                          customer.hasAccount
                            ? 'bg-orange-500 hover:bg-orange-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isProcessing ? '⏳ Bezig...' : customer.hasAccount ? '⏸️ Deactiveren' : '✅ Activeren'}
                      </button>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-3">Account Informatie</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Email:</span>
                        <span className="font-medium text-gray-900">{customer.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Account aangemaakt:</span>
                        <span className="font-medium text-gray-900">
                          {customer.accountCreatedAt ? new Date(customer.accountCreatedAt).toLocaleDateString('nl-NL') : 'Onbekend'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Laatste activiteit:</span>
                        <span className="font-medium text-gray-900">
                          {new Date(customer.lastActivity).toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Leads:</span>
                        <span className="font-medium text-gray-900">{customer.leadData?.length || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
                    <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                      <span>⚠️</span>
                      Danger Zone
                    </h4>
                    <p className="text-sm text-red-700 mb-4">
                      Het verwijderen van een account is permanent en kan niet ongedaan worden gemaakt. 
                      Alle gegevens, leads, en toegang worden volledig verwijderd.
                    </p>
                    <button
                      onClick={async () => {
                        if (isProcessing) return;
                        
                        const confirmed = confirm(
                          `⚠️ WAARSCHUWING!\n\nWeet je ZEKER dat je het account van ${customer.email} wilt verwijderen?\n\nDit verwijdert:\n- Account toegang\n- Alle opgeslagen data\n- Lead geschiedenis\n\nDeze actie kan NIET ongedaan worden gemaakt!`
                        );
                        
                        if (confirmed) {
                          const doubleConfirm = confirm(
                            `Laatste bevestiging!\n\nTyp "VERWIJDEREN" in de volgende prompt om door te gaan.`
                          );
                          
                          if (doubleConfirm) {
                            const finalConfirm = prompt('Typ "VERWIJDEREN" om door te gaan:');
                            
                            if (finalConfirm === 'VERWIJDEREN') {
                              setIsProcessing(true);
                              
                              let deletedFromBlob = false;
                              let deletedFromLocalStorage = false;
                              
                              try {
                                // First try to delete from Blob Storage
                                const response = await fetch('/api/auth/manage-account', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    action: 'delete',
                                    email: customer.email,
                                    adminEmail: getFirstAdminEmail()
                                  })
                                });

                                const result = await response.json();
                                
                                if (result.success) {
                                  console.log(`✅ Deleted from Blob Storage: ${customer.email}`);
                                  deletedFromBlob = true;
                                } else {
                                  console.warn(`⚠️ Not in Blob Storage: ${customer.email}`);
                                }
                              } catch (error) {
                                console.error('Error deleting from Blob Storage:', error);
                              }
                              
                              // Also try to delete from localStorage CRM
                              try {
                                const crmData = localStorage.getItem('warmeleads_crm_data');
                                if (crmData) {
                                  const crm = JSON.parse(crmData);
                                  if (crm.customers && Array.isArray(crm.customers)) {
                                    const originalLength = crm.customers.length;
                                    crm.customers = crm.customers.filter((c: any) => c.email !== customer.email);
                                    
                                    if (crm.customers.length < originalLength) {
                                      localStorage.setItem('warmeleads_crm_data', JSON.stringify(crm));
                                      console.log(`✅ Deleted from localStorage CRM: ${customer.email}`);
                                      deletedFromLocalStorage = true;
                                    }
                                  }
                                }
                              } catch (error) {
                                console.error('Error deleting from localStorage:', error);
                              }
                              
                              setIsProcessing(false);
                              
                              // Show appropriate message
                              if (deletedFromBlob || deletedFromLocalStorage) {
                                let message = '✅ Account succesvol verwijderd!\n\n';
                                if (deletedFromBlob) message += '• Verwijderd uit Blob Storage (cross-device)\n';
                                if (deletedFromLocalStorage) message += '• Verwijderd uit localStorage (dit apparaat)\n';
                                alert(message);
                                onRefresh();
                                onClose();
                              } else {
                                alert(`❌ Account niet gevonden in Blob Storage of localStorage.\n\nDeze klant staat mogelijk alleen in de CRM database.`);
                              }
                            } else {
                              alert('❌ Verwijderen geannuleerd');
                            }
                          }
                        }
                      }}
                      disabled={isProcessing}
                      className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isProcessing ? '⏳ Bezig met verwijderen...' : '🗑️ Account permanent verwijderen'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'lead' | 'customer' | 'open_invoices'>('all');

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('🔄 LOADING CUSTOMERS - START');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('Timestamp:', new Date().toISOString());
        console.log('URL:', window.location.href);
        console.log('');
        
        // Fetch customers via secure API route (uses SERVICE_ROLE)
        console.log('📡 Step 1: Fetching customers from /api/admin/customers...');
        console.log('   Request URL:', '/api/admin/customers');
        
        const customersResponse = await fetch('/api/admin/customers');
        
        console.log('   Response Status:', customersResponse.status);
        console.log('   Response OK:', customersResponse.ok);
        console.log('   Response Headers:', {
          'content-type': customersResponse.headers.get('content-type'),
          'content-length': customersResponse.headers.get('content-length')
        });
        
        const customersData = await customersResponse.json();
        
        console.log('📦 Step 2: Customers API Response:');
        console.log('   Success:', customersData.success);
        console.log('   Count:', customersData.count);
        console.log('   Customers array length:', customersData.customers?.length || 0);
        
        if (customersData.error) {
          console.error('   ❌ API Error:', customersData.error);
          console.error('   Error Code:', customersData.code);
          console.error('   Error Hint:', customersData.hint);
        }
        
        if (!customersData.success) {
          console.error('');
          console.error('❌❌❌ CUSTOMERS API FAILED ❌❌❌');
          console.error('Error:', customersData.error);
          console.error('Full response:', customersData);
          throw new Error(customersData.error);
        }
        
        const allCustomers: Customer[] = customersData.customers || [];
        
        console.log('');
        console.log('✅ Customers fetched successfully!');
        console.log('   Total customers:', allCustomers.length);
        
        if (allCustomers.length > 0) {
          console.log('');
          console.log('📋 Customer Details:');
          allCustomers.forEach((customer, index) => {
            console.log(`   ${index + 1}. ${customer.email}`);
            console.log(`      - Name: ${customer.name || 'N/A'}`);
            console.log(`      - Has Account: ${customer.hasAccount}`);
            console.log(`      - Google Sheet ID: ${customer.googleSheetId || 'NOT SET'}`);
            console.log(`      - Google Sheet URL: ${customer.googleSheetUrl ? customer.googleSheetUrl.substring(0, 60) + '...' : 'NOT SET'}`);
          });
        } else {
          console.log('');
          console.log('⚠️⚠️⚠️ WARNING: 0 CUSTOMERS RETURNED! ⚠️⚠️⚠️');
          console.log('This means the API returned successfully but with an empty array.');
          console.log('Possible causes:');
          console.log('  1. Supabase customers table is empty');
          console.log('  2. RLS policies are blocking the query');
          console.log('  3. Wrong Supabase instance/credentials');
        }
        
        // Fetch registered users via secure API route (uses SERVICE_ROLE)
        console.log('');
        console.log('📡 Step 3: Fetching users from /api/admin/users...');
        
        const usersResponse = await fetch('/api/admin/users');
        console.log('   Response Status:', usersResponse.status);
        console.log('   Response OK:', usersResponse.ok);
        
        const usersData = await usersResponse.json();
        console.log('📦 Step 4: Users API Response:');
        console.log('   Success:', usersData.success);
        console.log('   Users count:', usersData.count);
        console.log('   Users array length:', usersData.users?.length || 0);
        
        const registeredEmails = new Set<string>();
        
        if (usersData.success && usersData.users) {
          console.log('');
          console.log('✅ Users fetched successfully!');
          console.log('   Total users:', usersData.users.length);
          console.log('');
          console.log('📋 Registered User Emails:');
          usersData.users.forEach((user: any, index: number) => {
            console.log(`   ${index + 1}. ${user.email}`);
            if (user.email) {
              registeredEmails.add(user.email);
            }
          });
        } else {
          console.error('');
          console.error('❌ Failed to load users:', usersData.error);
        }
        
        console.log('');
        console.log('🔄 Step 5: Merging customer and user data...');
        console.log('   Customers from API:', allCustomers.length);
        console.log('   Registered users:', registeredEmails.size);
        
        // Merge: Sync account status for customers
        const syncedCustomers = allCustomers.map(customer => {
          const hasAccount = registeredEmails.has(customer.email);
          if (hasAccount && !customer.hasAccount) {
            // Customer has registered but CRM not updated yet
            console.log(`   🔄 Syncing account status for ${customer.email}`);
          }
          return {
            ...customer,
            hasAccount: hasAccount || customer.hasAccount
          };
        });
        
        console.log('');
        console.log('➕ Step 6: Adding users without CRM records...');
        
        // Add user accounts that don't have CRM customer records yet
        let addedCount = 0;
        registeredEmails.forEach(email => {
          const existsInCrm = syncedCustomers.some(c => c.email === email);
          if (!existsInCrm) {
            console.log(`   ➕ Adding registered user: ${email}`);
            addedCount++;
            syncedCustomers.push({
              id: `account-${email}`,
              email: email,
              name: email.split('@')[0],
              hasAccount: true,
              accountCreatedAt: new Date(),
              status: 'customer',
              createdAt: new Date(),
              lastActivity: new Date(),
              source: 'direct',
              leadData: [],
              orders: [],
              chatHistory: [],
              openInvoices: [],
              dataHistory: [],
              notes: [],
              tags: ['registered-account'],
              whatsappConfig: {
                enabled: false,
                phoneNumber: '',
                notificationTypes: []
              }
            } as Customer);
          }
        });
        
        console.log(`   Added ${addedCount} users as customers`);
        
        setCustomers(syncedCustomers);
        
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('✅ LOADING CUSTOMERS - COMPLETE');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('📊 Final Results:');
        console.log('   Total customers shown:', syncedCustomers.length);
        console.log('   Customers with accounts:', syncedCustomers.filter(c => c.hasAccount).length);
        console.log('   Customers with Google Sheets:', syncedCustomers.filter(c => c.googleSheetId || c.googleSheetUrl).length);
        console.log('   Registered emails:', registeredEmails.size);
        console.log('');
        console.log('📋 Customers with Google Sheets:');
        syncedCustomers
          .filter(c => c.googleSheetId || c.googleSheetUrl)
          .forEach(c => {
            console.log(`   ✓ ${c.email} → Sheet ID: ${c.googleSheetId?.substring(0, 20)}...`);
          });
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
        
      } catch (error) {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.error('💥💥💥 FATAL ERROR LOADING CUSTOMERS 💥💥💥');
        console.log('═══════════════════════════════════════════════════════════════');
        console.error('Error:', error);
        console.error('Error message:', (error as Error).message);
        console.error('Error stack:', (error as Error).stack);
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
      } finally {
        setIsLoading(false);
      }
    };

    loadCustomers();
    const interval = setInterval(loadCustomers, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredCustomers = customers.filter(customer => 
    customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Klanten</h1>
          <p className="text-gray-600 mt-1">
            {customers.length} totaal • {customers.filter(c => c.hasAccount).length} met account • {customers.filter(c => c.openInvoices.length > 0).length} met open facturen
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => {
              // Force reload to sync auth data
              window.location.reload();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            🔄 Sync accounts
          </button>
          
          <button
            onClick={() => {
              // Count localStorage accounts before clearing
              const authStore = localStorage.getItem('warmeleads-auth-store');
              const authUsers = localStorage.getItem('auth-users');
              const crmData = localStorage.getItem('warmeleads_crm_data');
              
              let accountCount = 0;
              let crmCustomerCount = 0;
              let detailsText = '';
              
              try {
                if (authStore) {
                  const data = JSON.parse(authStore);
                  if (data.state?.user) {
                    accountCount++;
                    detailsText += `\n- Auth store: ${data.state.user.email}`;
                  }
                }
                
                if (authUsers) {
                  const users = JSON.parse(authUsers);
                  if (Array.isArray(users)) {
                    accountCount += users.length;
                    users.forEach((u: any) => {
                      detailsText += `\n- Legacy auth: ${u.email}`;
                    });
                  }
                }
                
                if (crmData) {
                  const crm = JSON.parse(crmData);
                  if (crm.customers && Array.isArray(crm.customers)) {
                    crmCustomerCount = crm.customers.length;
                    detailsText += `\n- CRM klanten: ${crmCustomerCount} klant(en)`;
                  }
                }
              } catch (e) {
                console.error('Error counting accounts:', e);
              }
              
              const totalItems = accountCount + (crmCustomerCount > 0 ? 1 : 0); // CRM counts as 1 item
              
              if (totalItems === 0) {
                alert('ℹ️ Er zijn geen accounts of data in localStorage gevonden.');
                return;
              }
              
              const confirmed = confirm(
                `⚠️ WAARSCHUWING!\n\nJe staat op het punt om ALLE data uit localStorage te verwijderen.\n\n` +
                `Gevonden:${detailsText}\n\n` +
                `Totaal: ${accountCount} account(s) + ${crmCustomerCount} CRM klant(en)\n\n` +
                `Let op:\n` +
                `✓ Data wordt ALLEEN uit localStorage verwijderd\n` +
                `✓ Blob Storage blijft intact (cross-device data blijft bestaan)\n` +
                `✓ Je moet mogelijk opnieuw inloggen na deze actie\n\n` +
                `Weet je zeker dat je wilt doorgaan?`
              );
              
              if (!confirmed) {
                return;
              }
              
              // Double confirmation for safety
              const doubleConfirm = confirm(
                `Laatste bevestiging!\n\nType "WISSEN" in de volgende prompt om door te gaan.`
              );
              
              if (!doubleConfirm) {
                return;
              }
              
              const finalConfirm = prompt('Typ "WISSEN" om alle localStorage accounts te verwijderen:');
              
              if (finalConfirm === 'WISSEN') {
                // Clear all auth-related localStorage
                const keysToRemove = [
                  'warmeleads-auth-store',
                  'auth-users',
                  'warmeleads_crm_data',
                  'guest-customer-data'
                ];
                
                let removed = 0;
                keysToRemove.forEach(key => {
                  if (localStorage.getItem(key)) {
                    localStorage.removeItem(key);
                    removed++;
                    console.log(`🗑️ Removed from localStorage: ${key}`);
                  }
                });
                
                console.log(`✅ Cleared ${removed} localStorage items`);
                alert(
                  `✅ LocalStorage succesvol gewist!\n\n` +
                  `${removed} item(s) verwijderd uit localStorage\n` +
                  `${accountCount} account(s) verwijderd\n` +
                  `${crmCustomerCount} CRM klant(en) verwijderd\n\n` +
                  `⚠️ Blob Storage (cross-device) blijft intact\n\n` +
                  `De pagina wordt nu herladen...`
                );
                
                // Reload to reflect changes
                window.location.reload();
              } else {
                alert('❌ Actie geannuleerd - niets is verwijderd');
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            title="Verwijder alle accounts uit localStorage (Blob Storage blijft intact)"
          >
            🗑️ Clear localStorage
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Zoek klanten op naam, email of bedrijf..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
        />
      </motion.div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Klanten laden...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center py-12"
        >
          <UserGroupIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? 'Geen klanten gevonden' : 'Nog geen klanten'}
          </h3>
          <p className="text-gray-600">
            {searchTerm 
              ? 'Probeer een andere zoekterm.' 
              : 'Klanten verschijnen hier zodra ze contactgegevens invullen in de chat.'
            }
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Klant
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Google Sheet
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activiteit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr 
                    key={customer.id} 
                    onClick={() => setSelectedCustomer(customer)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-brand-purple to-brand-pink rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {customer.name?.charAt(0) || customer.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {customer.name || 'Naamloos'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {customer.email}
                          </div>
                          {customer.company && (
                            <div className="text-xs text-gray-400">
                              {customer.company}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {customer.phone && (
                          <div className="flex items-center text-sm text-gray-600">
                            <PhoneIcon className="w-4 h-4 mr-2" />
                            {customer.phone}
                          </div>
                        )}
                        <div className="flex items-center text-sm text-gray-600">
                          <EnvelopeIcon className="w-4 h-4 mr-2" />
                          {customer.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="space-y-1">
                         <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                           customer.status === 'customer' ? 'bg-green-100 text-green-800' :
                           customer.status === 'contacted' ? 'bg-blue-100 text-blue-800' :
                           customer.status === 'lead' ? 'bg-yellow-100 text-yellow-800' :
                           'bg-gray-100 text-gray-800'
                         }`}>
                           {customer.status === 'customer' ? '🎯 Klant' :
                            customer.status === 'contacted' ? '📞 Gecontacteerd' :
                            customer.status === 'lead' ? '🔥 Lead' : '💤 Inactief'}
                         </span>
                         
                         <div className="flex flex-wrap gap-1">
                           {customer.hasAccount ? (
                             <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                               👤 Account
                             </span>
                           ) : (
                             <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                               👤 Geen account
                             </span>
                           )}
                           
                           {customer.googleSheetId && (
                             <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                               📊 Sheet gekoppeld
                             </span>
                           )}
                           
                           {customer.openInvoices.length > 0 && (
                             <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                               📋 {customer.openInvoices.length} open factuur{customer.openInvoices.length !== 1 ? 'en' : ''}
                             </span>
                           )}
                         </div>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {customer.googleSheetId || customer.googleSheetUrl ? (
                          <>
                            <a
                              href={customer.googleSheetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                              title="Open Google Sheet"
                            >
                              📊 Gekoppeld
                            </a>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const currentUrl = customer.googleSheetUrl || '';
                                const sheetUrl = prompt(
                                  `Google Sheets URL wijzigen:\n\nHuidige URL:\n${currentUrl}\n\nVoer nieuwe URL in:`,
                                  currentUrl
                                );
                                
                                if (sheetUrl && sheetUrl.includes('docs.google.com/spreadsheets')) {
                                  try {
                                    console.log('📊 Wijzigen Google Sheet via Supabase...');
                                    const success = await crmSystem.linkGoogleSheet(customer.id, sheetUrl);
                                    
                                    if (success) {
                                      alert(`✅ Google Sheet bijgewerkt!`);
                                      window.location.reload();
                                    } else {
                                      alert('❌ Fout bij bijwerken Google Sheet');
                                    }
                                  } catch (error) {
                                    console.error('❌ Error:', error);
                                    alert('❌ Fout bij bijwerken Google Sheet');
                                  }
                                } else if (sheetUrl !== null && sheetUrl !== '') {
                                  alert('❌ Ongeldige Google Sheets URL');
                                }
                              }}
                              className="text-blue-600 hover:text-blue-800 transition-colors text-sm"
                              title="Sheet URL wijzigen"
                            >
                              ✏️
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const sheetUrl = prompt(
                                `Google Sheets URL koppelen aan ${customer.name || customer.email}:\n\nVoer URL in:\n(Bijv: https://docs.google.com/spreadsheets/d/1ABC.../edit)`
                              );
                              
                              if (sheetUrl && sheetUrl.includes('docs.google.com/spreadsheets')) {
                                try {
                                  console.log('📊 Koppelen Google Sheet via Supabase...');
                                  const success = await crmSystem.linkGoogleSheet(customer.id, sheetUrl);
                                  
                                  if (success) {
                                    alert(`✅ Google Sheet gekoppeld!`);
                                    window.location.reload();
                                  } else {
                                    alert('❌ Fout bij koppelen Google Sheet');
                                  }
                                } catch (error) {
                                  console.error('❌ Error:', error);
                                  alert('❌ Fout bij koppelen Google Sheet');
                                }
                              } else if (sheetUrl !== null && sheetUrl !== '') {
                                alert('❌ Ongeldige Google Sheets URL');
                              }
                            }}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            title="Google Sheet koppelen"
                          >
                            📊 Koppelen
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {new Date(customer.lastActivity).toLocaleDateString('nl-NL')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {customer.chatHistory.length} chat berichten
                      </div>
                      <div className="text-xs text-gray-500">
                        {customer.orders.length} bestellingen (€{customer.orders.reduce((sum, o) => sum + o.amount, 0).toFixed(2)})
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(customer);
                          }}
                          className="text-brand-purple hover:text-brand-pink transition-colors"
                          title="Bekijk details"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                        
                        {!customer.hasAccount && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Create account for customer
                              const confirmed = confirm(`Account aanmaken voor ${customer.name || customer.email}?`);
                              if (confirmed) {
                                // This would integrate with your auth system
                                alert('Account aanmaken functionaliteit - integratie met auth systeem nodig');
                              }
                            }}
                            className="text-purple-600 hover:text-purple-800 transition-colors"
                            title="Account aanmaken"
                          >
                            👤
                          </button>
                        )}
                        
                        <a
                          href={`mailto:${customer.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="Email versturen"
                        >
                          <EnvelopeIcon className="w-5 h-5" />
                        </a>
                        {customer.phone && (
                          <a
                            href={`tel:${customer.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-green-600 hover:text-green-800 transition-colors"
                            title="Bellen"
                          >
                            <PhoneIcon className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Customer Detail Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <CustomerDetailModal 
            customer={selectedCustomer} 
            onClose={() => setSelectedCustomer(null)}
            onRefresh={async () => {
              // Reload customers after account management action
              try {
                console.log('🔄 Refreshing customers after action...');
                
                // Fetch customers via API
                const customersResponse = await fetch('/api/admin/customers');
                const customersData = await customersResponse.json();
                
                if (!customersData.success) {
                  throw new Error(customersData.error);
                }
                
                const allCustomers: Customer[] = customersData.customers || [];
                
                // Fetch users via API
                const usersResponse = await fetch('/api/admin/users');
                const usersData = await usersResponse.json();
                
                const registeredEmails = new Set<string>();
                
                if (usersData.success && usersData.users) {
                  usersData.users.forEach((user: any) => {
                    if (user.email) {
                      registeredEmails.add(user.email);
                    }
                  });
                }
                
                // Sync account status
                const syncedCustomers = allCustomers.map(customer => {
                  const hasAccount = registeredEmails.has(customer.email);
                  return {
                    ...customer,
                    hasAccount: hasAccount || customer.hasAccount
                  };
                });
                
                // Add registered users without CRM records
                registeredEmails.forEach(email => {
                  const existsInCrm = syncedCustomers.some(c => c.email === email);
                  if (!existsInCrm) {
                    syncedCustomers.push({
                      id: `account-${email}`,
                      email: email,
                      name: email.split('@')[0],
                      hasAccount: true,
                      accountCreatedAt: new Date(),
                      status: 'customer',
                      createdAt: new Date(),
                      lastActivity: new Date(),
                      source: 'direct',
                      leadData: [],
                      orders: [],
                      chatHistory: [],
                      openInvoices: [],
                      dataHistory: [],
                      notes: [],
                      tags: ['registered-account'],
                      whatsappConfig: {
                        enabled: false,
                        phoneNumber: '',
                        notificationTypes: []
                      }
                    } as Customer);
                  }
                });
                
                setCustomers(syncedCustomers);
                console.log('✅ Customers refreshed successfully');
              } catch (error) {
                console.error('❌ Error refreshing customers:', error);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}