'use client';

import React, { useState, useEffect } from 'react';
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
  UserPlusIcon
} from '@heroicons/react/24/outline';
import { Logo } from './Logo';
import { useAuthStore, authenticatedFetch } from '../lib/auth';
import { CustomerLeadsSection } from './CustomerLeadsSection';
import { crmSystem, type Customer, type Lead } from '@/lib/crmSystem';
import { calculateRevenueFromLeads, formatRevenue } from '@/lib/revenueCalculator';
import { ADMIN_CONFIG } from '@/config/admin';
import { OrderCheckoutModal } from './OrderCheckoutModal';
import { OrderDetailModal } from './OrderDetailModal';
import { SupportModal } from './SupportModal';
import { EmployeeManagementModal } from './EmployeeManagementModal';

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
    title: 'CRM Dashboard',
    description: 'Enterprise-grade lead management & analytics',
    action: 'crm',
    color: 'bg-purple-600',
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
            leadsCount: customer?.leadData?.length || 0
          });
          
          // Check if we need to do initial Google Sheets sync
          const needsInitialSync = customer?.googleSheetUrl && (!customer?.leadData || customer.leadData.length === 0);
          
          if (needsInitialSync) {
            console.log('🔄 CustomerPortal: No leads found but sheet is linked - doing initial sync...');
            await syncWithGoogleSheetsInBackground(customer, user.email);
          } else {
            setCustomerData(customer);
            
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
          setCustomerData(customer || null);
          
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
        setCustomerData(customer || null);
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
      const freshLeads = await readCustomerLeads(customer.googleSheetUrl);
      
      console.log(`📊 Loaded ${freshLeads.length} leads DIRECTLY from Google Sheets (real-time)`);
      
      // Update customer data with fresh leads from sheet
      // NO writing to Supabase - sheet is the single source of truth!
      const updatedCustomer = {
        ...customer,
        leadData: freshLeads
      };
      
      setCustomerData(updatedCustomer);
      console.log(`✅ CustomerPortal: ${freshLeads.length} leads from Google Sheets ready`);
      
    } catch (syncError) {
      console.error('❌ CustomerPortal: Failed to read Google Sheets:', syncError);
      // Set customer data without leads if sheet read fails
      setCustomerData({
        ...customer,
        leadData: []
      });
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
      }))
    : getRecentOrders(user); // Fallback to demo data for demo account

  const handleLogout = () => {
    // Logout handles redirect to login screen automatically
    logout();
  };

  const handleQuickAction = (action: string) => {
    if (action === 'reorder') {
      setShowCheckoutModal(true);
    } else if (action === 'support') {
      setShowSupportModal(true);
    } else if (action === 'leads') {
      // Navigate to CRM leads page
      router.push('/crm/leads');
    } else if (action === 'crm') {
      // Navigate to CRM dashboard
      router.push('/crm');
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between p-3 md:p-4 glass-effect"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Back button - icon only on mobile */}
        <button
          onClick={onBackToHome}
          className="flex items-center space-x-1 md:space-x-2 text-white/80 hover:text-white transition-colors min-w-fit"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="hidden md:inline text-sm">Home</span>
        </button>
        
        {/* Center - Title */}
        <div className="text-center flex-1 px-2">
          <h1 className="text-white font-bold text-base md:text-xl">Mijn Account</h1>
          <p className="text-white/60 text-xs md:text-sm hidden md:block">
            Welkom terug, {user?.name || (user?.isGuest ? 'Gast' : 'Gebruiker')}!
            {user?.isGuest && (
              <span className="block text-xs text-brand-pink mt-1">
                Gast account - <button 
                  onClick={() => {/* TODO: Show account creation */}}
                  className="underline hover:text-brand-orange"
                >
                  Maak account aan
                </button>
              </span>
            )}
          </p>
        </div>
        
        {/* Right buttons - compact on mobile */}
        <div className="flex items-center space-x-1 md:space-x-2 min-w-fit">
          <button
            onClick={() => setShowSupportModal(true)}
            className="chat-button px-2 py-2 md:px-4 md:py-2 text-xs md:text-sm"
            title="Support & Contact"
          >
            <span className="md:hidden">💬</span>
            <span className="hidden md:inline">💬 Support</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1 md:space-x-2 px-2 py-2 md:px-3 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-all"
            title="Uitloggen"
          >
            <UserIcon className="w-4 h-4" />
            <span className="text-xs md:text-sm hidden md:inline">Uitloggen</span>
          </button>
        </div>
      </motion.div>

      <div className="flex-1 p-4 space-y-6">
        {/* Account Summary */}
        <motion.div
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-white font-bold text-xl mb-4">Account overzicht</h2>
          
          {loadingCustomerData ? (
            // Loading skeleton
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="text-center">
                  <div className="w-16 h-16 bg-white/10 rounded-xl mx-auto mb-2 animate-pulse"></div>
                  <div className="h-4 bg-white/10 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : (recentOrders.length > 0 || (customerData?.leadData && customerData.leadData.length > 0)) ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {(() => {
                    if (customerData?.leadData && customerData.leadData.length > 0) {
                      return customerData.leadData.length.toLocaleString();
                    }
                    // Fallback to demo data for demo user
                    if (ADMIN_CONFIG.demoAccount && user?.email === ADMIN_CONFIG.demoAccount.email) {
                      return recentOrders.reduce((total: number, order: any) => total + (order.leads || 0), 0).toLocaleString();
                    }
                    return '0';
                  })()}
                </div>
                <div className="text-white/60 text-sm">Totaal Leads</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">
                  {(() => {
                    if (customerData?.leadData && customerData.leadData.length > 0) {
                      const revenueStats = calculateRevenueFromLeads(customerData.leadData);
                      return revenueStats.conversionRate.toFixed(1);
                    }
                    // Fallback to demo data for demo user
                    if (ADMIN_CONFIG.demoAccount && user?.email === ADMIN_CONFIG.demoAccount.email) {
                      const totalLeads = recentOrders.reduce((total: number, order: any) => total + (order.leads || 0), 0);
                      const totalConversions = recentOrders.reduce((total: number, order: any) => total + (order.conversions || 0), 0);
                      return totalLeads > 0 ? ((totalConversions / totalLeads) * 100).toFixed(1) : '0.0';
                    }
                    return '0.0';
                  })()}%
                </div>
                <div className="text-white/60 text-sm">Conversie Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">
                  {(() => {
                    if (customerData?.leadData && customerData.leadData.length > 0) {
                      const revenueStats = calculateRevenueFromLeads(customerData.leadData);
                      return formatRevenue(revenueStats.totalRevenue);
                    }
                    // Fallback to demo data for demo user
                    if (ADMIN_CONFIG.demoAccount && user?.email === ADMIN_CONFIG.demoAccount.email) {
                      return recentOrders.reduce((total: number, order: any) => {
                        const amount = parseFloat(order.amount.replace('€', '').replace('K', '000'));
                        return total + (isNaN(amount) ? 0 : amount);
                      }, 0).toLocaleString();
                    }
                    return '€0';
                  })()}
                </div>
                <div className="text-white/60 text-sm">Gegenereerde Omzet</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-400">
                  {(() => {
                    if (customerData?.leadData && customerData.leadData.length > 0) {
                      // Calculate total profit from closed deals
                      const totalProfit = customerData.leadData
                        .filter(lead => lead.status === 'deal_closed' && lead.profit)
                        .reduce((sum, lead) => sum + (lead.profit || 0), 0);
                      return formatRevenue(totalProfit);
                    }
                    return '€0';
                  })()}
                </div>
                <div className="text-white/60 text-sm">Gegenereerde Winst</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlusIcon className="w-8 h-8 text-white/60" />
              </div>
              <h3 className="text-white/80 text-lg font-medium mb-2">Start uw leadgeneratie reis</h3>
              <p className="text-white/60 text-sm">
                Maak uw eerste bestelling en zie hier uw resultaten verschijnen!
              </p>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {getQuickActions(user)
            .filter(action => {
              // Always show non-account actions (but check permissions for checkout)
              if (!action.requiresAccount) {
                // For reorder action, only show if user can checkout
                if (action.action === 'reorder') return user?.permissions?.canCheckout !== false;
                return true;
              }
              
              // For leads action, always show if authenticated (regardless of guest status)
              if (action.action === 'leads') return isAuthenticated;
              
              // For team management, only show if user can manage employees
              if (action.action === 'team') return user?.permissions?.canManageEmployees !== false;
              
              // For other account-required actions, show if user is authenticated and not a guest
              return isAuthenticated && user && !user.isGuest;
            })
            .map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.action}
                onClick={() => handleQuickAction(action.action)}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-left hover:bg-white/20 transition-all group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-1">{action.title}</h3>
                    <p className="text-white/70 text-sm">{action.description}</p>
                  </div>
                  <svg className="w-5 h-5 text-white/40 group-hover:text-white/80 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Recent Orders */}
        <motion.div
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-bold text-xl">Recente bestellingen</h2>
            <button
              onClick={onStartChat}
              className="text-brand-pink hover:text-brand-orange transition-colors text-sm"
            >
              Nieuwe bestelling →
            </button>
          </div>

          {loadingOrders ? (
            // Loading skeleton for orders
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <div className="h-4 bg-white/10 rounded animate-pulse mb-2"></div>
                      <div className="h-3 bg-white/5 rounded animate-pulse w-2/3"></div>
                    </div>
                    <div className="h-6 bg-white/10 rounded-full animate-pulse w-20"></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map((j) => (
                      <div key={j}>
                        <div className="h-3 bg-white/5 rounded animate-pulse mb-1"></div>
                        <div className="h-4 bg-white/10 rounded animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : recentOrders.length > 0 ? (
            <div className="space-y-4">
              {recentOrders.map((order: any, index: number) => (
                <motion.div
                  key={order.id}
                  onClick={() => {
                    // Find the full order object from orders state
                    const fullOrder = orders.find(o => o.orderNumber === order.id);
                    if (fullOrder) {
                      setSelectedOrder(fullOrder);
                    }
                  }}
                  className="bg-white/5 rounded-xl p-4 border border-white/10 cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-white font-medium">{order.type}</div>
                      <div className="text-white/60 text-sm">{order.id} • {order.date}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`
                        px-3 py-1 rounded-full text-xs font-medium
                        ${order.status === 'geleverd' 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }
                      `}>
                        {order.status === 'geleverd' ? (
                          <div className="flex items-center space-x-1">
                            <CheckCircleIcon className="w-3 h-3" />
                            <span>Geleverd</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <ClockIcon className="w-3 h-3" />
                            <span>Actief</span>
                          </div>
                        )}
                      </div>
                      {order.invoiceUrl && (
                        <a
                          href={order.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors flex items-center gap-1"
                          title="Download factuur (PDF)"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                          <span>Factuur</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-white/60">Leads</div>
                      <div className="text-white font-medium">{order.leads}/{order.quantity}</div>
                    </div>
                                         <div>
                       <div className="text-white/60">Conversies</div>
                       <div className="text-white font-medium">{order.conversions}</div>
                     </div>
                    <div>
                      <div className="text-white/60">Waarde</div>
                      <div className="text-white font-medium">{order.amount}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              className="text-center py-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlusIcon className="w-8 h-8 text-white/60" />
              </div>
              <h3 className="text-white/80 text-lg font-medium mb-2">Nog geen bestellingen</h3>
              <p className="text-white/60 text-sm mb-6">
                Maak uw eerste bestelling en begin met het genereren van leads!
              </p>
              <motion.button
                onClick={onStartChat}
                className="chat-button inline-flex items-center space-x-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <PlusIcon className="w-5 h-5" />
                <span>Eerste Bestelling via Lisa</span>
              </motion.button>
            </motion.div>
          )}
        </motion.div>


        {/* Leads section removed - now on dedicated page */}
      </div>
      
      {/* Order Checkout Modal */}
      <OrderCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        userEmail={user?.email || ''}
        userName={user?.name || ''}
        userCompany={user?.company}
        userPermissions={user?.permissions}
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
                      <h2 className="text-3xl font-bold">Betaling Gelukt! 🎉</h2>
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
                    Bekijk Mijn Bestellingen
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
