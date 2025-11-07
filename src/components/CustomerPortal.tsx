'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeftIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  CurrencyEuroIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  UserIcon,
  XMarkIcon,
  UserPlusIcon,
  ShoppingCartIcon,
  ArrowPathIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { Logo } from './Logo';
import { useAuthStore, authenticatedFetch } from '../lib/auth';
import { CustomerLeadsSection } from './CustomerLeadsSection';
import { crmSystem, type Customer, type Lead } from '@/lib/crmSystem';
import { calculateRevenueFromLeads, formatRevenue } from '@/lib/revenueCalculator';
import { ADMIN_CONFIG } from '@/config/admin';
import { OrderCheckoutModal, type OrderPrefillConfig } from './OrderCheckoutModal';
import { OrderFeedbackModal } from './OrderFeedbackModal';
import { OrderDetailModal } from './OrderDetailModal';
import { SupportModal } from './SupportModal';
import { EmployeeManagementModal } from './EmployeeManagementModal';
import { PipelineStagesManager, type CustomStage } from '@/lib/pipelineStages';
import { leadPackages, calculatePackagePrice, formatPrice } from '@/lib/stripe';

interface CustomerPortalProps {
  onBackToHome: () => void;
  onStartChat: () => void;
}

// Gebruik echte bestellingen van de gebruiker of toon demo data alleen voor demo account
const getRecentOrders = (user: any) => {
  if (ADMIN_CONFIG.demoAccount && user?.email === ADMIN_CONFIG.demoAccount.email) {
    // Demo gebruiker - toon demo bestellingen
    return [
      {
        id: '#WL-2024-001',
        type: 'Exclusieve Thuisbatterij Leads',
        quantity: 50,
        status: 'geleverd',
        date: '2024-01-15',
        amount: '€2.000',
        leads: 47,
        conversions: 12,
      },
      {
        id: '#WL-2024-002', 
        type: 'Gedeelde Zonnepaneel Leads',
        quantity: 500,
        status: 'actief',
        date: '2024-01-20',
        amount: '€7.500',
        leads: 423,
        conversions: 89,
      }
    ];
  }
  
  // Echte gebruiker - toon hun eigen bestellingen
  if (user?.orders && user.orders.length > 0) {
    return user.orders.map((order: any, index: number) => ({
      id: `#WL-${new Date().getFullYear()}-${String(index + 1).padStart(3, '0')}`,
      type: order.type,
      quantity: order.quantity,
      status: order.status === 'delivered' ? 'geleverd' : order.status === 'active' ? 'actief' : order.status,
      date: order.date,
      amount: `€${(order.amount / 1000).toFixed(1)}K`,
      leads: order.leads || 0,
      conversions: order.conversions || 0,
    }));
  }
  
  // Geen bestellingen
  return [];
};

const quickActions = [
  {
    icon: PlusIcon,
    title: 'Nieuwe bestelling',
    description: 'Bestel meer leads voor uw campagnes',
    action: 'reorder',
    color: 'bg-green-500',
  },
  {
    icon: UserIcon,
    title: 'Mijn Leads',
    description: 'Beheer uw leads en Google Sheets sync',
    action: 'leads',
    color: 'bg-blue-500',
    requiresAccount: true,
  },
  {
    icon: Cog6ToothIcon,
    title: 'Account instellingen',
    description: 'Wijzig uw voorkeuren en gegevens',
    action: 'settings',
    color: 'bg-indigo-500',
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: 'Support chat',
    description: 'Vragen of hulp nodig?',
    action: 'support',
    color: 'bg-orange-500',
  },
];

// Dynamic quick actions based on user permissions
const getQuickActions = (user: any) => {
  const baseActions = [...quickActions];
  
  // Only show Team Beheer for owners
  if (user?.role === 'owner' || (!user?.role && user?.permissions?.canManageEmployees !== false)) {
    baseActions.splice(4, 0, {
      icon: UserPlusIcon,
      title: 'Team beheer',
      description: 'Beheer werknemers en hun toegang',
      action: 'team',
      color: 'bg-cyan-500',
    });
  }
  
  return baseActions;
};

