'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  UserIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  EnvelopeIcon,
  CurrencyEuroIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  MapPinIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  BellIcon
} from '@heroicons/react/24/outline';
import { useAuthStore, authenticatedFetch } from '@/lib/auth';
import { Loading } from '@/components/ui';
import { crmSystem, type Customer, type Lead } from '@/lib/crmSystem';
import { readCustomerLeads, GoogleSheetsService, addLeadToSheet } from '@/lib/googleSheetsAPI';
import { branchIntelligence, type Branch, type BranchIntelligence, type BranchAnalytics } from '@/lib/branchIntelligence';
import { PipelineBoard } from '@/components/PipelineBoard';
import { type CustomStage, PipelineStagesManager } from '@/lib/pipelineStages';

export default function CustomerLeadsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, init } = useAuthStore();
  
  // Initialize auth from localStorage on mount
  useEffect(() => {
    init();
  }, [init]);
  
  // Data loading will be handled by loadCustomerData function
  
  const [customerData, setCustomerData] = useState<Customer | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Lead['status']>('all');
  const [filterBranch, setFilterBranch] = useState<'all' | Branch>('all');
  const [branchAnalytics, setBranchAnalytics] = useState<BranchAnalytics[]>([]);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [leadReclamation, setLeadReclamation] = useState<{hasReclamation: boolean, reclamation?: any}>({ hasReclamation: false });
  
  // Custom pipeline stages
  const [customStages, setCustomStages] = useState<CustomStage[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage, setLeadsPerPage] = useState(10);
  
  // Mobile stats collapse state
  const [statsExpanded, setStatsExpanded] = useState(false);
  
  // Email notification preferences
  const [emailNotifications, setEmailNotifications] = useState({
    enabled: false,
    newLeads: true
  });
  
  // Debug logs state
  const [debugLogs, setDebugLogs] = useState<{timestamp: string, level: string, message: string, data?: any}[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Debug logger function
  const addDebugLog = useCallback((level: 'info' | 'success' | 'warning' | 'error', message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    const log = { timestamp, level, message, data };
    setDebugLogs(prev => [...prev, log]);
    
    // Also log to regular console with emoji
    const emoji = level === 'success' ? '✅' : level === 'error' ? '❌' : level === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${emoji} [${timestamp}] ${message}`, data || '');
  }, []);

  // Sync email notifications with customer data
  useEffect(() => {
    if (customerData?.emailNotifications) {
      setEmailNotifications({
        enabled: customerData.emailNotifications.enabled,
        newLeads: customerData.emailNotifications.newLeads
      });
    }
  }, [customerData]);
  
  // Load custom pipeline stages when customer changes
  useEffect(() => {
    if (customerData?.id || user?.email) {
      const customerId = customerData?.id || user?.email || 'unknown';
      const stagesManager = new PipelineStagesManager(customerId);
      const loadedStages = stagesManager.getStages();
      setCustomStages(loadedStages);
      console.log('Loaded custom stages:', loadedStages);
    }
  }, [customerData, user]);
  
  // Force refresh lead data when viewing
  const handleViewLead = async (lead: Lead) => {
    console.log('🔍 Opening lead details for:', lead.name);
    console.log('🔍 Lead branchData:', lead.branchData);
    
    // Force a fresh copy of the lead with all data
    const freshLead = leads.find(l => l.id === lead.id) || lead;
    console.log('🔍 Fresh lead branchData:', freshLead.branchData);
    
    setViewingLead(freshLead);
    
    // Check of er een reclamatie bestaat voor deze lead
    if (customerData && lead.sheetRowNumber) {
      try {
        const response = await fetch(`/api/reclaim-lead?customerId=${customerData.id}&sheetRowNumber=${lead.sheetRowNumber}`);
        const data = await response.json();
        setLeadReclamation(data);
        
        if (data.hasReclamation) {
          console.log('⚠️ Lead has existing reclamation:', data.reclamation);
        }
      } catch (error) {
        console.error('Error checking reclamation:', error);
        setLeadReclamation({ hasReclamation: false });
      }
    }
  };

  // Direct localStorage auth check - improved for mobile
  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (authLoading) return;
    
    const checkAuth = () => {
      try {
        // Check localStorage directly for auth data
        const authStore = localStorage.getItem('warmeleads-auth-store');
        const adminToken = localStorage.getItem('warmeleads_admin_token');
        
        // Auth check for CRM Leads page
        
        let hasValidAuth = false;
        
        // Check admin token
        if (adminToken === 'admin_authenticated') {
          hasValidAuth = true;
        }
        
        // Check auth store
        if (authStore) {
          try {
            const parsed = JSON.parse(authStore);
            if (parsed.state?.isAuthenticated && parsed.state?.user?.email) {
              hasValidAuth = true;
            }
          } catch (e) {
            // Error parsing auth store
          }
        }
        
        // Also check Zustand state directly (for mobile compatibility)
        if (isAuthenticated && user?.email) {
          hasValidAuth = true;
        }
        
        if (!hasValidAuth) {
          router.replace('/');
        } else {
          loadCustomerData();
        }
      } catch (error) {
        router.replace('/');
      }
    };
    
    checkAuth();
  }, [router, authLoading, isAuthenticated, user]);

  // Load customer data with Google Sheets sync
  const loadCustomerData = async () => {
    addDebugLog('info', '🔄 LOADING STARTED', { userEmail: user?.email, timestamp: new Date().toISOString() });
    setIsLoading(true);
    
    let customer: Customer | null = null;
    try {
      // CRITICAL: For employees, use ownerEmail to get the correct customer data
      // For owners, use their own email
      const customerId = user?.role === 'employee' && user?.ownerEmail ? user.ownerEmail : user?.email;
      
      if (!customerId) {
        addDebugLog('error', '❌ FATAL: No customerId found for lookup', { 
          userEmail: user?.email,
          userRole: user?.role,
          ownerEmail: user?.ownerEmail,
          user 
        });
        setIsLoading(false);
        return;
      }
      
      addDebugLog('info', '📦 STEP 1: Fetching from API with authentication', { 
        customerId, 
        userRole: user?.role,
        userEmail: user?.email,
        ownerEmail: user?.ownerEmail,
        endpoint: `/api/customer-data?customerId=${encodeURIComponent(customerId)}` 
      });
      const response = await authenticatedFetch(`/api/customer-data?customerId=${encodeURIComponent(customerId)}`);
      
      addDebugLog('info', `📦 Blob Storage API Response Status: ${response.status}`, { ok: response.ok, statusText: response.statusText });
      
      if (response.ok) {
        const data = await response.json();
        addDebugLog('info', '📦 Blob Storage API Response Data', { 
          hasSuccess: !!data.success, 
          hasCustomerData: !!data.customerData,
          hasCustomer: !!data.customer,
          dataKeys: Object.keys(data)
        });
        
        // Log the actual customer data to see what's inside
        if (data.customerData) {
          addDebugLog('info', '📦 RAW customerData from Blob Storage', {
            customerDataKeys: Object.keys(data.customerData),
            id: data.customerData.id,
            email: data.customerData.email,
            googleSheetUrl: data.customerData.googleSheetUrl,
            hasLeadData: !!data.customerData.leadData,
            leadDataLength: data.customerData.leadData?.length,
            leadDataType: typeof data.customerData.leadData,
            isArray: Array.isArray(data.customerData.leadData),
            fullCustomerDataSample: {
              id: data.customerData.id,
              email: data.customerData.email,
              name: data.customerData.name,
              googleSheetUrl: data.customerData.googleSheetUrl
            }
          });
        }
        
        // Handle different response structures
        if (data.success && data.customerData) {
          const rawCustomerData = data.customerData;
          
          // Check if we have Google Sheets URL but no full customer data (only WhatsApp config)
          if (rawCustomerData.googleSheetUrl && !rawCustomerData.id && !rawCustomerData.email) {
            // We have Google Sheets URL but customer data is incomplete, create minimal customer
            addDebugLog('info', '📊 BLOB STORAGE: Found Google Sheets URL in incomplete customer data', {
              hasGoogleSheetUrl: !!rawCustomerData.googleSheetUrl,
              googleSheetUrl: rawCustomerData.googleSheetUrl?.substring(0, 50) + '...'
            });
            
            customer = {
              id: customerId,
              email: customerId,
              name: customerId.split('@')[0],
              createdAt: new Date(),
              lastActivity: new Date(),
              status: 'customer' as const,
              source: 'direct' as const,
              chatHistory: [],
              orders: [],
              openInvoices: [],
              dataHistory: [],
              hasAccount: true,
              googleSheetUrl: rawCustomerData.googleSheetUrl,
              leadData: []
            };
          } else if (!rawCustomerData.id && !rawCustomerData.email) {
            // No valid customer data at all
            addDebugLog('error', '❌ BLOB STORAGE: Customer data is empty/corrupt', { 
              customerData: rawCustomerData,
              hasId: !!rawCustomerData.id,
              hasEmail: !!rawCustomerData.email,
              hasGoogleSheetUrl: !!rawCustomerData.googleSheetUrl
            });
            customer = null; // Force fallback
          } else {
            // Valid customer data
            customer = rawCustomerData;
            addDebugLog('success', '✅ BLOB STORAGE: Customer loaded', { 
              customerId: customer?.id || 'unknown',
              leadsCount: customer?.leadData?.length || 0,
              googleSheetUrl: customer?.googleSheetUrl ? 'present' : 'missing',
              customerHasId: !!customer?.id,
              customerEmail: customer?.email
            });
          }
        } else if (data.customer) {
          customer = data.customer;
          addDebugLog('success', '✅ BLOB STORAGE: Customer loaded (legacy structure)', { 
            leadsCount: customer?.leadData?.length || 0 
          });
        } else {
          addDebugLog('warning', '⚠️ BLOB STORAGE: Unexpected response', { responseData: data });
        }
        
        // If still no valid customer, customer data might not be synced yet
        if (!customer) {
          addDebugLog('info', 'ℹ️ Customer not found in API, may be first-time user', {});
          
          // Create minimal customer object for first-time users
          customer = {
            id: customerId,
            email: customerId,
            name: customerId.split('@')[0],
            createdAt: new Date(),
            lastActivity: new Date(),
            status: 'customer' as const,
            source: 'direct' as const,
            chatHistory: [],
            orders: [],
            openInvoices: [],
            dataHistory: [],
            hasAccount: true,
            googleSheetUrl: undefined,
            googleSheetId: undefined,
            leadData: []
          };
          
          addDebugLog('info', '➕ Created minimal customer object', { email: customerId });
        }

        addDebugLog('info', '✅ Customer ready', {
          hasCustomer: !!customer,
          customerId: customer?.id,
          email: customer?.email,
          hasGoogleSheetUrl: !!customer?.googleSheetUrl,
          leadsCount: customer?.leadData?.length || 0
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        addDebugLog('error', `❌ BLOB STORAGE: API failed (${response.status})`, { status: response.status, errorData });
        
        // Fallback to localStorage if API fails or no data
        addDebugLog('info', '💾 Falling back to localStorage due to API failure', {});
        const allCustomers = await crmSystem.getAllCustomers();
        customer = allCustomers.find(c => c.email === user?.email) || null;
        addDebugLog('info', '💾 LOCAL STORAGE: Search result', { found: !!customer, totalCustomers: allCustomers.length });
      }

      if (!customer) {
        addDebugLog('warning', '⚠️ NO CUSTOMER: Creating fallback customer', { userEmail: user?.email });
        // Create a minimal fallback customer to prevent crashes
        customer = {
          id: user?.email || 'unknown',
          name: user?.name || 'Unknown User',
          email: user?.email || 'unknown@example.com',
          company: 'Unknown Company',
          phone: '',
          status: 'customer',
          googleSheetUrl: '',
          leadData: [],
          createdAt: new Date(),
          lastActivity: new Date(),
          source: 'direct',
          chatHistory: [],
          orders: [],
          openInvoices: [],
          dataHistory: [],
          hasAccount: true,
          accountCreatedAt: new Date(),
          emailNotifications: {
            enabled: true,
            newLeads: true
          }
        };
      }

      // 🔄 CRITICAL: Always sync with Google Sheets for fresh data
      if (customer.googleSheetUrl) {
        addDebugLog('info', '📊 STEP 2: Syncing with Google Sheets', { googleSheetUrl: customer.googleSheetUrl });
        try {
          const freshLeads = await readCustomerLeads(customer.googleSheetUrl);
          addDebugLog('success', `✅ GOOGLE SHEETS: Successfully read ${freshLeads.length} leads`, { 
            leadsCount: freshLeads.length,
            firstLeadName: freshLeads[0]?.name || 'none',
            sampleLead: freshLeads[0] ? { name: freshLeads[0].name, createdAt: freshLeads[0].createdAt, hasCreatedAt: !!freshLeads[0].createdAt } : null
          });
          
          // Update customer with fresh leads
          customer.leadData = freshLeads;
          addDebugLog('info', '📊 Updated customer.leadData with fresh Google Sheets data', { leadsCount: customer.leadData.length });
          
          // Update blob storage with fresh data
          try {
            addDebugLog('info', '💾 STEP 3: Updating Blob Storage with fresh data', {});
            await fetch('/api/customer-data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customerId: customer.email, // Use email as customerId for Blob Storage API
                customerData: customer
              })
            });
            addDebugLog('success', '✅ BLOB STORAGE: Successfully updated with Google Sheets data', {});
          } catch (blobError) {
            addDebugLog('error', '❌ BLOB STORAGE: Failed to update', { error: blobError });
          }
        } catch (syncError) {
          addDebugLog('error', '❌ GOOGLE SHEETS: Sync failed', { error: syncError, message: syncError instanceof Error ? syncError.message : 'Unknown error' });
          
          // Show user-friendly error message for API key issues
          if (syncError instanceof Error && syncError.message.includes('API key')) {
            addDebugLog('warning', '⚠️ GOOGLE SHEETS: API key issue detected', {});
          }
          
          // Continue with existing data if sync fails
          addDebugLog('info', '📊 Continuing with existing customer data', { existingLeadsCount: customer.leadData?.length || 0 });
        }
      } else {
        addDebugLog('info', '📊 No Google Sheet URL configured, skipping sync', {});
      }

      addDebugLog('info', '🎯 STEP 4: Setting customer data and leads state', { 
        customerId: customer.id,
        leadsCount: customer.leadData?.length || 0,
        hasLeadData: !!customer.leadData,
        leadDataType: Array.isArray(customer.leadData) ? 'array' : typeof customer.leadData
      });

      setCustomerData(customer);
      setLeads(customer.leadData || []);
      addDebugLog('success', '✅ STATE UPDATED: setCustomerData and setLeads called', { leadsSet: customer.leadData?.length || 0 });
      
      // Generate branch analytics
      if (customer.leadData && customer.leadData.length > 0) {
        const analytics = branchIntelligence.analyzeBranchPerformance(customer.leadData);
        setBranchAnalytics(analytics);
        addDebugLog('info', '📊 Branch analytics generated', { analyticsCount: analytics.length });
      } else {
        addDebugLog('info', '📊 No leads for branch analytics', { leadsCount: customer.leadData?.length || 0 });
      }
      
      setIsLoading(false);
      addDebugLog('success', '✅ LOADING COMPLETE: All data loaded successfully', { 
        finalLeadsCount: customer.leadData?.length || 0,
        isLoading: false
      });
    } catch (error) {
      addDebugLog('error', '❌ FATAL ERROR in loadCustomerData', { error, message: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined });
      setIsLoading(false);
    }
  };

  // Load user preferences
  const loadUserPreferences = async () => {
    if (!customerData?.id) return;
    
    try {
      const response = await fetch(`/api/user-preferences?customerId=${customerData.id}`);
      if (response.ok) {
        const { preferences } = await response.json();
        setViewMode(preferences.viewMode || 'list');
        console.log('✅ User preferences loaded:', preferences);
      }
    } catch (error) {
      console.error('❌ Error loading user preferences:', error);
    } finally {
      setPreferencesLoaded(true);
    }
  };

  // Save user preferences
  const saveUserPreferences = async (newViewMode: 'list' | 'pipeline') => {
    if (!customerData?.id) return;
    
    try {
      const preferences = {
        viewMode: newViewMode,
        theme: 'dark',
        notifications: true
      };
      
      const response = await fetch('/api/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerData.email, // Use email as customerId
          preferences
        })
      });
      
      if (response.ok) {
        console.log('✅ User preferences saved:', preferences);
      }
    } catch (error) {
      console.error('❌ Error saving user preferences:', error);
    }
  };

  // Load data on mount
  useEffect(() => {
    if (user?.email && isAuthenticated) {
      loadCustomerData();
    }
  }, [user?.email, isAuthenticated]);

  // Load preferences when customer data is available
  useEffect(() => {
    if (customerData?.id && !preferencesLoaded) {
      loadUserPreferences();
    }
  }, [customerData?.id, preferencesLoaded]);


  // Auto smart sync when customer data is loaded - simplified approach
  useEffect(() => {
    if (customerData?.googleSheetUrl && !isLoading) {
      console.log('🔄 Auto smart sync triggered');
      
      // Smart sync - only add new leads, preserve existing ones
      const smartSync = async () => {
        try {
          console.log('🔄 Smart sync: checking for new leads...');
          
          // Read current data from Google Sheets
          const sheetLeads = await readCustomerLeads(customerData.googleSheetUrl!);
          const existingLeads = customerData.leadData || [];
          
          // Find new leads by comparing sheet row numbers
          const existingRowNumbers = new Set(existingLeads.map(lead => lead.sheetRowNumber));
          const newLeads = sheetLeads.filter(sheetLead => 
            sheetLead.sheetRowNumber && !existingRowNumbers.has(sheetLead.sheetRowNumber)
          );
          
          // Find deleted leads (leads that exist in CRM but not in sheet)
          const sheetRowNumbers = new Set(sheetLeads.map(sheetLead => sheetLead.sheetRowNumber));
          const deletedLeads = existingLeads.filter(existingLead => 
            existingLead.sheetRowNumber && !sheetRowNumbers.has(existingLead.sheetRowNumber)
          );
          
          console.log(`🆕 Found ${newLeads.length} new leads to add`);
          console.log(`🗑️ Found ${deletedLeads.length} leads to remove`);
          
          let hasChanges = false;
          
          // Add new leads
          if (newLeads.length > 0) {
            const addedLeads: Lead[] = [];
            for (const leadData of newLeads) {
              const leadToAdd: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> = {
                name: leadData.name,
                email: leadData.email,
                phone: leadData.phone,
                company: leadData.company,
                address: leadData.address,
                city: leadData.city,
                interest: leadData.interest,
                budget: leadData.budget,
                timeline: leadData.timeline,
                notes: leadData.notes,
                status: leadData.status,
                assignedTo: leadData.assignedTo,
                source: 'import',
                sheetRowNumber: leadData.sheetRowNumber,
                branchData: leadData.branchData
              };
              
              const addedLead = await crmSystem.addLeadToCustomer(customerData.id, leadToAdd);
              if (addedLead) {
                addedLeads.push(addedLead);
                console.log(`✅ Added new lead: ${leadData.name}`);
                hasChanges = true;
              }
            }
            
            // Directly update the leads state to add new leads immediately
            if (addedLeads.length > 0) {
              setLeads(prevLeads => {
                // Filter out any existing leads with the same sheetRowNumber to prevent duplicates
                const existingRowNumbers = new Set(prevLeads.map(lead => lead.sheetRowNumber));
                const uniqueNewLeads = addedLeads.filter(lead => !existingRowNumbers.has(lead.sheetRowNumber));
                return [...prevLeads, ...uniqueNewLeads];
              });
            }
          }
          
          // Remove deleted leads
          if (deletedLeads.length > 0) {
            for (const deletedLead of deletedLeads) {
              const success = await crmSystem.removeLeadFromCustomer(customerData.id, deletedLead.id);
              if (success) {
                console.log(`🗑️ Removed deleted lead: ${deletedLead.name}`);
                hasChanges = true;
                
                // Directly update the leads state to remove the deleted lead immediately
                setLeads(prevLeads => prevLeads.filter(lead => lead.id !== deletedLead.id));
              }
            }
          }
          
          // Update customer data if there were changes (but don't update leads state again)
          if (hasChanges) {
            const updatedCustomer = await crmSystem.getCustomerById(customerData.id);
            if (updatedCustomer) {
              setCustomerData(updatedCustomer);
            }
            
            console.log(`✅ Smart sync complete: ${newLeads.length} new leads added, ${deletedLeads.length} leads removed`);
          } else {
            console.log(`✅ Smart sync complete: no changes detected`);
          }
          
        } catch (error) {
          console.error('Smart sync error:', error);
        }
      };
      
      smartSync();
    }
  }, [customerData?.googleSheetUrl, isLoading]);

  // Filter, sort and paginate leads
  const { filteredLeads, totalPages, paginatedLeads } = useMemo(() => {
    // Filter leads with branch intelligence
    const filtered = leads.filter(lead => {
      const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.interest.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterStatus === 'all' || lead.status === filterStatus;
      
      const matchesBranch = filterBranch === 'all' || (() => {
        const intelligence = branchIntelligence.detectBranch(lead);
        return intelligence.detectedBranch === filterBranch;
      })();
      
      return matchesSearch && matchesFilter && matchesBranch;
    });
    
    // Sort by date (most recent first)
    const sorted = filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Most recent first
    });
    
    // Calculate pagination
    const total = Math.ceil(sorted.length / leadsPerPage);
    const startIndex = (currentPage - 1) * leadsPerPage;
    const endIndex = startIndex + leadsPerPage;
    const paginated = sorted.slice(startIndex, endIndex);
    
    return {
      filteredLeads: sorted,
      totalPages: total,
      paginatedLeads: paginated
    };
  }, [leads, searchTerm, filterStatus, filterBranch, currentPage, leadsPerPage]);

  // Calculate statistics based on filtered leads - include both converted and deal_closed
  const stats = {
    total: filteredLeads.length,
    new: filteredLeads.filter(l => l.status === 'new').length,
    contacted: filteredLeads.filter(l => l.status === 'contacted').length,
    qualified: filteredLeads.filter(l => l.status === 'qualified').length,
    // Converted includes both 'converted' and 'deal_closed' statuses
    converted: filteredLeads.filter(l => l.status === 'converted' || l.status === 'deal_closed').length,
    lost: leads.filter(l => l.status === 'lost').length,
    // Conversion rate based on both converted and deal_closed
    conversionRate: leads.length > 0 ? (leads.filter(l => l.status === 'converted' || l.status === 'deal_closed').length / leads.length * 100) : 0
  };

  const getStatusColor = (status: Lead['status']) => {
    // Check if status matches a custom stage
    const customStage = customStages.find(s => s.id === status);
    if (customStage) {
      // Convert bg-color-500 to bg-color-100 text-color-800 for lighter appearance
      const lightColor = customStage.color.replace('500', '100') + ' ' + customStage.color.replace('bg-', 'text-').replace('500', '800');
      return lightColor;
    }
    
    // Fallback for old statuses
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-purple-100 text-purple-800';
      case 'proposal': return 'bg-indigo-100 text-indigo-800';
      case 'negotiation': return 'bg-orange-100 text-orange-800';
      case 'converted': return 'bg-green-100 text-green-800';
      case 'deal_closed': return 'bg-emerald-100 text-emerald-800';
      case 'lost': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Lead['status']) => {
    // Check if status matches a custom stage
    const customStage = customStages.find(s => s.id === status);
    if (customStage) {
      return customStage.icon;
    }
    
    // Fallback for old statuses
    switch (status) {
      case 'new': return '🆕';
      case 'contacted': return '📞';
      case 'qualified': return '⭐';
      case 'proposal': return '📄';
      case 'negotiation': return '🤝';
      case 'converted': return '✅';
      case 'deal_closed': return '💰';
      case 'lost': return '❌';
      default: return '❓';
    }
  };

  // State for deal value modal
  const [showDealValueModal, setShowDealValueModal] = useState<{
    show: boolean;
    leadId: string;
    newStatus: Lead['status'];
  }>({ show: false, leadId: '', newStatus: 'new' });

  // Handle status update with Google Sheets sync
  const handleUpdateLeadStatus = async (leadId: string, newStatus: Lead['status']) => {
    console.log(`📝 Status update: ${leadId} -> ${newStatus}`);
    
    // Als status "deal gesloten" is, toon modal voor omzet en winst
    if (newStatus === 'deal_closed') {
      setShowDealValueModal({ show: true, leadId, newStatus });
      return; // Stop hier, modal zal de update afhandelen
    }
    
    if (!customerData) {
      console.error('❌ handleUpdateLeadStatus: No customerData available');
      return;
    }
    
    // Find the lead in current state
    const leadToUpdate = leads.find(l => l.id === leadId);
    if (!leadToUpdate) {
      console.error('❌ handleUpdateLeadStatus: Lead not found in state', { leadId });
      return;
    }
    
    // Create updated lead object
    const updatedLead = {
      ...leadToUpdate,
      status: newStatus,
      updatedAt: new Date()
    };
    
    // Update local state immediately for responsive UI
        setLeads(prev => prev.map(lead => 
      lead.id === leadId ? updatedLead : lead
    ));
    
    // Update in customerData
    const updatedCustomerData = {
      ...customerData,
      leadData: customerData.leadData?.map(lead => 
        lead.id === leadId ? updatedLead : lead
      ),
      lastActivity: new Date()
    };
    
    setCustomerData(updatedCustomerData);
    console.log('✅ Status update: Updated local state');
    
    // Sync to Blob Storage for cross-device persistence
    try {
      console.log('💾 Status update: Syncing to Blob Storage...');
      await fetch('/api/customer-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerData.email || customerData.id,
          customerData: updatedCustomerData
        })
      });
      console.log('✅ Status update: Synced to Blob Storage');
    } catch (error) {
      console.error('❌ Status update: Blob Storage sync failed:', error);
    }
    
    // Sync to Google Sheets if available (server-side with Service Account)
    if (customerData.googleSheetUrl && updatedLead.sheetRowNumber) {
      try {
        console.log('📊 Status update: Syncing to Google Sheets via Service Account...');
        const sheetResponse = await authenticatedFetch('/api/update-lead-in-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleSheetUrl: customerData.googleSheetUrl,
            lead: updatedLead
          })
        });
        
        if (!sheetResponse.ok) {
          const errorData = await sheetResponse.json();
          throw new Error(errorData.error || 'Failed to update Google Sheets');
        }
        
        console.log('✅ Status update: Synced to Google Sheets via Service Account');
      } catch (error) {
        console.error('❌ Status update: Google Sheets sync failed:', error);
      }
    } else {
      console.warn('⚠️ Status update: Cannot sync to Google Sheets', {
        hasSheetUrl: !!customerData.googleSheetUrl,
        hasRowNumber: !!updatedLead.sheetRowNumber
      });
    }
  };
  
  // Handle closing deal with omzet and profit
  const handleCloseDeal = async (leadId: string, newStatus: Lead['status'], dealValue?: number, profit?: number) => {
    console.log(`💰 Closing deal: ${leadId} -> ${newStatus}, omzet: €${dealValue}, winst: €${profit}`);
    
    if (!customerData) {
      console.error('❌ handleCloseDeal: No customerData available');
      return;
    }
    
    const updates: Partial<Lead> = {
      status: newStatus,
      updatedAt: new Date()
    };
    
    if (dealValue !== undefined) updates.dealValue = dealValue;
    if (profit !== undefined) updates.profit = profit;
    
    console.log('📋 handleCloseDeal: Updates prepared:', updates);
    
    // Find the lead in current state
    const leadToUpdate = leads.find(l => l.id === leadId);
    if (!leadToUpdate) {
      console.error('❌ handleCloseDeal: Lead not found in state', { leadId });
      return;
    }
    
    // Create updated lead object
    const updatedLead = {
      ...leadToUpdate,
      ...updates
    };
    
    // Update local state immediately
    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? updatedLead : lead
    ));
    
    // Update in customerData
    const updatedCustomerData = {
      ...customerData,
      leadData: customerData.leadData?.map(lead => 
        lead.id === leadId ? updatedLead : lead
      ),
      lastActivity: new Date()
    };
    
    setCustomerData(updatedCustomerData);
    console.log('✅ Deal closed: Updated local state');
    
    // Sync to Blob Storage
    try {
      await fetch('/api/customer-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerData.email || customerData.id,
          customerData: updatedCustomerData
        })
      });
      console.log('✅ Deal closed: Synced to Blob Storage');
    } catch (error) {
      console.error('❌ Deal closed: Blob Storage sync failed:', error);
    }
    
    // Sync to Google Sheets if available (using Service Account)
    if (customerData.googleSheetUrl && updatedLead.sheetRowNumber) {
      console.log('🔄 Deal closed: Attempting Google Sheets sync via Service Account...', {
        hasSheetUrl: !!customerData.googleSheetUrl,
        leadId,
        sheetRowNumber: updatedLead.sheetRowNumber,
        status: updatedLead.status,
        dealValue: updatedLead.dealValue,
        profit: updatedLead.profit
      });
      
      try {
        // Use server-side API route for proper Service Account authentication
        const sheetResponse = await authenticatedFetch('/api/update-lead-in-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleSheetUrl: customerData.googleSheetUrl,
            lead: updatedLead
          })
        });
        
        if (!sheetResponse.ok) {
          const errorData = await sheetResponse.json();
          throw new Error(errorData.error || 'Failed to update Google Sheets');
        }
        
        console.log('✅ Deal closed: Successfully synced to Google Sheets via Service Account');
      } catch (error) {
        console.error('❌ Deal closed: Google Sheets sync failed:', error);
      }
    } else {
      console.warn('⚠️ Deal closed: Cannot sync to Google Sheets', {
        hasSheetUrl: !!customerData.googleSheetUrl,
        hasRowNumber: !!updatedLead.sheetRowNumber
      });
    }
  };

  // General update function for pipeline drag & drop
  const handleUpdateLead = async (leadId: string, updates: Partial<Lead>) => {
    console.log(`🔄 Pipeline: Updating lead ${leadId} with:`, updates);
    
    if (customerData) {
      // CRITICAL: Always update local state first, regardless of crmSystem success
        const updatedLeads = leads.map(lead => 
          lead.id === leadId ? { ...lead, ...updates, updatedAt: new Date() } : lead
        );
        setLeads(updatedLeads);
        
      // Try to update crmSystem (might fail if lead not found in legacy storage)
      crmSystem.updateCustomerLead(customerData.id, leadId, updates);
          
          // CRITICAL: Save to Blob Storage for cross-device persistence
      // We need to construct an updated customer object with the new lead data
      const updatedCustomerData = {
        ...customerData,
        leadData: updatedLeads,
        lastActivity: new Date()
      };
      
      setCustomerData(updatedCustomerData);
      
          try {
            console.log('💾 Pipeline: Syncing lead update to Blob Storage...');
            const response = await authenticatedFetch('/api/customer-data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customerId: customerData.email, // Use email as customerId for Blob Storage API
            customerData: updatedCustomerData
              })
            });
            
            if (response.ok) {
              console.log(`✅ Pipeline: Lead ${leadId} synced to Blob Storage`);
            } else {
              console.error('❌ Pipeline: Failed to sync to Blob Storage:', await response.text());
            }
          } catch (error) {
            console.error('❌ Pipeline: Error syncing to Blob Storage:', error);
          }
          
      // CRITICAL: Also sync to Google Sheet if available (server-side with Service Account)
      const googleSheetUrl = customerData.googleSheetUrl;
      console.log('🔍 Google Sheet URL check:', { 
        hasUrl: !!googleSheetUrl
      });
      
      if (googleSheetUrl) {
        try {
          // Find the updated lead with sheetRowNumber
          const existingLead = updatedLeads.find(l => l.id === leadId);
          if (existingLead && existingLead.sheetRowNumber) {
            // Create complete lead object with all updates applied
            const completeUpdatedLead = { ...existingLead };
            
            console.log('📊 Syncing lead update to Google Sheet...');
            console.log('📊 Complete lead data:', completeUpdatedLead);
            
            // Use server-side API route for proper Service Account authentication
            const sheetResponse = await authenticatedFetch('/api/update-lead-in-sheet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                googleSheetUrl: googleSheetUrl,
                lead: completeUpdatedLead
              })
            });
            
            if (!sheetResponse.ok) {
              const errorData = await sheetResponse.json();
              throw new Error(errorData.error || 'Failed to update Google Sheets');
            }
            
            console.log(`✅ Lead ${leadId} synced to Google Sheet (row ${existingLead.sheetRowNumber})`);
          } else {
            console.warn(`⚠️ Cannot sync to Google Sheets: missing sheetRowNumber for lead ${leadId}`, {
              hasExistingLead: !!existingLead,
              sheetRowNumber: existingLead?.sheetRowNumber
            });
              }
            } catch (sheetError) {
          console.error('❌ Failed to sync to Google Sheet:', sheetError);
          // Don't throw - we still want the local update to succeed
            }
      } else {
        console.warn('⚠️ No Google Sheet URL found - skipping sheet sync');
        }
        
        console.log(`✅ Pipeline: Lead ${leadId} updated successfully`);
    }
  };

  const handleDeleteLead = async (lead: Lead) => {
    if (!confirm(`Weet je zeker dat je "${lead.name}" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`)) {
      return;
    }

    try {
      if (customerData) {
        const success = await crmSystem.removeLeadFromCustomer(customerData.id, lead.id);
        if (success) {
          // Direct update UI
          setLeads(prevLeads => prevLeads.filter(l => l.id !== lead.id));
          
          // Update customer data
          const updatedCustomer = await crmSystem.getCustomerById(customerData.id);
          if (updatedCustomer) {
            setCustomerData(updatedCustomer);
          }
          
          console.log(`🗑️ Lead "${lead.name}" succesvol verwijderd`);
        } else {
          alert('❌ Fout bij verwijderen van lead');
        }
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('❌ Fout bij verwijderen van lead');
    }
  };

  const handleSaveEmailNotifications = async () => {
    if (customerData) {
      // Update customer data with notification preferences
      const updatedCustomer = {
        ...customerData,
        emailNotifications: {
          enabled: emailNotifications.enabled,
          newLeads: emailNotifications.newLeads,
          lastNotificationSent: customerData.emailNotifications?.lastNotificationSent
        }
      };

      // Save to CRM system (localStorage)
      crmSystem.updateCustomer(customerData.id, {
        emailNotifications: updatedCustomer.emailNotifications
      });

      // Save to Blob Storage voor server-side toegang (cron job)
      try {
        console.log('💾 Saving customer data to Blob Storage...');
        const response = await fetch('/api/customer-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customerData.email, // Use email as customerId for Blob Storage API
            customerData: updatedCustomer
          })
        });

        if (response.ok) {
          console.log('✅ Customer data saved to Blob Storage');
        } else {
          console.error('❌ Failed to save to Blob Storage');
        }
      } catch (error) {
        console.error('❌ Error saving to Blob Storage:', error);
      }

      setCustomerData(updatedCustomer);
      console.log('✅ Email notification preferences saved:', emailNotifications);
      alert('✅ Email notificatie instellingen opgeslagen!');
    }
  };

  // Full sync (manual only)
  const syncWithGoogleSheets = async () => {
    if (!customerData?.googleSheetUrl) {
      alert('❌ Geen Google Sheets URL gekoppeld');
      return;
    }
    
    setIsLoading(true);
    try {
            console.log('🔄 Starting real Google Sheets sync...');
            
            // Extract spreadsheet ID from URL
            const spreadsheetId = GoogleSheetsService.extractSpreadsheetId(customerData.googleSheetUrl);
            if (!spreadsheetId) {
              throw new Error('Ongeldige Google Sheets URL');
            }

            // CRITICAL: Clear existing leads from CRM FIRST
            console.log('🗑️ Clearing existing leads from CRM...');
            customerData.leadData = [];
            
            // Also clear from localStorage to force refresh
            const crmData = JSON.parse(localStorage.getItem('warmeleads_crm_data') || '{}');
            if (crmData.customers) {
              const customerEntry = crmData.customers.find(([id]: [string, any]) => id === customerData.id);
              if (customerEntry) {
                customerEntry[1].leadData = [];
                localStorage.setItem('warmeleads_crm_data', JSON.stringify(crmData));
                console.log('🗑️ Cleared leads from localStorage');
              }
            }

            // Read actual data from Google Sheets
            const realLeads = await readCustomerLeads(customerData.googleSheetUrl);
            
            console.log('📊 Real leads loaded from Google Sheets:', realLeads.length);

      // Add each lead from the sheet to the customer
      for (const leadData of realLeads) {
        console.log(`🔧 Processing lead ${leadData.name} with branchData:`, leadData.branchData);
        
        const leadToAdd: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> = {
          name: leadData.name,
          email: leadData.email,
          phone: leadData.phone,
          company: leadData.company,
          address: leadData.address,
          city: leadData.city,
          interest: leadData.interest,
          budget: leadData.budget,
          timeline: leadData.timeline,
          notes: leadData.notes,
          status: leadData.status,
          assignedTo: leadData.assignedTo,
          source: 'import',
          sheetRowNumber: leadData.sheetRowNumber,
          branchData: leadData.branchData // CRITICAL: Include branchData!
        };
        
        console.log(`🔧 leadToAdd with branchData:`, leadToAdd.branchData);
        
        await crmSystem.addLeadToCustomer(customerData.id, leadToAdd);
      }

            // Refresh data
            const updatedCustomer = await crmSystem.getCustomerById(customerData.id);
            if (updatedCustomer) {
              setCustomerData(updatedCustomer);
              setLeads(updatedCustomer.leadData || []);
              
              // Debug: Check what's actually in the leads
              console.log('🔍 First 3 leads after sync:', updatedCustomer.leadData?.slice(0, 3).map(lead => ({
                name: lead.name,
                branchData: lead.branchData,
                notes: lead.notes,
                hasZonnepanelen: !!lead.branchData?.zonnepanelen,
                hasStroomverbruik: !!lead.branchData?.stroomverbruik,
                hasRedenThuisbatterij: !!lead.branchData?.redenThuisbatterij
              })));
              
              // Also check what's in the state
              console.log('🔍 State leads sample:', updatedCustomer.leadData?.slice(0, 2));
            }

            alert(`✅ ${realLeads.length} echte leads gesynchroniseerd met Google Sheets!`);
    } catch (error) {
      console.error('Sync error:', error);
      
      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          alert('❌ Google Sheets API key niet geconfigureerd. Neem contact op met support.');
        } else if (error.message.includes('permission') || error.message.includes('403')) {
          alert('❌ Geen toegang tot spreadsheet. Zorg dat de sheet publiek toegankelijk is of deel met onze service account.');
        } else if (error.message.includes('404')) {
          alert('❌ Spreadsheet niet gevonden. Controleer de URL.');
        } else {
          alert(`❌ Fout bij synchroniseren: ${error.message}`);
        }
      } else {
        alert('❌ Onbekende fout bij synchroniseren met Google Sheets');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while auth is loading
  if (authLoading) {
    return <Loading fullScreen text="Authenticatie controleren..." />;
  }

  // Don't render anything if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return <Loading fullScreen text="Leads laden..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* Header - Desktop & Mobile optimized */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/crm')}
                className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span>Terug naar CRM</span>
              </button>
              
              <div className="h-6 w-px bg-white/30"></div>
              
              <div>
                <h1 className="text-2xl font-bold text-white">Mijn Leads</h1>
                <p className="text-white/70">
                  {user?.name} • {leads.length} leads totaal
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* View Mode Switcher */}
              <div className="flex bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => {
                    setViewMode('pipeline');
                    saveUserPreferences('pipeline');
                  }}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    viewMode === 'pipeline'
                      ? 'bg-white/20 text-white' 
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Pipeline
                </button>
                <button
                  onClick={() => {
                    setViewMode('list');
                    saveUserPreferences('list');
                  }}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white/20 text-white' 
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Lijst
                </button>
              </div>

              {/* Settings button */}
              <button
                onClick={() => setShowSettings(true)}
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors"
                title="Instellingen"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Nieuwe lead</span>
              </button>
            </div>
          </div>

          {/* Mobile Header */}
          <div className="md:hidden py-4">
            {/* Top row: Back button & Settings */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => router.push('/crm')}
                className="flex items-center space-x-2 text-white/90 hover:text-white transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span className="text-sm">Terug naar CRM</span>
              </button>
              
              <button
                onClick={() => setShowSettings(true)}
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl transition-colors"
                title="Instellingen"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Bottom row: Title & Add button */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Mijn Leads</h1>
                <p className="text-sm text-white/70">
                  {user?.name}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {leads.length} leads totaal
                </p>
              </div>
              
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-white hover:bg-white/90 text-brand-purple px-4 py-3 rounded-xl flex items-center space-x-2 transition-colors shadow-lg"
              >
                <PlusIcon className="w-5 h-5" />
                <span className="font-semibold">Nieuwe lead</span>
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Main Content - Conditional container */}
      {viewMode === 'pipeline' ? (
        /* Pipeline view - Full width, no container */
        <div className="h-[calc(100vh-120px)]">
          <PipelineBoard 
            leads={filteredLeads}
            customerId={customerData?.email || user?.email || 'unknown'}
            onLeadUpdate={handleUpdateLead}
            onStagesChange={(stages) => {
              setCustomStages(stages);
              console.log('Pipeline stages updated:', stages);
            }}
          />
        </div>
      ) : (
        /* List view - Normal container */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
         {/* Statistics - Responsive Collapsible */}
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.4 }}
           className="mb-8"
         >
           {/* Mobile Collapsible Stats */}
           <div className="md:hidden">
             <motion.div
               className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden"
             >
               {/* Collapsed Header */}
               <div 
                 className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                 onClick={() => setStatsExpanded(!statsExpanded)}
               >
                 <div className="flex items-center justify-between">
                   <div className="flex items-center space-x-3">
                     <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                       <ChartBarIcon className="w-6 h-6 text-white" />
                     </div>
                     <div>
                       <h3 className="text-lg font-bold text-gray-900">{stats.total} Leads</h3>
                       <p className="text-sm text-gray-600">{stats.new} nieuw • {stats.converted} geconverteerd</p>
                     </div>
                   </div>
                   <div className="flex items-center space-x-2">
                     <span className="text-xs text-purple-600 font-medium">
                       {statsExpanded ? 'Inklappen' : 'Uitklappen'}
                     </span>
                     <motion.div
                       animate={{ rotate: statsExpanded ? 180 : 0 }}
                       transition={{ duration: 0.2 }}
                     >
                       <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                       </svg>
                     </motion.div>
                   </div>
                 </div>
               </div>
               
               {/* Expanded Content */}
               <AnimatePresence>
                 {statsExpanded && (
                   <motion.div
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     transition={{ duration: 0.3 }}
                     className="border-t border-gray-100"
                   >
                     <div className="p-4 grid grid-cols-2 gap-4">
                       <div className="text-center p-3 bg-yellow-50 rounded-xl">
                         <div className="text-2xl font-bold text-yellow-600">{stats.contacted}</div>
                         <div className="text-xs text-gray-600 mt-1">📞 Gecontacteerd</div>
                       </div>
                       <div className="text-center p-3 bg-green-50 rounded-xl">
                         <div className="text-2xl font-bold text-green-600">{stats.converted}</div>
                         <div className="text-xs text-gray-600 mt-1">✅ Geconverteerd</div>
                       </div>
                       <div className="text-center p-3 bg-purple-50 rounded-xl">
                         <div className="text-2xl font-bold text-purple-600">{stats.conversionRate.toFixed(1)}%</div>
                         <div className="text-xs text-gray-600 mt-1">📊 Conversie</div>
                       </div>
                       <div className="text-center p-3 bg-red-50 rounded-xl">
                         <div className="text-2xl font-bold text-red-600">{filteredLeads.filter(l => l.status === 'lost').length}</div>
                         <div className="text-xs text-gray-600 mt-1">❌ Verloren</div>
                       </div>
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
             </motion.div>
           </div>

           {/* Desktop Full Stats */}
           <div className="hidden md:grid grid-cols-5 gap-6">
             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
             >
               <div className="flex items-center justify-between">
                 <div>
                   <p className="text-sm font-medium text-gray-600">Totaal Leads</p>
                   <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                 </div>
                 <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                   <UserIcon className="w-6 h-6 text-blue-600" />
                 </div>
               </div>
             </motion.div>

             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.1 }}
               className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
             >
               <div className="flex items-center justify-between">
                 <div>
                   <p className="text-sm font-medium text-gray-600">Nieuwe</p>
                   <p className="text-3xl font-bold text-blue-600">{stats.new}</p>
                 </div>
                 <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                   <span className="text-xl">🆕</span>
                 </div>
               </div>
             </motion.div>

             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.2 }}
               className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
             >
               <div className="flex items-center justify-between">
                 <div>
                   <p className="text-sm font-medium text-gray-600">Gecontacteerd</p>
                   <p className="text-3xl font-bold text-yellow-600">{stats.contacted}</p>
                 </div>
                 <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                   <span className="text-xl">📞</span>
                 </div>
               </div>
             </motion.div>

             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.3 }}
               className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
             >
               <div className="flex items-center justify-between">
                 <div>
                   <p className="text-sm font-medium text-gray-600">Geconverteerd</p>
                   <p className="text-3xl font-bold text-green-600">{stats.converted}</p>
                 </div>
                 <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                   <span className="text-xl">✅</span>
                 </div>
               </div>
             </motion.div>

             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.4 }}
               className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
             >
               <div className="flex items-center justify-between">
                 <div>
                   <p className="text-sm font-medium text-gray-600">Conversie</p>
                   <p className="text-3xl font-bold text-purple-600">{stats.conversionRate.toFixed(1)}%</p>
                 </div>
                 <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                   <ChartBarIcon className="w-6 h-6 text-purple-600" />
                 </div>
               </div>
             </motion.div>
           </div>
         </motion.div>

        {/* Google Sheets card completely hidden per user request */}

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Zoek leads op naam, email, bedrijf of interesse..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              />
            </div>
            
            {/* Status Filter - Shows custom pipeline stages */}
            <div className="relative">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-purple focus:border-brand-purple bg-white appearance-none cursor-pointer"
              >
                <option value="all">Alle statussen</option>
                {customStages.map(stage => (
                  <option key={stage.id} value={stage.id}>
                    {stage.icon} {stage.name}
                  </option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Branch Filter */}
            <div className="relative">
              <ChartBarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value as any)}
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-purple focus:border-brand-purple bg-white appearance-none cursor-pointer"
              >
                <option value="all">Alle branches</option>
                <option value="Thuisbatterijen">🔋 Thuisbatterijen</option>
                <option value="Financial Lease">🚗 Financial Lease</option>
                <option value="Warmtepompen">🔥 Warmtepompen</option>
                <option value="Zonnepanelen">☀️ Zonnepanelen</option>
                <option value="Airco">❄️ Airco</option>
                <option value="Custom">🎯 Multi-Branch</option>
                <option value="Unknown">❓ Overige</option>
              </select>
              <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Analytics moved to /crm - this section removed for clean leads interface */}
        {false && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-6 mb-8 shadow-xl text-white"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">🧠 Branch Intelligence Dashboard</h2>
                <p className="text-white/80">AI-powered insights per branche - Better dan Salesforce!</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{branchAnalytics.length}</div>
                <div className="text-white/80 text-sm">Actieve branches</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(branchAnalytics.length > 0 ? branchAnalytics.slice(0, 4) : [
                { branch: 'Thuisbatterijen', totalLeads: 12, revenue: 54000, conversionRate: 28.5, avgLeadValue: 4500, trends: { growth: 15 }, topPerformingFactors: ['Zonnepanelen eigenaar', 'Dynamisch contract', 'Hoog verbruik'] },
                { branch: 'Financial Lease', totalLeads: 8, revenue: 360000, conversionRate: 37.5, avgLeadValue: 45000, trends: { growth: 22 }, topPerformingFactors: ['Bedrijfsomvang 10+', 'Krediet score A', 'Lease expertise'] },
                { branch: 'Warmtepompen', totalLeads: 15, revenue: 172500, conversionRate: 33.3, avgLeadValue: 11500, trends: { growth: 8 }, topPerformingFactors: ['Goede isolatie', 'CV vervangen', 'Energie besparing'] },
                { branch: 'Zonnepanelen', totalLeads: 6, revenue: 48000, conversionRate: 25.0, avgLeadValue: 8000, trends: { growth: 5 }, topPerformingFactors: ['Dak geschikt', 'Minimaal schaduw', 'Stijgende energieprijzen'] }
              ]).map((analytics, index) => (
                <motion.div
                  key={analytics.branch}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">
                      {analytics.branch === 'Thuisbatterijen' && '🔋'}
                      {analytics.branch === 'Financial Lease' && '🚗'}
                      {analytics.branch === 'Warmtepompen' && '🔥'}
                      {analytics.branch === 'Zonnepanelen' && '☀️'}
                      {analytics.branch === 'Airco' && '❄️'}
                      {analytics.branch === 'Custom' && '🎯'}
                      {analytics.branch === 'Unknown' && '❓'}
                      {' '}{analytics.branch}
                    </h3>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                      {analytics.conversionRate.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/70">Leads:</span>
                      <span className="font-semibold">{analytics.totalLeads}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/70">Revenue:</span>
                      <span className="font-semibold">€{Math.round(analytics.revenue / 1000)}K</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/70">Growth:</span>
                      <span className={`font-semibold ${analytics.trends.growth > 0 ? 'text-green-300' : analytics.trends.growth < 0 ? 'text-red-300' : 'text-white/70'}`}>
                        {analytics.trends.growth > 0 ? '+' : ''}{analytics.trends.growth}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/70">AVG Lead:</span>
                      <span className="font-semibold">€{Math.round(analytics.avgLeadValue)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Top Performing Factors */}
            <div className="mt-6 pt-6 border-t border-white/20">
              <h3 className="text-lg font-semibold mb-4">🎯 Top Performing Factors</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {branchAnalytics.map((analytics, index) => (
                  <div key={analytics.branch} className="bg-white/5 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2">
                      {analytics.branch === 'Thuisbatterijen' && '🔋'}
                      {analytics.branch === 'Financial Lease' && '🚗'}
                      {analytics.branch === 'Warmtepompen' && '🔥'}
                      {analytics.branch === 'Zonnepanelen' && '☀️'}
                      {analytics.branch === 'Airco' && '❄️'}
                      {analytics.branch === 'Custom' && '🎯'}
                      {analytics.branch === 'Unknown' && '❓'}
                      {' '}{analytics.branch}
                    </h4>
                    <div className="text-xs text-white/70">
                      {analytics.topPerformingFactors.slice(0, 3).map((factor, i) => (
                        <div key={i} className="py-1">• {factor}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

          {/* Leads Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden"
          >
          {paginatedLeads.length === 0 ? (
            <div className="text-center py-16">
              <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchTerm || filterStatus !== 'all' ? 'Geen leads gevonden' : 'Nog geen leads'}
              </h3>
              <p className="text-gray-600 mb-6">
                {customerData?.googleSheetUrl 
                  ? 'Synchroniseer met Google Sheets om uw leads te importeren.'
                  : 'Uw leads verschijnen hier na aankoop en Google Sheets koppeling.'
                }
              </p>
              {customerData?.googleSheetUrl && (
                <button
                  onClick={syncWithGoogleSheets}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                >
                  🔄 Sync met Google Sheets
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View - Gebruiksvriendelijk */}
              <div className="md:hidden space-y-3 p-4">
                {paginatedLeads.map((lead) => (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-all"
                    onClick={() => handleViewLead(lead)}
                  >
                    {/* Header met Avatar en Naam */}
                    <div className="flex items-start mb-4">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                          <span className="text-white font-bold text-xl">
                            {lead.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 text-lg break-words pr-2">{lead.name}</h3>
                          {lead.company && (
                            <p className="text-sm text-gray-600 truncate">{lead.company}</p>
                          )}
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-gray-400">Rij {lead.sheetRowNumber}</span>
                            <span className="text-xs text-gray-300">•</span>
                            <span className="text-xs text-gray-400">{new Date(lead.createdAt).toLocaleDateString('nl-NL')}</span>
                          </div>
                          
                          {/* 🧠 AI Branch Detection Badge */}
                          {(() => {
                            const intelligence = branchIntelligence.detectBranch(lead);
                            const branchIcon = intelligence.detectedBranch === 'Thuisbatterijen' ? '🔋' :
                                             intelligence.detectedBranch === 'Financial Lease' ? '🚗' :
                                             intelligence.detectedBranch === 'Warmtepompen' ? '🔥' :
                                             intelligence.detectedBranch === 'Zonnepanelen' ? '☀️' :
                                             intelligence.detectedBranch === 'Airco' ? '❄️' :
                                             intelligence.detectedBranch === 'Custom' ? '🎯' : '❓';
                            
                            return (
                              <div className="mt-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  intelligence.detectedBranch === 'Thuisbatterijen' ? 'bg-yellow-100 text-yellow-800' :
                                  intelligence.detectedBranch === 'Financial Lease' ? 'bg-green-100 text-green-800' :
                                  intelligence.detectedBranch === 'Warmtepompen' ? 'bg-red-100 text-red-800' :
                                  intelligence.detectedBranch === 'Zonnepanelen' ? 'bg-orange-100 text-orange-800' :
                                  intelligence.detectedBranch === 'Airco' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {branchIcon} {intelligence.detectedBranch} ({intelligence.confidence}%)
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Quick Actions - Compacte bolletjes horizontaal */}
                    <div className="flex items-center space-x-2 mb-4">
                      {/* Bellen knop */}
                      <a
                        href={`tel:${lead.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-11 h-11 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors shadow-md"
                        title="Bellen"
                      >
                        <PhoneIcon className="w-5 h-5 text-white" />
                      </a>
                      
                      {/* WhatsApp knop */}
                      <a
                        href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=Hallo ${lead.name}, ik neem contact met je op via Warmeleads.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-11 h-11 bg-green-400 hover:bg-green-500 rounded-full flex items-center justify-center transition-colors shadow-md"
                        title="WhatsApp"
                      >
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                        </svg>
                      </a>
                      
                      {/* Email knop */}
                      <a
                        href={`mailto:${lead.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-11 h-11 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors shadow-md"
                        title="Email versturen"
                      >
                        <EnvelopeIcon className="w-5 h-5 text-white" />
                      </a>
                      
                      {/* Bewerken knop */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLead(lead);
                        }}
                        className="w-11 h-11 bg-purple-500 hover:bg-purple-600 rounded-full flex items-center justify-center transition-colors shadow-md"
                        title="Bewerken"
                      >
                        <PencilIcon className="w-5 h-5 text-white" />
                      </button>
                      
                      {/* Verwijderen knop */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLead(lead);
                        }}
                        className="w-11 h-11 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors shadow-md"
                        title="Verwijderen"
                      >
                        <TrashIcon className="w-5 h-5 text-white" />
                      </button>
                    </div>

                    {/* Contact Info - Compact */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm">
                        <EnvelopeIcon className="w-4 h-4 mr-3 text-blue-500 flex-shrink-0" />
                        <a 
                          href={`mailto:${lead.email}`} 
                          className="text-gray-700 hover:text-blue-600 truncate flex-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lead.email}
                        </a>
                      </div>
                      <div className="flex items-center text-sm">
                        <PhoneIcon className="w-4 h-4 mr-3 text-green-500 flex-shrink-0" />
                        <a 
                          href={`tel:${lead.phone}`} 
                          className="text-gray-700 hover:text-green-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lead.phone}
                        </a>
                      </div>
                      {lead.branchData?.postcode && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPinIcon className="w-4 h-4 mr-3 text-purple-500 flex-shrink-0" />
                          <span>{lead.branchData.postcode} {lead.branchData.huisnummer}</span>
                        </div>
                      )}
                    </div>

                    {/* Interest & Budget */}
                    <div className="mb-4">
                      <div className="font-medium text-gray-900 mb-2">{lead.interest}</div>
                      {lead.budget && (
                        <div className="flex items-center text-sm text-gray-600">
                          <CurrencyEuroIcon className="w-4 h-4 mr-2 text-yellow-500" />
                          {lead.budget}
                        </div>
                      )}
                    </div>

                    {/* Status Badge & Branch Info */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-2 flex-1">
                        {lead.branchData?.zonnepanelen && (
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                            🌞 {lead.branchData.zonnepanelen}
                          </span>
                        )}
                        {lead.branchData?.stroomverbruik && (
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                            ⚡ {lead.branchData.stroomverbruik}
                          </span>
                        )}
                        {lead.branchData?.koopintentie && (
                          <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                            🎯 {lead.branchData.koopintentie}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-400 text-right ml-2 flex-shrink-0">
                        Tik voor details →
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lead Info
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact & Locatie
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Interesse & Budget
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedLeads.map((lead) => (
                    <tr 
                      key={lead.id} 
                      className="hover:bg-gray-50 cursor-pointer" 
                      onClick={() => handleViewLead(lead)}
                      title="Klik voor lead details"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold">
                              {lead.name.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900">
                              {lead.name}
                            </div>
                            {lead.company && (
                              <div className="text-sm text-gray-600 flex items-center">
                                <BuildingOfficeIcon className="w-4 h-4 mr-1" />
                                {lead.company}
                              </div>
                            )}
                            {lead.sheetRowNumber && (
                              <div className="text-xs text-gray-400">
                                Sheet rij: {lead.sheetRowNumber}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center text-sm text-gray-600">
                            <EnvelopeIcon className="w-4 h-4 mr-2" />
                            <a href={`mailto:${lead.email}`} className="hover:text-brand-purple">
                              {lead.email}
                            </a>
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <PhoneIcon className="w-4 h-4 mr-2" />
                            <a href={`tel:${lead.phone}`} className="hover:text-brand-purple">
                              {lead.phone}
                            </a>
                          </div>
                          {lead.branchData?.postcode && lead.branchData?.huisnummer && (
                            <div className="flex items-center text-sm text-gray-600">
                              <MapPinIcon className="w-4 h-4 mr-2" />
                              {lead.branchData.postcode} {lead.branchData.huisnummer}
                            </div>
                          )}
                          {lead.branchData?.datumInteresse && (
                            <div className="text-xs text-gray-500">
                              Interesse: {lead.branchData.datumInteresse}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="font-medium text-gray-900">{lead.interest}</div>
                          {lead.budget && (
                            <div className="flex items-center text-sm text-gray-600">
                              <CurrencyEuroIcon className="w-4 h-4 mr-2" />
                              {lead.budget}
                            </div>
                          )}
                          
                          {/* Clean table view - branch details only in popup */}
                          <div className="text-xs text-gray-500 italic">
                            📋 Klik voor alle thuisbatterij details
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={lead.status}
                          onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as Lead['status'])}
                          onClick={(e) => e.stopPropagation()} // Prevent row click
                          className={`px-3 py-2 text-sm font-medium rounded-lg border-0 ${getStatusColor(lead.status)}`}
                        >
                          {customStages.map(stage => (
                            <option key={stage.id} value={stage.id}>
                              {stage.icon} {stage.name}
                            </option>
                          ))}
                        </select>
                        <div className="text-xs text-gray-500 mt-1">
                          Datum: {new Date(lead.createdAt).toLocaleDateString('nl-NL')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              setEditingLead(lead);
                            }}
                            className="text-blue-600 hover:text-blue-800 transition-colors p-2 hover:bg-blue-50 rounded-lg"
                            title="Bewerken"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <a
                            href={`mailto:${lead.email}`}
                            onClick={(e) => e.stopPropagation()} // Prevent row click
                            className="text-green-600 hover:text-green-800 transition-colors p-2 hover:bg-green-50 rounded-lg"
                            title="Email versturen"
                          >
                            <EnvelopeIcon className="w-4 h-4" />
                          </a>
                          <a
                            href={`tel:${lead.phone}`}
                            onClick={(e) => e.stopPropagation()} // Prevent row click
                            className="text-purple-600 hover:text-purple-800 transition-colors p-2 hover:bg-purple-50 rounded-lg"
                            title="Bellen"
                          >
                            <PhoneIcon className="w-4 h-4" />
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              handleDeleteLead(lead);
                            }}
                            className="text-red-600 hover:text-red-800 transition-colors p-2 hover:bg-red-50 rounded-lg"
                            title="Verwijderen"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
          
          {/* Pagination Controls - Responsive */}
          {filteredLeads.length > 0 && (
            <div className="px-4 md:px-6 py-4 bg-gray-50 border-t border-gray-200">
              {/* Mobile Pagination */}
              <div className="md:hidden space-y-3">
                <div className="text-center">
                  <span className="text-sm text-gray-700">
                    {((currentPage - 1) * leadsPerPage) + 1}-{Math.min(currentPage * leadsPerPage, filteredLeads.length)} van {filteredLeads.length} leads
                  </span>
                </div>
                
                <div className="flex items-center justify-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 font-medium"
                  >
                    ← Vorige
                  </button>
                  
                  <span className="px-4 py-2 text-sm font-bold text-purple-600">
                    {currentPage} / {totalPages}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 font-medium"
                  >
                    Volgende →
                  </button>
                </div>
                
                <div className="text-center">
                  <select
                    value={leadsPerPage}
                    onChange={(e) => {
                      setLeadsPerPage(Number(e.target.value));
                      setCurrentPage(1); // Reset to first page
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white font-medium"
                  >
                    <option value={10}>📄 10 per pagina</option>
                    <option value={25}>📄 25 per pagina</option>
                    <option value={50}>📄 50 per pagina</option>
                    <option value={100}>📄 100 per pagina</option>
                  </select>
                </div>
              </div>

              {/* Desktop Pagination */}
              <div className="hidden md:flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-700">
                    Toon {((currentPage - 1) * leadsPerPage) + 1}-{Math.min(currentPage * leadsPerPage, filteredLeads.length)} van {filteredLeads.length} leads
                  </span>
                  
                  <select
                    value={leadsPerPage}
                    onChange={(e) => {
                      setLeadsPerPage(Number(e.target.value));
                      setCurrentPage(1); // Reset to first page
                    }}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value={10}>10 per pagina</option>
                    <option value={25}>25 per pagina</option>
                    <option value={50}>50 per pagina</option>
                    <option value={100}>100 per pagina</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Vorige
                  </button>
                  
                  <span className="px-3 py-1 text-sm">
                    Pagina {currentPage} van {totalPages}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Volgende
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>

      {/* Lead Detail Modal */}
      <AnimatePresence>
        {viewingLead && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setViewingLead(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-brand-purple to-brand-pink p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">{viewingLead.name}</h3>
                    <p className="text-white/80">Lead Details - Rij {viewingLead.sheetRowNumber}</p>
                  </div>
                  <button
                    onClick={() => setViewingLead(null)}
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <UserIcon className="w-5 h-5 mr-2 text-blue-600" />
                        Contactgegevens
                      </h4>
                      <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center">
                          <EnvelopeIcon className="w-4 h-4 mr-3 text-gray-500" />
                          <span className="text-gray-900">{viewingLead.email}</span>
                        </div>
                        <div className="flex items-center">
                          <PhoneIcon className="w-4 h-4 mr-3 text-gray-500" />
                          <span className="text-gray-900">{viewingLead.phone}</span>
                        </div>
                        {viewingLead.branchData?.postcode && viewingLead.branchData?.huisnummer && (
                          <div className="flex items-center">
                            <MapPinIcon className="w-4 h-4 mr-3 text-gray-500" />
                            <span className="text-gray-900">{viewingLead.branchData.postcode} {viewingLead.branchData.huisnummer}</span>
                          </div>
                        )}
                        {viewingLead.company && (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span className="text-gray-900">{viewingLead.company}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Interest & Budget */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <CurrencyEuroIcon className="w-5 h-5 mr-2 text-green-600" />
                        Interesse & Budget
                      </h4>
                      <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                        <div>
                          <span className="text-sm text-gray-500">Interesse:</span>
                          <p className="font-medium text-gray-900">{viewingLead.interest}</p>
                        </div>
                        {viewingLead.budget && (
                          <div>
                            <span className="text-sm text-gray-500">Budget:</span>
                            <p className="font-medium text-gray-900">{viewingLead.budget}</p>
                          </div>
                        )}
                        {viewingLead.branchData?.datumInteresse && (
                          <div>
                            <span className="text-sm text-gray-500">Datum interesse:</span>
                            <p className="font-medium text-gray-900">{viewingLead.branchData.datumInteresse}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Branch-Specific Data */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <ChartBarIcon className="w-5 h-5 mr-2 text-purple-600" />
                        Thuisbatterij Specifiek
                      </h4>
                      
                      
                      <div className="space-y-4">
                        {/* Zonnepanelen - FORCE SHOW */}
                        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-yellow-400 rounded-full mr-3"></div>
                            <span className="text-sm font-medium text-gray-700">Zonnepanelen</span>
                          </div>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {viewingLead.branchData?.zonnepanelen || 'Geen data'}
                          </span>
                        </div>

                        {/* Dynamisch Contract - FORCE SHOW */}
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-blue-400 rounded-full mr-3"></div>
                            <span className="text-sm font-medium text-gray-700">Dynamisch Contract</span>
                          </div>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {viewingLead.branchData?.dynamischContract || 'Geen data'}
                          </span>
                        </div>

                        {/* Stroomverbruik - FORCE SHOW */}
                        <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-purple-400 rounded-full mr-3"></div>
                            <span className="text-sm font-medium text-gray-700">Stroomverbruik</span>
                          </div>
                          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                            {viewingLead.branchData?.stroomverbruik || 'Geen data'} kWh
                          </span>
                        </div>

                        {/* Reden Thuisbatterij - FORCE SHOW */}
                        <div className="p-3 bg-indigo-50 rounded-lg">
                          <div className="flex items-center mb-2">
                            <div className="w-3 h-3 bg-indigo-400 rounded-full mr-3"></div>
                            <span className="text-sm font-medium text-gray-700">Reden Thuisbatterij</span>
                          </div>
                          <p className="text-sm text-gray-900 ml-6">{viewingLead.branchData?.redenThuisbatterij || 'Geen data'}</p>
                        </div>

                        {/* Koopintentie - FORCE SHOW */}
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
                            <span className="text-sm font-medium text-gray-700">Koopintentie</span>
                          </div>
                          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            {viewingLead.branchData?.koopintentie || 'Geen data'}
                          </span>
                        </div>

                        {/* Nieuwsbrief - FORCE SHOW */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-gray-400 rounded-full mr-3"></div>
                            <span className="text-sm font-medium text-gray-700">Nieuwsbrief</span>
                          </div>
                          <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                            {viewingLead.branchData?.nieuwsbrief || 'Geen data'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {viewingLead.notes && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <DocumentTextIcon className="w-5 h-5 mr-2 text-orange-600" />
                          Notities
                        </h4>
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">{viewingLead.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 mt-8 pt-6 border-t border-gray-200">
                  {/* Reclamatie status of reclameer button */}
                  {leadReclamation.hasReclamation ? (
                    <div className="w-full px-4 py-3 bg-amber-50 border-2 border-amber-300 rounded-xl">
                      <div className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                          <p className="font-semibold text-amber-900">Reclamatieverzoek ingediend</p>
                          <p className="text-sm text-amber-700 mt-1">
                            Je hebt deze lead gereclameerd op {new Date(leadReclamation.reclamation?.timestamp).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. We nemen zo snel mogelijk contact met je op.
                          </p>
                          <p className="text-xs text-amber-600 mt-2 italic">
                            Status: {leadReclamation.reclamation?.status === 'pending' ? '⏳ In behandeling' : leadReclamation.reclamation?.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        const reden = prompt('⚠️ Waarom wil je deze lead reclameren?\n\nGeef een duidelijke reden op zodat wij je verzoek kunnen beoordelen:');
                        if (reden && reden.trim()) {
                          // Verstuur reclamatie naar admin
                          fetch('/api/reclaim-lead', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              customerId: customerData?.id,
                              customerEmail: user?.email,
                              customerName: user?.name,
                              lead: {
                                name: viewingLead.name,
                                email: viewingLead.email,
                                phone: viewingLead.phone,
                                sheetRowNumber: viewingLead.sheetRowNumber
                              },
                              reason: reden,
                              timestamp: new Date().toISOString()
                            })
                          })
                          .then(res => res.json())
                          .then(data => {
                            if (data.success) {
                              alert('✅ Je reclamatieverzoek is verstuurd naar ons team. We nemen zo snel mogelijk contact met je op!');
                              setLeadReclamation({ hasReclamation: true, reclamation: data });
                            } else if (data.error?.includes('al een reclamatieverzoek')) {
                              alert('⚠️ Er bestaat al een reclamatieverzoek voor deze lead.');
                              setLeadReclamation({ hasReclamation: true });
                            } else {
                              alert('❌ Er is iets misgegaan. Probeer het later opnieuw.');
                            }
                          })
                          .catch(error => {
                            console.error('Error submitting reclamation:', error);
                            alert('❌ Er is iets misgegaan. Probeer het later opnieuw.');
                          });
                        }
                      }}
                      className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors flex items-center justify-center space-x-2 shadow-lg font-semibold"
                      title="Reclameer deze lead als er iets niet klopt"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Reclameer lead</span>
                    </button>
                  )}

                  {/* Sluiten & Bewerken Buttons */}
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setViewingLead(null)}
                      className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                    >
                      Sluiten
                    </button>
                    <button
                      onClick={() => {
                        setEditingLead(viewingLead);
                        setViewingLead(null);
                      }}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-brand-purple to-brand-pink text-white rounded-xl hover:shadow-lg transition-all duration-300 font-semibold"
                    >
                      Bewerken
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lead Edit Modal - Full Edit */}
      <AnimatePresence>
        {editingLead && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setEditingLead(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Lead bewerken</h3>
                  <button
                    onClick={() => setEditingLead(null)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-gray-600 mb-6">Wijzigingen worden automatisch gesynchroniseerd met Google Sheets</p>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  
                  if (!customerData) return;
                  
                  try {
                    // Update updatedAt timestamp
                    const updatedLead = { ...editingLead, updatedAt: new Date() };
                    
                    console.log('📝 Edit Modal: Saving lead:', updatedLead.name, updatedLead.id);
                    
                    // Update in local state FIRST for immediate UI refresh
                            setLeads(prev => prev.map(lead => 
                      lead.id === updatedLead.id ? updatedLead : lead
                    ));
                    
                    // Update in CRM system (localStorage)
                    const updateSuccess = crmSystem.updateCustomerLead(customerData.id, updatedLead.id, {
                      name: updatedLead.name,
                      email: updatedLead.email,
                      phone: updatedLead.phone,
                      budget: updatedLead.budget,
                      notes: updatedLead.notes,
                      status: updatedLead.status,
                      dealValue: updatedLead.dealValue,
                      profit: updatedLead.profit,
                      branchData: updatedLead.branchData,
                      updatedAt: updatedLead.updatedAt
                    });
                    
                    if (!updateSuccess) {
                      console.warn('⚠️ CRM update returned false, but continuing with sync...');
                    }
                    
                    // Get updated customer for blob sync
                    const updatedCustomer = crmSystem.getCustomerById(customerData.id);
                    if (updatedCustomer) {
                      // Sync to Blob Storage
                      try {
                        console.log('💾 Edit Modal: Syncing to Blob Storage...');
                        await authenticatedFetch('/api/customer-data', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            customerId: customerData.email,
                            customerData: updatedCustomer
                          })
                        });
                        console.log('✅ Edit Modal: Synced to Blob Storage');
                      } catch (blobError) {
                        console.error('❌ Edit Modal: Blob Storage sync failed:', blobError);
                      }
                    }
                    
                    // Sync to Google Sheets if URL is configured (server-side with Service Account)
                    if (customerData.googleSheetUrl && updatedLead.sheetRowNumber) {
                      try {
                        console.log('📊 Edit Modal: Syncing to Google Sheets...');
                        console.log('📊 Sheet URL:', customerData.googleSheetUrl);
                        console.log('📊 Row number:', updatedLead.sheetRowNumber);
                        console.log('📊 Lead data:', {
                          name: updatedLead.name,
                          phone: updatedLead.phone,
                          email: updatedLead.email,
                          branchData: updatedLead.branchData
                        });
                        
                        // Use server-side API route for proper Service Account authentication
                        const sheetResponse = await authenticatedFetch('/api/update-lead-in-sheet', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            googleSheetUrl: customerData.googleSheetUrl,
                            lead: updatedLead
                          })
                        });
                        
                        if (!sheetResponse.ok) {
                          const errorData = await sheetResponse.json();
                          throw new Error(errorData.error || 'Failed to update Google Sheets');
                        }
                        
                        console.log('✅ Edit Modal: Synced to Google Sheets');
                      } catch (sheetError) {
                        console.error('❌ Edit Modal: Google Sheets sync failed:', sheetError);
                      }
                    } else {
                      console.warn('⚠️ Edit Modal: Cannot sync to Google Sheets', {
                        hasSheetUrl: !!customerData.googleSheetUrl,
                        hasRowNumber: !!updatedLead.sheetRowNumber
                      });
                    }
                    
                    console.log('✅ Edit Modal: All syncs complete');
                    
                    // Close modal
                    setEditingLead(null);
                  } catch (error) {
                    console.error('❌ Edit Modal: Error updating lead:', error);
                    alert('❌ Fout bij bijwerken van lead: ' + (error as Error).message);
                  }
                }}
                className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Naam *</label>
                      <input
                        type="text"
                        value={editingLead.name}
                        onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={editingLead.email || ''}
                        onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Telefoon</label>
                      <input
                        type="tel"
                        value={editingLead.phone || ''}
                        onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Postcode</label>
                      <input
                        type="text"
                        value={editingLead.branchData?.postcode || ''}
                        onChange={(e) => setEditingLead({ 
                          ...editingLead, 
                          branchData: { ...editingLead.branchData, postcode: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Huisnummer</label>
                      <input
                        type="text"
                        value={editingLead.branchData?.huisnummer || ''}
                        onChange={(e) => setEditingLead({ 
                          ...editingLead, 
                          branchData: { ...editingLead.branchData, huisnummer: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Plaatsnaam</label>
                      <input
                        type="text"
                        value={editingLead.city || ''}
                        onChange={(e) => setEditingLead({ ...editingLead, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        placeholder="Stad of plaats"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget</label>
                    <input
                      type="text"
                      value={editingLead.budget || ''}
                      onChange={(e) => setEditingLead({ ...editingLead, budget: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={editingLead.status}
                      onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value as Lead['status'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                    >
                      {customStages.map(stage => (
                        <option key={stage.id} value={stage.id}>
                          {stage.icon} {stage.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Deal Value en Profit - alleen tonen als status deal_closed */}
                  {editingLead.status === 'deal_closed' && (
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-xl border-2 border-green-200">
                      <div className="flex items-center mb-3">
                        <span className="text-2xl mr-2">💰</span>
                        <h4 className="text-lg font-semibold text-gray-900">Deal Financiën</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Omzet (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editingLead.dealValue || ''}
                            onChange={(e) => setEditingLead({ 
                              ...editingLead, 
                              dealValue: e.target.value ? parseFloat(e.target.value) : undefined 
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            placeholder="Bijv. 8500"
                          />
                          <p className="text-xs text-gray-500 mt-1">Totale omzet van de deal</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Winst (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editingLead.profit || ''}
                            onChange={(e) => setEditingLead({ 
                              ...editingLead, 
                              profit: e.target.value ? parseFloat(e.target.value) : undefined 
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            placeholder="Bijv. 2500"
                          />
                          <p className="text-xs text-gray-500 mt-1">Netto winst op de deal</p>
                        </div>
                      </div>
                    </div>
                  )}
 
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Resultaat gesprek</label>
                    <textarea
                      value={editingLead.notes || ''}
                      onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                      placeholder="Noteer het resultaat van het gesprek met de klant..."
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditingLead(null)}
                      className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                    >
                      Annuleren
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-gradient-to-r from-brand-purple to-brand-pink text-white rounded-xl hover:opacity-90 font-semibold transition-opacity"
                    >
                      Opslaan & Synchroniseren
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add New Lead Modal */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowAddForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Nieuwe lead toevoegen</h3>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-gray-600 mb-6">Voeg handmatig een nieuwe lead toe aan je leadportaal</p>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  
                  const newLead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> = {
                    name: formData.get('name') as string,
                    email: formData.get('email') as string,
                    phone: formData.get('phone') as string,
                    company: '',
                    address: '',
                    city: formData.get('city') as string,
                    interest: formData.get('redenThuisbatterij') as string || 'Thuisbatterij',
                    budget: formData.get('budget') as string,
                    timeline: '',
                    notes: formData.get('notes') as string,
                    status: 'new',
                    assignedTo: user?.name || 'Onbekend',
                    source: 'manual',
                    sheetRowNumber: undefined,
                    branchData: {
                      datumInteresse: new Date().toLocaleDateString('nl-NL'),
                      postcode: formData.get('postcode') as string || '',
                      huisnummer: formData.get('huisnummer') as string || '',
                      zonnepanelen: formData.get('zonnepanelen') as string || '',
                      dynamischContract: formData.get('dynamischContract') as string || '',
                      stroomverbruik: formData.get('stroomverbruik') as string || '',
                      nieuwsbrief: '-',
                      redenThuisbatterij: formData.get('redenThuisbatterij') as string || '',
                      koopintentie: formData.get('koopintentie') as string || ''
                    }
                  };

                  if (customerData) {
                    const success = await crmSystem.addLeadToCustomer(customerData.id, newLead);
                    if (success) {
                      // Refresh data
                      const updatedCustomer = await crmSystem.getCustomerById(customerData.id);
                      if (updatedCustomer) {
                        setCustomerData(updatedCustomer);
                        setLeads(updatedCustomer.leadData || []);
                      }
                      
                      // Sync to Google Sheets if linked
                      if (customerData.googleSheetUrl && updatedCustomer) {
                        try {
                          // Get the newly added lead with its ID
                          const addedLead = updatedCustomer.leadData?.find(lead => lead.name === newLead.name);
                          if (addedLead) {
                            await addLeadToSheet(customerData.googleSheetUrl, addedLead);
                            console.log('✅ Lead added to Google Sheets');
                            
                            // 🔄 Trigger WhatsApp message for new lead
                            try {
                              const whatsappResponse = await fetch('/api/whatsapp/trigger-new-lead', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  customerId: customerData.email, // Use email as customerId
                                  leadId: addedLead.id,
                                  leadName: addedLead.name,
                                  phoneNumber: addedLead.phone,
                                  product: 'onze diensten', // Default product
                                  branch: 'Custom'
                                })
                              });
                              
                              if (whatsappResponse.ok) {
                                const whatsappResult = await whatsappResponse.json();
                                if (whatsappResult.success) {
                                  console.log('✅ WhatsApp message triggered for new lead');
                                }
                              }
                            } catch (whatsappError) {
                              console.error('❌ WhatsApp trigger failed:', whatsappError);
                              // Don't show error to user, WhatsApp is optional
                            }
                            
                            console.log('✅ Nieuwe lead succesvol toegevoegd in portal EN Google Sheets!');
                          }
                        } catch (error) {
                          console.error('Error adding lead to Google Sheets:', error);
                        }
                      }
                      
                      setShowAddForm(false);
                    } else {
                      console.error('❌ Fout bij toevoegen van lead');
                    }
                  }
                }} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Naam *</label>
                      <input
                        type="text"
                        name="name"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        placeholder="Volledige naam"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">E-mail *</label>
                      <input
                        type="email"
                        name="email"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        placeholder="email@voorbeeld.nl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Telefoon</label>
                      <input
                        type="tel"
                        name="phone"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        placeholder="06-12345678"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Postcode</label>
                      <input
                        type="text"
                        name="postcode"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        placeholder="1234AB"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Huisnummer</label>
                      <input
                        type="text"
                        name="huisnummer"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        placeholder="12"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Plaatsnaam</label>
                      <input
                        type="text"
                        name="city"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        placeholder="Amsterdam"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Zonnepanelen</label>
                      <select
                        name="zonnepanelen"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                      >
                        <option value="">Selecteer</option>
                        <option value="Ja">Ja</option>
                        <option value="Nee">Nee</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Dynamisch contract</label>
                      <select
                        name="dynamischContract"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                      >
                        <option value="">Selecteer</option>
                        <option value="Ja">Ja</option>
                        <option value="Nee">Nee</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Stroomverbruik (kWh/jaar)</label>
                      <input
                        type="text"
                        name="stroomverbruik"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        placeholder="3500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Budget</label>
                      <select
                        name="budget"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                      >
                        <option value="">Selecteer budget</option>
                        <option value="onder de €2500,-">Onder de €2500,-</option>
                        <option value="tussen de €2500,- en €5000,-">Tussen de €2500,- en €5000,-</option>
                        <option value="tussen de €5000,- en 7500,-">Tussen de €5000,- en €7500,-</option>
                        <option value="Meer dan €7500,-">Meer dan €7500,-</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reden Thuisbatterij</label>
                    <select
                      name="redenThuisbatterij"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                    >
                      <option value="">Selecteer reden</option>
                      <option value="Kostenbesparing">Kostenbesparing</option>
                      <option value="Onafhankelijkheid van het stroomnet">Onafhankelijkheid van het stroomnet</option>
                      <option value="Handelen op de dynamische markt">Handelen op de dynamische markt</option>
                      <option value="Overig">Overig</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Koopintentie?</label>
                    <select
                      name="koopintentie"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                    >
                      <option value="">Selecteer</option>
                      <option value="Ja">Ja</option>
                      <option value="Nee">Nee</option>
                      <option value="Misschien">Misschien</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Resultaat gesprek</label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                      placeholder="Noteer het resultaat van het gesprek met de klant..."
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Annuleren
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-brand-purple text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Lead Toevoegen
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                    <Cog6ToothIcon className="w-7 h-7 text-brand-purple" />
                    <span>Leadportaal instellingen</span>
                  </h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Email Notifications Section */}
                <div className="space-y-6">
                  <div className="border-b border-gray-200 pb-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2 flex items-center space-x-2">
                      <BellIcon className="w-5 h-5 text-brand-purple" />
                      <span>Email notificaties</span>
                    </h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Ontvang automatisch een email wanneer er nieuwe leads binnenkomen, zelfs als je het portal niet geopend hebt.
                    </p>

                    <div className="space-y-4">
                      {/* Enable/Disable Email Notifications */}
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div className="flex-1">
                          <label htmlFor="email-notifications-enabled" className="font-medium text-gray-900 cursor-pointer">
                            Email notificaties inschakelen
                          </label>
                          <p className="text-sm text-gray-600 mt-1">
                            Krijg emails over nieuwe leads die binnenkomen
                          </p>
                        </div>
                        <div className="ml-4">
                          <button
                            type="button"
                            onClick={() => setEmailNotifications(prev => ({ ...prev, enabled: !prev.enabled }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              emailNotifications.enabled ? 'bg-brand-purple' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                emailNotifications.enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* New Leads Notification */}
                      {emailNotifications.enabled && (
                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                          <div className="flex-1">
                            <label htmlFor="email-new-leads" className="font-medium text-gray-900 cursor-pointer">
                              Nieuwe leads
                            </label>
                            <p className="text-sm text-gray-600 mt-1">
                              Stuur een email zodra een nieuwe lead binnenkomt
                            </p>
                          </div>
                          <div className="ml-4">
                            <button
                              type="button"
                              onClick={() => setEmailNotifications(prev => ({ ...prev, newLeads: !prev.newLeads }))}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                emailNotifications.newLeads ? 'bg-brand-purple' : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  emailNotifications.newLeads ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Info Box */}
                      {emailNotifications.enabled && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <div className="flex items-start space-x-3">
                            <BellIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-800">
                              <p className="font-medium mb-1">⚡ Real-time monitoring actief</p>
                              <p className="text-blue-700">
                                We controleren <strong>elke 5 minuten</strong> automatisch of er nieuwe leads in je Google Sheet staan en sturen direct een email naar <strong>{user?.email}</strong> voor elke nieuwe lead die binnenkomt.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Debug Console Section */}
                  {debugLogs.length > 0 && (
                    <div className="border-b border-gray-200 pb-4">
                      <div 
                        onClick={() => setShowDebugPanel(!showDebugPanel)}
                        className="cursor-pointer"
                      >
                        <h4 className="text-lg font-semibold text-gray-900 mb-2 flex items-center space-x-2">
                          <span className="text-xl">🐛</span>
                          <span>Debug console</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            debugLogs.some(l => l.level === 'error') ? 'bg-red-100 text-red-700' :
                            debugLogs.some(l => l.level === 'warning') ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {debugLogs.length} logs
                          </span>
                          <motion.svg 
                            animate={{ rotate: showDebugPanel ? 180 : 0 }}
                            className="w-4 h-4 text-gray-400"
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </motion.svg>
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Technische logs voor troubleshooting bij problemen met het laden van leads
                        </p>
                      </div>

                      <AnimatePresence>
                        {showDebugPanel && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-2"
                          >
                            <div className="flex gap-2 mb-3">
                              <button
                                onClick={() => {
                                  const logText = debugLogs.map(log => 
                                    `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}\n${log.data ? JSON.stringify(log.data, null, 2) : ''}`
                                  ).join('\n\n');
                                  navigator.clipboard.writeText(logText);
                                  alert('Logs gekopieerd!');
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                📋 Kopieer logs
                              </button>
                              <button
                                onClick={() => setDebugLogs([])}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                🗑️ Wis logs
                              </button>
                              <button
                                onClick={() => loadCustomerData()}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                🔄 Herlaad
                              </button>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto space-y-1.5 border border-gray-200">
                              {debugLogs.map((log, index) => (
                                <div 
                                  key={index} 
                                  className={`p-2 rounded text-xs ${
                                    log.level === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
                                    log.level === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
                                    log.level === 'warning' ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' :
                                    'bg-blue-50 border border-blue-200 text-blue-800'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="text-sm flex-shrink-0">
                                      {log.level === 'success' ? '✅' : log.level === 'error' ? '❌' : log.level === 'warning' ? '⚠️' : 'ℹ️'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-mono text-[10px] text-gray-500 mb-0.5">{log.timestamp}</div>
                                      <div className="font-medium">{log.message}</div>
                                      {log.data && (
                                        <details className="mt-1">
                                          <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-800">Bekijk data</summary>
                                          <pre className="text-[10px] mt-1 p-2 bg-black/5 rounded overflow-x-auto">
                                            {JSON.stringify(log.data, null, 2)}
                                          </pre>
                                        </details>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowSettings(false)}
                      className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                    >
                      Annuleren
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleSaveEmailNotifications();
                        setShowSettings(false);
                      }}
                      className="px-6 py-2.5 bg-gradient-to-r from-brand-purple to-brand-pink text-white rounded-xl hover:opacity-90 font-semibold transition-opacity"
                    >
                      Instellingen opslaan
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deal Value Modal - Omzet en Winst */}
      <AnimatePresence>
        {showDealValueModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowDealValueModal({ show: false, leadId: '', newStatus: 'new' })}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-2">🎉 Deal gesloten!</h3>
              <p className="text-gray-600 mb-6">
                Vul optioneel de omzet en winst in voor deze deal
              </p>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const dealValue = formData.get('dealValue') ? parseFloat(formData.get('dealValue') as string) : undefined;
                const profit = formData.get('profit') ? parseFloat(formData.get('profit') as string) : undefined;
                
                handleCloseDeal(showDealValueModal.leadId, showDealValueModal.newStatus, dealValue, profit);
                setShowDealValueModal({ show: false, leadId: '', newStatus: 'new' });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      💰 Omzet (€)
                    </label>
                    <input
                      type="number"
                      name="dealValue"
                      step="0.01"
                      min="0"
                      placeholder="Bijv. 8500"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">De totale omzet van deze deal</p>
        </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📈 Winst (€)
                    </label>
                    <input
                      type="number"
                      name="profit"
                      step="0.01"
                      min="0"
                      placeholder="Bijv. 2500"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">De netto winst op deze deal</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowDealValueModal({ show: false, leadId: '', newStatus: 'new' })}
                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl"
                  >
                    Deal sluiten
                  </button>
                </div>

                <p className="text-xs text-gray-500 text-center mt-3">
                  Je kunt deze velden leeg laten en later invullen via bewerken
                </p>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      )}
    </div>
  );
}