export function CustomerPortal({ onBackToHome, onStartChat }: CustomerPortalProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<Customer | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingCustomerData, setLoadingCustomerData] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showSupportModal, setShowSupportModal] = useState(false); // NEW - for support modal
  const [showEmployeeModal, setShowEmployeeModal] = useState(false); // NEW - for employee management
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [growthGoal, setGrowthGoal] = useState<number>(500);
  const [goalFrequency, setGoalFrequency] = useState<'maand' | 'kwartaal'>('maand');
  const [savingGoal, setSavingGoal] = useState(false);
  const [leadStages, setLeadStages] = useState<CustomStage[]>([]);
  const [checkoutPrefill, setCheckoutPrefill] = useState<OrderPrefillConfig | null>(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackOrder, setFeedbackOrder] = useState<any | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  
  // Debug logging to track auth state changes
  useEffect(() => {
    console.log('CustomerPortal auth debug:', { 
      user: user ? { email: user.email, name: user.name } : null, 
      isAuthenticated, 
      userEmail: user?.email, 
      userName: user?.name,
      isGuest: user?.isGuest 
    });
  }, [user, isAuthenticated]);

  useEffect(() => {
    const customerId = customerData?.id || user?.email;
    if (!customerId) return;

    try {
      const manager = new PipelineStagesManager(customerId);
      const stages = manager.getStages();
      setLeadStages(stages);
    } catch (error) {
      console.error('❌ Kon pipeline stages niet laden in portal:', error);
      setLeadStages([]);
    }
  }, [customerData?.id, user?.email]);

  const normalizeCustomerGoalData = (customer: any): Customer | null => {
    if (!customer) return null;
    const parsedGoal = typeof customer.portalLeadGoal === 'number'
      ? customer.portalLeadGoal
      : Number(customer.portalLeadGoal) || 500;
    const parsedFrequency = customer.portalGoalFrequency === 'kwartaal' ? 'kwartaal' : 'maand';

    return {
      ...customer,
      portalLeadGoal: parsedGoal,
      portalGoalFrequency: parsedFrequency,
      portalGoalUpdatedAt: customer.portalGoalUpdatedAt
        ? new Date(customer.portalGoalUpdatedAt)
        : customer.portalGoalUpdatedAt,
    };
  };

  // Track when logout function is called
  useEffect(() => {
    const originalLogout = logout;
    const wrappedLogout = () => {
      console.log('🚨 LOGOUT FUNCTION CALLED FROM CUSTOMERPORTAL');
      console.log('🚨 Stack trace:', new Error().stack);
      return originalLogout();
    };
    
    // This is just for debugging - we can't actually wrap the function
    // but we can log when the component re-renders
  }, [logout]);

  // Check for payment success and show success modal
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    
    if (paymentStatus === 'success' && sessionId) {
      console.log('✅ Payment successful! Session ID:', sessionId);
      setShowSuccessModal(true);
      
      // Clean up URL (remove query params)
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/portal');
      }
      
      // Reload orders after successful payment
      if (user?.email) {
        loadOrders(user.email);
      }
    }
  }, [searchParams, user]);

  // Load orders from Supabase
  const loadOrders = async (email: string) => {
    try {
      setLoadingOrders(true);
      console.log('📦 Loading orders for:', email);
      
      const response = await authenticatedFetch(`/api/orders?customerEmail=${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
        console.log(`✅ Loaded ${data.orders?.length || 0} order(s)`);
      } else {
        console.error('Failed to load orders:', await response.text());
        setOrders([]);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Load orders when user changes
  useEffect(() => {
    if (user?.email) {
      loadOrders(user.email);
    }
  }, [user?.email]);

  // Load customer data from Supabase
  useEffect(() => {
    const loadCustomerData = async () => {
      if (!user?.email) return;
      
      setLoadingCustomerData(true);
      
      try {
        console.log('📦 CustomerPortal: Loading data for', user.email);
        
        // Load from Supabase via API
        const response = await authenticatedFetch(`/api/customer-data?customerId=${encodeURIComponent(user.email)}`);
        if (response.ok) {
          const data = await response.json();
          const customer = data.customerData || data.customer || null;
          
          console.log('✅ CustomerPortal: Data loaded from Supabase:', {
            email: customer?.email,
            hasGoogleSheet: !!customer?.googleSheetUrl,
            googleSheetUrl: customer?.googleSheetUrl,
            branch_id: customer?.branch_id,
            leadsCount: customer?.leadData?.length || 0
          });
          
          // Check if we need to do initial Google Sheets sync
          const needsInitialSync = customer?.googleSheetUrl && (!customer?.leadData || customer.leadData.length === 0);
          
          if (needsInitialSync) {
            console.log('🔄 CustomerPortal: No leads found but sheet is linked - doing initial sync...');
            await syncWithGoogleSheetsInBackground(customer, user.email);
          } else {
            setCustomerData(normalizeCustomerGoalData(customer));
            
            // Background sync with Google Sheets if sheet is linked (non-blocking)
            if (customer?.googleSheetUrl) {
              console.log('🔄 CustomerPortal: Starting background Google Sheets sync...');
              syncWithGoogleSheetsInBackground(customer, user.email);
            }
          }
        } else {
          // Fallback to crmSystem
          console.log('ℹ️ CustomerPortal: API failed, falling back to crmSystem');
          const customer = await crmSystem.getCustomerById(user.email);
          setCustomerData(normalizeCustomerGoalData(customer));
          
          // If customer has sheet but no leads, sync immediately
          if (customer?.googleSheetUrl && (!customer?.leadData || customer.leadData.length === 0)) {
            console.log('🔄 CustomerPortal: Syncing with Google Sheets...');
            await syncWithGoogleSheetsInBackground(customer, user.email);
          }
        }
      } catch (error) {
        console.error('❌ CustomerPortal: Error loading data:', error);
        // Fallback to crmSystem
        const customer = await crmSystem.getCustomerById(user.email);
        setCustomerData(normalizeCustomerGoalData(customer));
      } finally {
        setLoadingCustomerData(false);
      }
    };
    
    loadCustomerData();
  }, [user]);

  // Read leads DIRECTLY from Google Sheets (real-time, no Supabase storage)
  const syncWithGoogleSheetsInBackground = async (customer: any, email: string) => {
    try {
      const { readCustomerLeads } = await import('@/lib/googleSheetsAPI');
      // Use branch_id if available, otherwise fallback to default parser
      const freshLeads = await readCustomerLeads(customer.googleSheetUrl, undefined, customer.branch_id);
      
      console.log(`📊 Loaded ${freshLeads.length} leads DIRECTLY from Google Sheets (real-time)`);
      
      const normalizedCustomer = normalizeCustomerGoalData(customer);
      if (!normalizedCustomer) {
        return;
      }

      // Update customer data with fresh leads from sheet
      // NO writing to Supabase - sheet is the single source of truth!
      const updatedCustomer = {
        ...normalizedCustomer,
        leadData: freshLeads
      };
      
      setCustomerData(updatedCustomer);
      console.log(`✅ CustomerPortal: ${freshLeads.length} leads from Google Sheets ready`);
      setLastSync(new Date());
      
    } catch (syncError) {
      console.error('❌ CustomerPortal: Failed to read Google Sheets:', syncError);
      // Set customer data without leads if sheet read fails
      const normalizedCustomer = normalizeCustomerGoalData(customer);
      if (normalizedCustomer) {
        setCustomerData({
          ...normalizedCustomer,
          leadData: []
        });
      }
    }
  };
  
  // Use real orders from Blob Storage, or demo data for demo account
  const recentOrders = orders.length > 0 
    ? orders.map(order => ({
        id: order.orderNumber,
        type: order.packageName,
        quantity: order.quantity,
        status: order.status === 'completed' ? 'geleverd' : order.status === 'delivered' ? 'geleverd' : order.status,
        date: new Date(order.createdAt).toLocaleDateString('nl-NL'),
        amount: `€${((order.totalAmountInclVAT || order.totalAmount) / 100).toFixed(2)}`, // Show INCL VAT
        leads: order.leads || order.quantity,
        conversions: order.conversions || 0,
        invoiceUrl: order.invoiceUrl, // Add invoice URL for download
        invoiceNumber: order.invoiceNumber,
        feedbackRating: order.feedbackRating,
        feedbackNotes: order.feedbackNotes,
        feedbackSubmittedAt: order.feedbackSubmittedAt,
        raw: order,
      }))
    : getRecentOrders(user); // Fallback to demo data for demo account

  const handleLogout = () => {
    // Logout handles redirect to login screen automatically
    logout();
  };

  const handleQuickAction = (action: string) => {
    if (action === 'reorder') {
      openCheckoutWithPrefill(null);
    } else if (action === 'support') {
      setShowSupportModal(true);
    } else if (action === 'leads') {
      // Open het leadportaal
      router.push('/portal/leads');
    } else if (action === 'settings') {
      // Navigate to account settings page
      router.push('/portal/settings');
    } else if (action === 'team') {
      // Open employee management modal
      setShowEmployeeModal(true);
    } else {
      setSelectedAction(action);
    }
  };

  // Lead management handlers
  const handleUpdateLead = async (leadId: string, updates: Partial<Lead>) => {
    if (customerData) {
      await crmSystem.updateCustomerLead(customerData.id, leadId, updates);
      // Refresh customer data
      const updatedCustomer = await crmSystem.getCustomerById(customerData.id);
      if (updatedCustomer) {
        setCustomerData(updatedCustomer);
      }
    }
  };

  const handleAddLead = async (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (customerData) {
      await crmSystem.addLeadToCustomer(customerData.id, leadData);
      // Refresh customer data
      const updatedCustomer = await crmSystem.getCustomerById(customerData.id);
      if (updatedCustomer) {
        setCustomerData(updatedCustomer);
      }
    }
  };

  const handleDeleteLead = (leadId: string) => {
    if (customerData) {
      // Remove lead from customer data
      const updatedLeads = customerData.leadData?.filter(l => l.id !== leadId) || [];
      customerData.leadData = updatedLeads;
      setCustomerData({ ...customerData });
    }
  };

  const isDemoAccount = ADMIN_CONFIG.demoAccount && user?.email === ADMIN_CONFIG.demoAccount.email;
  const leadData = customerData?.leadData ?? [];
  const hasLeadData = leadData.length > 0;
  const revenueStats = hasLeadData ? calculateRevenueFromLeads(leadData) : null;

  const parseEuroValue = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    let str = String(value).trim();
    let multiplier = 1;
    if (/[kK]$/.test(str)) {
      multiplier = 1000;
      str = str.slice(0, -1);
    }
    str = str.replace(/€/g, '').replace(/\./g, '').replace(',', '.');
    const numeric = parseFloat(str);
    return Number.isFinite(numeric) ? numeric * multiplier : 0;
  };

  const totalLeadsFromOrders = recentOrders.reduce((sum: number, order: any) => {
    const leadsValue = typeof order.leads === 'number' ? order.leads : parseEuroValue(order.leads);
    return sum + (Number.isFinite(leadsValue) ? leadsValue : 0);
  }, 0);

  const totalConversionsFromOrders = recentOrders.reduce((sum: number, order: any) => {
    const conversionsValue = typeof order.conversions === 'number' ? order.conversions : parseEuroValue(order.conversions);
    return sum + (Number.isFinite(conversionsValue) ? conversionsValue : 0);
  }, 0);

  const totalLeads = hasLeadData ? leadData.length : totalLeadsFromOrders;
  let conversionRate = hasLeadData
    ? (revenueStats ? revenueStats.conversionRate : 0)
    : totalLeads > 0
      ? (totalConversionsFromOrders / totalLeads) * 100
      : 0;

  const totalRevenueFromOrdersCents = orders.reduce((sum, order) => {
    const value = order.totalAmountInclVAT ?? order.totalAmount ?? 0;
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  let totalRevenue = hasLeadData
    ? (revenueStats ? revenueStats.totalRevenue : 0)
    : totalRevenueFromOrdersCents / 100;

  if (!hasLeadData && totalRevenue === 0 && recentOrders.length > 0) {
    totalRevenue = recentOrders.reduce((sum: number, order: any) => sum + parseEuroValue(order.amount), 0);
  }

  const totalProfit = hasLeadData
    ? leadData
        .filter(lead => lead.status === 'deal_closed' && lead.profit)
        .reduce((sum, lead) => sum + (lead.profit || 0), 0)
    : 0;

  const latestOrder = recentOrders[0] || null;

  const derivedBranchName = useMemo(() => {
    const fromCustomer = (customerData as any)?.branch_name || (customerData as any)?.branchName;
    if (typeof fromCustomer === 'string' && fromCustomer.trim().length > 0) {
      return fromCustomer;
    }
    if (customerData?.branch_id && customerData.branch_id !== 'default') {
      return customerData.branch_id;
    }
    return 'Algemeen';
  }, [customerData?.branch_id, customerData]);

  const branchInsightMessages: Record<string, string> = {
    kozijnen: 'Klanten reageren het best binnen 2 uur – maak gebruik van de follow-up reminder hieronder.',
    thuisbatterij: 'Thuisbatterij leads converteren gemiddeld 22% sneller met een ROI-berekening in de eerste call.',
    zonnepanelen: 'Zonnepaneel klanten waarderen een WhatsApp-bericht na de offerte – plan deze direct vanuit het portaal.',
    warmtepomp: 'Warmtepomp leads hebben in de winter een piek – bereid je voor met een pakket op voorraad.',
  };

  const branchKey = derivedBranchName.toLowerCase();
  const insightCopy = Object.entries(branchInsightMessages).find(([key]) => branchKey.includes(key))?.[1] || 'Gebruik het leadportaal om je nieuwste leads binnen 15 minuten op te volgen voor maximale conversie.';

  const leadHealth = useMemo(() => {
    const sortedStages = [...leadStages].sort((a, b) => a.order - b.order);
    const firstStageId = sortedStages[0]?.id ?? null;
    const stageMapById = new Map(sortedStages.map(stage => [stage.id, stage]));
    const stageMapByName = new Map(sortedStages.map(stage => [stage.name.trim().toLowerCase(), stage]));

    const toDate = (value: any) => {
      if (!value) return null;
      if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
      const parsed = new Date(value);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    };

    const leads = (customerData?.leadData || []).map(lead => {
      const rawStatus = typeof lead.status === 'string' ? lead.status : '';
      const trimmedStatus = rawStatus.trim();
      let normalizedStatus: string;

      if (!trimmedStatus) {
        normalizedStatus = firstStageId || 'unassigned';
      } else if (stageMapById.has(trimmedStatus)) {
        normalizedStatus = trimmedStatus;
      } else {
        const lower = trimmedStatus.toLowerCase();
        const matchedStage = stageMapByName.get(lower);
        normalizedStatus = matchedStage ? matchedStage.id : trimmedStatus;
      }

      if (!stageMapById.has(normalizedStatus) && normalizedStatus !== 'unassigned') {
        normalizedStatus = firstStageId || 'unassigned';
      }

      return {
        ...lead,
        createdAt: toDate(lead.createdAt),
        updatedAt: toDate(lead.updatedAt || lead.createdAt),
        status: normalizedStatus
      };
    });

    const total = leads.length;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stageCounters = new Map<string, { count: number; recent: number }>();
    sortedStages.forEach(stage => stageCounters.set(stage.id, { count: 0, recent: 0 }));

    let unassignedCount = 0;

    leads.forEach(lead => {
      const stats = stageCounters.get(lead.status);
      const isRecent = lead.updatedAt ? lead.updatedAt >= weekAgo : lead.createdAt ? lead.createdAt >= weekAgo : false;

      if (stats) {
        stats.count += 1;
        if (isRecent) stats.recent += 1;
      } else {
        unassignedCount += 1;
      }
    });

    const stageStats = sortedStages.map(stage => {
      const stats = stageCounters.get(stage.id) ?? { count: 0, recent: 0 };
      return {
        stage,
        count: stats.count,
        percentage: total > 0 ? Math.round((stats.count / total) * 100) : 0,
        recent: stats.recent
      };
    });

    if (total === 0) {
      return {
        total,
        progressRate: 0,
        stageStats,
        primaryStages: stageStats.slice(0, 4),
        firstStageStat: stageStats[0] || null,
        actions: [
          {
            type: 'order',
            title: 'Nog geen leads actief',
            description: 'Plaats een bestelling of koppel je sheet om direct met verse leads aan de slag te gaan.'
          }
        ]
      } as const;
    }

    const firstStageStat = stageStats[0] || null;
    const progressRate = firstStageStat ? Math.max(0, Math.min(100, ((total - firstStageStat.count) / total) * 100)) : 100;

    const pipelineStagesOnly = stageStats;
    const highestOrderStage = pipelineStagesOnly[pipelineStagesOnly.length - 1] || null;
    const secondaryStage = pipelineStagesOnly.slice(1).sort((a, b) => b.count - a.count)[0];

    const actions: { type: string; title: string; description: string }[] = [];

    if (firstStageStat && firstStageStat.count > 0) {
      actions.push({
        type: `stage:${firstStageStat.stage.id}`,
        title: `${firstStageStat.count} lead(s) staan op ${firstStageStat.stage.name}`,
        description: `Plan directe opvolging en verplaats ze naar ${secondaryStage ? secondaryStage.stage.name : 'de volgende fase'}.`
      });
    }

    if (secondaryStage && secondaryStage.count > 0) {
      actions.push({
        type: `stage:${secondaryStage.stage.id}`,
        title: `${secondaryStage.count} lead(s) wachten in ${secondaryStage.stage.name}`,
        description: 'Check of alle offertes en opvolgacties verstuurd zijn.'
      });
    }

    if (highestOrderStage && highestOrderStage.count > 0 && highestOrderStage.stage.id !== firstStageStat?.stage.id) {
      actions.push({
        type: `stage:${highestOrderStage.stage.id}`,
        title: `${highestOrderStage.count} lead(s) in ${highestOrderStage.stage.name}`,
        description: 'Plan nazorg of upsell-kansen en bekijk of je klaar bent voor een nieuwe bestelling.'
      });
    }

    if (unassignedCount > 0) {
      actions.push({
        type: 'stage:unassigned',
        title: `${unassignedCount} lead(s) zonder status`,
        description: 'Werk je statusvelden bij zodat het portaal accurate funnel inzichten geeft.'
      });
    }

    if (actions.length === 0) {
      actions.push({
        type: 'order',
        title: 'Alle leads zijn up-to-date',
        description: 'Houd het momentum vast en bestel een nieuwe batch wanneer je klaar bent voor meer.'
      });
    }

    return {
      total,
      progressRate,
      stageStats,
      primaryStages: pipelineStagesOnly.slice(0, 4),
      firstStageStat,
      unassignedCount,
      actions
    };
  }, [customerData?.leadData, leadStages]);

  useEffect(() => {
    if (!customerData) return;
    if (typeof customerData.portalLeadGoal === 'number' && customerData.portalLeadGoal > 0) {
      setGrowthGoal(customerData.portalLeadGoal);
    }
    if (customerData.portalGoalFrequency) {
      setGoalFrequency(customerData.portalGoalFrequency === 'kwartaal' ? 'kwartaal' : 'maand');
    }
  }, [customerData?.portalLeadGoal, customerData?.portalGoalFrequency]);

  const safeGoalTarget = Math.max(growthGoal || 0, 1);
  const goalProgress = totalLeads > 0 ? Math.min((totalLeads / safeGoalTarget) * 100, 999) : 0;

  const handleLeadHealthAction = (type: string) => {
    if (type.startsWith('stage:')) {
      const stageId = type.split(':')[1];
      const params = new URLSearchParams();
      params.set('filter', stageId);
      router.push(`/portal/leads?${params.toString()}`);
      return;
    }
    if (type === 'order') {
      openCheckoutWithPrefill(null);
    }
  };

  const openCheckoutWithPrefill = (config: OrderPrefillConfig | null) => {
    setCheckoutPrefill(config);
    setShowCheckoutModal(true);
  };

  const handlePrefillFromOrder = (orderEntry: any) => {
    const raw = orderEntry?.raw || orderEntry;
    if (!raw) {
      openCheckoutWithPrefill(null);
      return;
    }

    const pref: OrderPrefillConfig = {
      industry: raw.industry,
      packageId: raw.packageId,
      leadType: raw.leadType === 'shared' ? 'shared_fresh' : raw.leadType,
      quantity: raw.quantity,
    };

    openCheckoutWithPrefill(pref);
  };

  const handleOpenFeedback = (orderEntry: any) => {
    setFeedbackOrder(orderEntry);
    setFeedbackModalOpen(true);
  };

  const handleSubmitFeedback = async (orderNumber: string, rating: number, notes: string) => {
    setIsSubmittingFeedback(true);
    try {
      const response = await authenticatedFetch('/api/orders/feedback', {
        method: 'POST',
        body: JSON.stringify({ orderNumber, rating, notes }),
      });

      if (!response.ok) {
        console.error('❌ Feedback opslaan mislukt:', await response.text());
        return;
      }

      const data = await response.json();
      const submittedAt = data?.order?.feedbackSubmittedAt || new Date().toISOString();

      setOrders(prev => prev.map(order =>
        order.orderNumber === orderNumber
          ? {
              ...order,
              feedbackRating: rating,
              feedbackNotes: notes,
              feedbackSubmittedAt: submittedAt,
            }
          : order
      ));

      setFeedbackModalOpen(false);
      setFeedbackOrder(null);
    } catch (error) {
      console.error('❌ Onverwachte feedbackfout:', error);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleSaveGoal = async (newGoal: number, frequency: 'maand' | 'kwartaal') => {
    if (!user?.email) return;
    setSavingGoal(true);

    try {
      const response = await authenticatedFetch('/api/customer-goal', {
        method: 'POST',
        body: JSON.stringify({
          customerId: user.email,
          leadGoal: newGoal,
          goalFrequency: frequency,
        }),
      });

      if (!response.ok) {
        console.error('❌ Opslaan portal-doel mislukt:', await response.text());
        return;
      }

      const data = await response.json();
      const updatedGoal = Number(data.leadGoal) || newGoal;
      const updatedFrequency = data.goalFrequency === 'kwartaal' ? 'kwartaal' : 'maand';
      const updatedAt = data.goalUpdatedAt ? new Date(data.goalUpdatedAt) : new Date();

      setGrowthGoal(updatedGoal);
      setGoalFrequency(updatedFrequency);
      setCustomerData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          portalLeadGoal: updatedGoal,
          portalGoalFrequency: updatedFrequency,
          portalGoalUpdatedAt: updatedAt,
        };
      });
      setGoalModalOpen(false);
    } catch (error) {
      console.error('❌ Unexpected error bij opslaan doel:', error);
    } finally {
      setSavingGoal(false);
    }
  };

  const firstPipelineStage = leadHealth.firstStageStat;
  const feedbackModalData = feedbackOrder
    ? {
        orderNumber: feedbackOrder.id,
        type: feedbackOrder.type,
        date: feedbackOrder.date,
        amount: feedbackOrder.amount,
        feedbackRating: feedbackOrder.feedbackRating,
        feedbackNotes: feedbackOrder.feedbackNotes,
      }
    : null;

  type RecommendedPackage = {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    metrics: { label: string; value: string }[];
    badge?: string;
    ctaLabel: string;
    prefill: OrderPrefillConfig;
    isPrimary?: boolean;
  };

  const recommendedPackages = useMemo<RecommendedPackage[]>(() => {
    const normalizedBranch = derivedBranchName.toLowerCase();
    const packageKey = Object.keys(leadPackages).find(key => normalizedBranch.includes(key.toLowerCase())) || 'Thuisbatterijen';
    const branchPackages = leadPackages[packageKey];

    if (!branchPackages || branchPackages.length === 0) {
      return [];
    }

    const exclusive = branchPackages.find(pkg => pkg.type === 'exclusive');
    const shared = branchPackages.find(pkg => pkg.type === 'shared_fresh');
    const bulk = branchPackages.find(pkg => pkg.type === 'bulk');

    const ordersByPackageId = orders.reduce<Record<string, typeof orders[number]>>((acc, order) => {
      if (!acc[order.packageId]) {
        acc[order.packageId] = order;
      }
      return acc;
    }, {});

    const suggestions: RecommendedPackage[] = [];

    if (exclusive) {
      const tiers = (exclusive.pricingTiers || []).map(tier => tier.minQuantity).sort((a, b) => a - b);
      const baseQuantity = ordersByPackageId[exclusive.id]?.quantity || exclusive.minQuantity || exclusive.quantity;
      let targetQuantity = baseQuantity;

      const nextTier = tiers.find(tierMin => tierMin > baseQuantity);
      if (nextTier) {
        targetQuantity = nextTier;
      } else if (tiers.length > 0) {
        targetQuantity = Math.max(baseQuantity, tiers[tiers.length - 1]);
      }

      if (!targetQuantity) {
        targetQuantity = exclusive.minQuantity || exclusive.quantity;
      }

      const pricingInfo = calculatePackagePrice(exclusive, targetQuantity);
      const badge = targetQuantity > baseQuantity ? 'Opschalen' : 'Meest gekozen';
      const subtitle = targetQuantity > baseQuantity ? 'Groei met premium exclusieve leads' : 'Realtime leads rechtstreeks in je portal';

      suggestions.push({
        id: `${exclusive.id}-${targetQuantity}`,
        title: `Upgrade naar ${targetQuantity} exclusieve leads`,
        subtitle,
        description: `Ideaal voor ${derivedBranchName.toLowerCase()} partners die klaar zijn voor de volgende stap in volume en kwaliteit.`,
        metrics: [
          { label: 'Investering', value: formatPrice(pricingInfo.totalPrice) },
          { label: '€ per lead', value: formatPrice(pricingInfo.pricePerLead) },
          { label: 'Pipeline boost', value: `${leadHealth.progressRate.toFixed(0)}% actief` }
        ],
        badge,
        ctaLabel: targetQuantity > baseQuantity ? 'Opschalen' : 'Bestel opnieuw',
        prefill: {
          industry: packageKey,
          packageId: exclusive.id,
          leadType: exclusive.type,
          quantity: targetQuantity,
        },
        isPrimary: true,
      });
    }

    if (shared) {
      const pricingInfo = calculatePackagePrice(shared, shared.quantity);
      suggestions.push({
        id: `${shared.id}-${shared.quantity}`,
        title: `Budgetvriendelijk: ${shared.quantity} gedeelde leads`,
        subtitle: '1/3 van de exclusieve prijs',
        description: 'Perfect om je sales team continu aan het bellen te houden zonder hoge kosten.',
        metrics: [
          { label: 'Investering', value: formatPrice(pricingInfo.totalPrice) },
          { label: '€ per lead', value: formatPrice(pricingInfo.pricePerLead) },
          { label: 'Levering', value: shared.deliveryTime }
        ],
        badge: 'Prijsbewust',
        ctaLabel: 'Selecteer pakket',
        prefill: {
          industry: packageKey,
          packageId: shared.id,
          leadType: shared.type,
          quantity: shared.quantity,
        },
        isPrimary: suggestions.length === 0,
      });
    }

    if (bulk) {
      const recentBulkOrder = ordersByPackageId[bulk.id];
      const suggestedBulkQuantity = recentBulkOrder ? Math.max(200, recentBulkOrder.quantity) : (bulk.minQuantity || bulk.quantity);
      const pricingInfo = calculatePackagePrice(bulk, suggestedBulkQuantity);

      suggestions.push({
        id: `${bulk.id}-${suggestedBulkQuantity}`,
        title: `Volume deal: ${suggestedBulkQuantity} bulk leads`,
        subtitle: 'Binnen 24 uur in een Excel bestand',
        description: 'Ideaal om campagnes snel te vullen of je sales team extra fuel te geven.',
        metrics: [
          { label: 'Investering', value: formatPrice(pricingInfo.totalPrice) },
          { label: '€ per lead', value: formatPrice(pricingInfo.pricePerLead) },
          { label: 'Levering', value: bulk.deliveryTime }
        ],
        badge: 'Volume',
        ctaLabel: 'Bestel volume',
        prefill: {
          industry: packageKey,
          packageId: bulk.id,
          leadType: bulk.type,
          quantity: suggestedBulkQuantity,
        },
        isPrimary: suggestions.length === 0,
      });
    }

    return suggestions.map((pkg, index) => ({ ...pkg, isPrimary: pkg.isPrimary || index === 0 }));
  }, [derivedBranchName, leadHealth.progressRate, orders]);

  const primaryRecommendation = recommendedPackages.find(pkg => pkg.isPrimary);
  const secondaryRecommendations = recommendedPackages.filter(pkg => !pkg.isPrimary);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-6 md:space-y-8">
        <motion.nav
          className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl px-3 md:px-6 py-3 md:py-4 shadow-[0_20px_45px_-25px_rgba(28,12,64,0.65)]"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={onBackToHome}
            className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-medium">Home</span>
          </button>

          <div className="text-center flex-1 px-2">
            <p className="text-xs text-white/50 uppercase tracking-[0.3em]">Warme Leads Portal</p>
            <h1 className="text-white font-semibold text-base md:text-lg">Welkom terug, {user?.name || (user?.isGuest ? 'Gast' : 'partner')}!</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSupportModal(true)}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/20 hover:text-white transition"
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
              Support
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/20 hover:text-white transition"
            >
              <UserIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Uitloggen</span>
            </button>
          </div>
        </motion.nav>

        {/* Hero & Status */}
        <motion.section
          className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl p-6 md:p-10 shadow-[0_45px_90px_-45px_rgba(25,14,64,0.8)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-brand-pink/30 blur-3xl" />
            <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-brand-purple/40 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-8 md:flex-row md:items-start">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium text-white/70">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(56,189,248,0.25)]" />
                Realtime accountoverzicht
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl md:text-4xl font-bold text-white">Klaar voor de volgende groeispurt?</h2>
                <p className="text-white/70 max-w-xl text-sm md:text-base">
                  Branch: <span className="text-white font-semibold">{derivedBranchName}</span>. {insightCopy}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs text-white/50">Totaal leads</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{totalLeads}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs text-white/50">Conversieratio</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-200">{conversionRate.toFixed(1)}%</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs text-white/50">Gegenereerde omzet</p>
                  <p className="mt-1 text-2xl font-semibold text-sky-200">{formatRevenue(totalRevenue)}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs text-white/50">Gegenereerde winst</p>
                  <p className="mt-1 text-2xl font-semibold text-purple-200">{formatRevenue(totalProfit)}</p>
                </div>
                <div className="col-span-2 rounded-2xl border border-white/15 bg-white/10 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-xs text-white/50">Doelstelling ({goalFrequency === 'maand' ? 'maandelijks' : 'per kwartaal'})</p>
                    <p className="text-lg font-semibold text-white">{totalLeads}/{growthGoal} leads</p>
                    <p className="text-xs text-white/60">{goalProgress.toFixed(1)}% behaald</p>
                    {customerData?.portalGoalUpdatedAt && (
                      <p className="text-[11px] text-white/40">Laatste update {new Date(customerData.portalGoalUpdatedAt).toLocaleString('nl-NL')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12">
                      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-white/15"
                          strokeWidth="3"
                          stroke="currentColor"
                          fill="transparent"
                          strokeDasharray="100"
                          strokeDashoffset="0"
                          d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-brand-pink"
                          strokeWidth="3"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                          strokeDasharray="100"
                          strokeDashoffset={`${100 - Math.min(goalProgress, 100)}`}
                          d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                        {Math.min(goalProgress, 999).toFixed(0)}%
                      </span>
                    </div>
                    <button
                      onClick={() => setGoalModalOpen(true)}
                      className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white/70 hover:text-white"
                    >
                      Doel aanpassen
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleQuickAction('reorder')}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-transform hover:-translate-y-0.5"
                >
                  <PlusIcon className="w-4 h-4" />
                  Nieuwe bestelling
                </button>
                <button
                  onClick={() => handleQuickAction('leads')}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white/80 hover:text-white hover:border-white/40 transition"
                >
                  <ChartBarIcon className="w-4 h-4" />
                  Ga naar mijn leads
                </button>
              </div>
            </div>

            <div className="w-full md:max-w-xs space-y-5 rounded-3xl border border-white/15 bg-white/10 p-6 shadow-[0_35px_60px_-35px_rgba(13,28,64,0.7)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white/80">Systeemstatus</p>
                <span className="text-xs text-white/50">Realtime</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Google Sheets sync</p>
                    <p className="text-xs text-white/60">{customerData?.googleSheetUrl ? `Actief en up-to-date${lastSync ? ` • Laatste sync ${lastSync.toLocaleTimeString('nl-NL')}` : ''}` : 'Nog niet gekoppeld'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${customerData?.googleSheetUrl ? 'bg-emerald-500/15 text-emerald-200' : 'bg-yellow-500/20 text-yellow-200'}`}>
                    {customerData?.googleSheetUrl ? 'Actief' : 'Activeren'}
                  </span>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
                    <CurrencyEuroIcon className="w-5 h-5 text-blue-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Facturen & betalingen</p>
                    <p className="text-xs text-white/60">{recentOrders.some((order: any) => order.invoiceUrl) ? 'Facturen beschikbaar' : 'Geen facturen gevonden'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${recentOrders.some((order: any) => order.invoiceUrl) ? 'bg-sky-500/20 text-sky-200' : 'bg-white/10 text-white/60'}`}>
                    {recentOrders.some((order: any) => order.invoiceUrl) ? 'Download' : 'Later'}
                  </span>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15">
                    <ChatBubbleLeftRightIcon className="w-5 h-5 text-orange-200" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Support beschikbaar</p>
                    <p className="text-xs text-white/60">Ons team staat voor je klaar</p>
                  </div>
                  <button
                    onClick={() => setShowSupportModal(true)}
                    className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/70 hover:text-white"
                  >
                    Chat
                  </button>
                </div>
                {recentOrders.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-white/50 mb-1">Laatste bestelling</p>
                    <p className="text-sm font-semibold text-white">{latestOrder?.type}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-white/60">
                      <span>{latestOrder?.date}</span>
                      <span>{latestOrder?.amount}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Goal modal */}
        <AnimatePresence>
          {goalModalOpen && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-md rounded-3xl border border-white/20 bg-brand-navy/80 p-6 text-white shadow-2xl"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Doelstelling aanpassen</h3>
                    <p className="text-sm text-white/60">Kies hoeveel leads je deze periode wilt behalen.</p>
                  </div>
                  <button onClick={() => setGoalModalOpen(false)} className="rounded-full bg-white/10 p-1 text-white/60 hover:text-white">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  <label className="block text-sm text-white/70">
                    Aantal leads
                    <input
                      type="number"
                      min={50}
                      step={10}
                      value={growthGoal}
                      onChange={(e) => setGrowthGoal(Math.max(50, Number(e.target.value) || 50))}
                      className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                    />
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-white/70">
                      <input
                        type="radio"
                        name="goalFrequency"
                        value="maand"
                        checked={goalFrequency === 'maand'}
                        onChange={() => setGoalFrequency('maand')}
                        className="accent-brand-pink"
                      />
                      Maandelijks doel
                    </label>
                    <label className="flex items-center gap-2 text-sm text-white/70">
                      <input
                        type="radio"
                        name="goalFrequency"
                        value="kwartaal"
                        checked={goalFrequency === 'kwartaal'}
                        onChange={() => setGoalFrequency('kwartaal')}
                        className="accent-brand-pink"
                      />
                      Kwartaaldoel
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setGoalModalOpen(false)}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:text-white"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={() => handleSaveGoal(growthGoal, goalFrequency)}
                    className={`rounded-xl bg-gradient-to-r from-brand-pink to-brand-purple px-4 py-2 text-sm font-semibold text-white ${savingGoal ? 'opacity-70 cursor-not-allowed' : ''}`}
                    disabled={savingGoal}
                  >
                    {savingGoal ? 'Opslaan...' : 'Opslaan'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lead health */}
        <motion.section
          className="grid gap-4 md:grid-cols-[1.2fr_1fr]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 md:p-7 shadow-[0_40px_80px_-55px_rgba(18,8,44,0.85)] backdrop-blur-xl">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Lead health</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Pipeline overzicht</h3>
                <p className="text-sm text-white/60">Zie waar je leads zich bevinden en wie prioriteit heeft voor opvolging.</p>
              </div>
              <div className="relative flex h-24 w-24 items-center justify-center">
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-white/15"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="transparent"
                    strokeDasharray="100"
                    strokeDashoffset="0"
                    d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={leadHealth.progressRate > 70 ? 'text-emerald-300' : leadHealth.progressRate > 40 ? 'text-amber-300' : 'text-red-300'}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    strokeDasharray="100"
                    strokeDashoffset={`${100 - Math.min(leadHealth.progressRate, 100)}`}
                    d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <span className="text-lg font-semibold">{leadHealth.progressRate.toFixed(0)}%</span>
                  <span className="text-[11px] text-white/60">pipeline flow</span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {leadHealth.primaryStages.length > 0 ? (
                leadHealth.primaryStages.map(stat => (
                  <div key={stat.stage.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 border border-white/10">
                        <span className={`absolute inset-[6px] rounded-full ${stat.stage.color}`} />
                        <span className="relative text-xs font-semibold text-white/70">
                          {String(stat.stage.order + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-white/55 font-medium tracking-wide uppercase">{stat.stage.name}</p>
                        <p className="mt-1 text-2xl font-semibold text-white">{stat.count}</p>
                      </div>
                    </div>
                    {stat.recent > 0 && (
                      <p className="mt-2 text-[11px] text-white/45">+{stat.recent} laatste 7 dagen</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-white/70">Geen pipeline fases gevonden. Configureer je statussen in het leadportaal.</p>
                </div>
              )}
            </div>

            {leadHealth.stageStats.length > 0 && (
              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Segmenten</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {leadHealth.stageStats.map(segment => (
                    <span
                      key={segment.stage.id}
                      className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80"
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${segment.stage.color}`} />
                      {segment.stage.name} • {segment.count} ({segment.percentage}%)
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => handleQuickAction('leads')}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 hover:text-white"
              >
                <ChartBarIcon className="w-4 h-4" />
                Open leadportaal
              </button>
              {firstPipelineStage && firstPipelineStage.count > 0 && (
                <button
                  onClick={() => handleLeadHealthAction(`stage:${firstPipelineStage.stage.id}`)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/30"
                >
                  {firstPipelineStage.stage.name} opvolgen
                </button>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/8 p-6 shadow-[0_35px_72px_-55px_rgba(15,8,40,0.85)] backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">Aanbevolen acties</p>
            <div className="mt-4 space-y-4">
              {leadHealth.actions.length > 0 ? (
                leadHealth.actions.map((item, index) => (
                  <div
                    key={`${item.type}-${index}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-white/60">{item.description}</p>
                      </div>
                      <button
                        onClick={() => handleLeadHealthAction(item.type)}
                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/70 hover:text-white"
                      >
                        Actie
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Je pipeline is volledig up-to-date</p>
                  <p className="mt-1 text-xs text-white/60">Mooi werk! Blijf leads toevoegen of bestel een extra batch om het momentum vast te houden.</p>
                </div>
              )}
            </div>
            <p className="mt-4 text-[11px] text-white/40">Lead health wordt realtime bijgewerkt wanneer je statusaanpassingen doet in het leadportaal.</p>
          </div>
        </motion.section>

        {/* Quick actions */}
        <motion.section
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {getQuickActions(user)
            .filter(action => {
              if (!action.requiresAccount) {
                if (action.action === 'reorder') return user?.permissions?.canCheckout !== false;
                return true;
              }
              if (action.action === 'leads') return isAuthenticated;
              if (action.action === 'team') return user?.permissions?.canManageEmployees !== false;
              return isAuthenticated && user && !user.isGuest;
            })
            .map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.action}
                  onClick={() => handleQuickAction(action.action)}
                  className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/8 p-6 text-left shadow-[0_35px_60px_-35px_rgba(17,10,48,0.75)] transition-all hover:border-white/35 hover:bg-white/12"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100" style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.15), transparent)' }} />
                  <div className="relative flex items-start gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${action.color} bg-opacity-20 backdrop-blur-md text-white shadow-lg shadow-black/20`}> 
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">{action.title}</h3>
                      <p className="mt-1 text-sm text-white/70">{action.description}</p>
                      <div className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-brand-pink group-hover:translate-x-1 transition-transform">
                        <span>Openen</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
        </motion.section>

        {/* Orders timeline */}
        <motion.section
          className="rounded-3xl border border-white/15 bg-white/8 p-6 md:p-8 shadow-[0_45px_85px_-60px_rgba(16,8,40,0.9)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Recente bestellingen</h2>
              <p className="text-sm text-white/60">Bekijk uw voorgeschiedenis en download facturen.</p>
            </div>
            <button
              onClick={() => handleQuickAction('reorder')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 hover:text-white hover:border-white/40 transition"
            >
              Nieuwe bestelling
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6">
            {loadingOrders ? (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse" />
                ))}
              </div>
            ) : recentOrders.length > 0 ? (
              <div className="relative pl-6">
                <span className="absolute left-2 top-2 bottom-2 w-px bg-white/15" />
                <div className="space-y-6">
                  {recentOrders.map((order: any, index: number) => (
                    <motion.div
                      key={order.id}
                      className="relative pl-6"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                    >
                      <span className="absolute left-[-14px] top-4 h-3 w-3 rounded-full bg-gradient-to-br from-brand-pink to-brand-purple shadow-[0_0_25px_rgba(216,180,254,0.45)]" />
                      <div className="rounded-2xl border border-white/10 bg-white/8 p-5 transition hover:border-white/25">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-xs text-white/40">{order.date}</p>
                            <h3 className="text-lg font-semibold text-white">{order.type}</h3>
                            <p className="text-sm text-white/60">Ordernummer {order.id}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${order.status === 'geleverd' ? 'bg-emerald-500/15 text-emerald-200' : order.status === 'actief' ? 'bg-yellow-500/20 text-yellow-200' : 'bg-white/10 text-white/60'}`}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                            {order.invoiceUrl && (
                              <a
                                href={order.invoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full px-3 py-1 text-xs font-medium bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 transition"
                              >
                                Factuur
                              </a>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrefillFromOrder(order);
                              }}
                              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-white/10 text-white/70 hover:text-white"
                            >
                              <ArrowPathIcon className="w-4 h-4" />
                              Opnieuw
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenFeedback(order);
                              }}
                              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${order.feedbackRating ? 'bg-purple-500/20 text-purple-200 hover:text-purple-100' : 'bg-white/10 text-white/70 hover:text-white'}`}
                            >
                              <StarIcon className="w-4 h-4" />
                              {order.feedbackRating ? 'Feedback' : 'Feedback geven'}
                            </button>
                            <button
                              onClick={() => setSelectedOrder(order.raw || order)}
                              className="rounded-full px-3 py-1 text-xs font-medium bg-white/10 text-white/70 hover:text-white"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                          <div>
                            <p className="text-white/45 mb-1">Leads</p>
                            <p className="text-white font-medium">{order.leads}</p>
                          </div>
                          <div>
                            <p className="text-white/45 mb-1">Conversies</p>
                            <p className="text-white font-medium">{order.conversions}</p>
                          </div>
                          <div>
                            <p className="text-white/45 mb-1">Waarde</p>
                            <p className="text-white font-medium">{order.amount}</p>
                          </div>
                          <div>
                            <p className="text-white/45 mb-1">Hoeveelheid</p>
                            <p className="text-white font-medium">{order.quantity}</p>
                            {order.feedbackRating && (
                              <div className="mt-2 flex items-center gap-1 text-[11px] text-white/70">
                                {Array.from({ length: 5 }).map((_, idx) => (
                                  <StarIcon
                                    key={idx}
                                    className={`w-3.5 h-3.5 ${idx < (order.feedbackRating || 0) ? 'text-yellow-300' : 'text-white/20'}`}
                                  />
                                ))}
                                {order.feedbackSubmittedAt && (
                                  <span className="ml-1 text-white/40">{new Date(order.feedbackSubmittedAt).toLocaleDateString('nl-NL')}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                  <ShoppingCartIcon className="w-8 h-8 text-white/60" />
                </div>
                <h3 className="text-white text-lg font-semibold">Nog geen bestellingen</h3>
                <p className="mt-2 text-sm text-white/60 max-w-lg mx-auto">
                  Start direct met het plaatsen van uw eerste bestelling. Daarna verschijnen alle leveringen en facturen automatisch in dit overzicht.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => handleQuickAction('reorder')}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:-translate-y-0.5 transition"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Direct leads bestellen
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        {recommendedPackages.length > 0 && (
          <motion.section
            className="rounded-3xl border border-white/15 bg-white/8 p-6 md:p-8 shadow-[0_45px_90px_-60px_rgba(18,10,48,0.85)]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/45">Aanbevolen voor jou</p>
                  <h2 className="text-xl font-semibold text-white">Slim opschalen met de juiste pakketten</h2>
                  <p className="text-sm text-white/60">Advies op basis van je huidige pipeline, ordergeschiedenis en groeipotentieel.</p>
                </div>

                {primaryRecommendation && (
                  <div className="rounded-3xl border border-white/15 bg-white/10 p-5 space-y-4">
                    <div className="space-y-1">
                      <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white/75">Top aanbeveling</span>
                      <h3 className="text-lg font-semibold text-white">{primaryRecommendation.title}</h3>
                      <p className="text-xs text-white/50 uppercase tracking-wide">{primaryRecommendation.subtitle}</p>
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed">{primaryRecommendation.description}</p>
                    <div className="grid grid-cols-2 gap-3 text-sm text-white/75">
                      {primaryRecommendation.metrics.slice(0, 2).map(metric => (
                        <div key={`${primaryRecommendation.id}-${metric.label}`} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-white/45">{metric.label}</p>
                          <p className="text-sm font-medium text-white">{metric.value}</p>
                        </div>
                      ))}
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-white/45">Pipeline actief</p>
                        <p className="text-sm font-medium text-white">{leadHealth.progressRate.toFixed(0)}% flow</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-white/45">Nieuwe leads</p>
                        <p className="text-sm font-medium text-white">{leadHealth.firstStageStat?.count ?? 0} in {leadHealth.firstStageStat?.stage.name ?? 'pipeline'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openCheckoutWithPrefill(primaryRecommendation.prefill)}
                      className="w-full rounded-xl bg-gradient-to-r from-brand-pink to-brand-purple px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-purple/30 transition hover:from-brand-pink/90 hover:to-brand-purple/90"
                    >
                      {primaryRecommendation.ctaLabel}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {secondaryRecommendations.map(pkg => (
                  <div
                    key={pkg.id}
                    className={`h-full rounded-3xl border ${pkg.isPrimary ? 'border-white/25 bg-white/12 shadow-[0_25px_65px_-45px_rgba(20,10,40,0.9)]' : 'border-white/10 bg-white/6'} p-5 backdrop-blur-lg space-y-4 transition hover:border-white/20`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{pkg.title}</p>
                        {pkg.badge && (
                          <span className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-medium text-white/70">{pkg.badge}</span>
                        )}
                      </div>
                      <p className="text-xs text-white/50 uppercase tracking-wide">{pkg.subtitle}</p>
                    </div>
                    <p className="text-sm text-white/65 leading-relaxed">{pkg.description}</p>
                    <div className="space-y-2">
                      {pkg.metrics.map(metric => (
                        <div key={`${pkg.id}-${metric.label}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-3 py-2 text-xs text-white/65">
                          <span className="uppercase tracking-wide">{metric.label}</span>
                          <span className="text-sm font-medium text-white/80">{metric.value}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => openCheckoutWithPrefill(pkg.prefill)}
                      className={`w-full rounded-xl ${pkg.isPrimary ? 'bg-white text-brand-purple' : 'bg-gradient-to-r from-brand-purple to-brand-pink text-white'} px-4 py-2.5 text-sm font-semibold transition hover:opacity-90`}
                    >
                      {pkg.ctaLabel}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* CTA banner */}
        <motion.section
          className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-r from-brand-purple via-brand-pink to-orange-400 p-6 md:p-8 text-white shadow-[0_45px_90px_-65px_rgba(24,9,64,0.85)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-white/20 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-2xl font-semibold">Boost uw campagne vandaag nog</h3>
              <p className="mt-2 max-w-xl text-sm md:text-base text-white/80">
                Combineer verse exclusieve leads met realtime inzicht in het leadportaal. Ons team helpt u graag bij het kiezen van de beste strategie.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleQuickAction('support')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/25 transition"
              >
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                Chat met support
              </button>
              <button
                onClick={() => handleQuickAction('reorder')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-purple hover:bg-white/90 transition"
              >
                <PlusIcon className="w-4 h-4" />
                Bestel leads
              </button>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Order Checkout Modal */}
      <OrderCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        userEmail={user?.email || ''}
        userName={user?.name || ''}
        userCompany={user?.company}
        userPermissions={user?.permissions}
        prefillConfig={checkoutPrefill}
      />

      {/* Order Detail Modal */}
      <OrderDetailModal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
      />

      {/* Support Modal */}
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      <OrderFeedbackModal
        isOpen={feedbackModalOpen}
        onClose={() => {
          setFeedbackModalOpen(false);
          setFeedbackOrder(null);
        }}
        order={feedbackModalData}
        onSubmit={handleSubmitFeedback}
        isSubmitting={isSubmittingFeedback}
      />

      {/* Payment Success Modal */}
      {showSuccessModal && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSuccessModal(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 overflow-y-auto"
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative w-full max-w-md bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="relative bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-6 rounded-t-3xl">
                  <button
                    onClick={() => setShowSuccessModal(false)}
                    className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                  
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                      <CheckCircleIcon className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold">Betaling gelukt! 🎉</h2>
                      <p className="text-green-100 mt-1">
                        Uw bestelling is verwerkt
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-8">
                  <p className="text-gray-700 text-center mb-6">
                    Uw bestelling is succesvol verwerkt. U ontvangt binnen enkele minuten een bevestigingsmail met uw factuur en lead delivery details.
                  </p>
                  
                  {/* Order Info */}
                  <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl p-5 mb-6 border-2 border-green-300">
                    <p className="text-gray-700 text-sm text-center font-medium leading-relaxed">
                      ✅ Uw leads worden binnen 15 minuten geleverd<br />
                      📧 Bevestigingsmail is onderweg<br />
                      📊 Bekijk uw bestelling hieronder
                    </p>
                  </div>
                  
                  {/* Close Button */}
                  <motion.button
                    onClick={() => setShowSuccessModal(false)}
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold py-4 rounded-xl transition-all shadow-md hover:shadow-lg"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Bekijk mijn bestellingen
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Employee Management Modal */}
      <EmployeeManagementModal 
        isOpen={showEmployeeModal} 
        onClose={() => setShowEmployeeModal(false)} 
        user={user}
      />
    </div>
  );
}
