/**
 * UNIFIED DATA SYNCHRONIZATION SERVICE
 * Dit zorgt ervoor dat CRM Dashboard en Leads Portal altijd identieke data hebben
 * 
 * Het probleem: Verschillende modules gebruiken verschillende data sources
 * De oplossing: Centralized data synchronization met real-time updates
 */

import React from 'react';
import type { Customer, Lead } from './crmSystem';

export interface UnifiedDataState {
  customer: Customer | null;
  leads: Lead[];
  branchAnalytics: any[];
  lastSync: Date | null;
  isLoading: boolean;
  error: string | null;
}

export type DataUpdateEvent = 'leads_changed' | 'customer_updated' | 'analytics_refreshed';

class DataSyncService {
  private subscribers: Map<DataUpdateEvent, Function[]> = new Map();
  private unifiedState: UnifiedDataState = {
    customer: null,
    leads: [],
    branchAnalytics: [],
    lastSync: null,
    isLoading: false,
    error: null
  };

  constructor() {
    // Initialize event listeners
    this.setupEventListeners();
  }

  // Subscribe to data updates
  subscribe(event: DataUpdateEvent, callback: Function) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event)!.push(callback);
  }

  // Unsubscribe from data updates
  unsubscribe(event: DataUpdateEvent, callback: Function) {
    const subs = this.subscribers.get(event);
    if (subs) {
      const index = subs.indexOf(callback);
      if (index > -1) {
        subs.splice(index, 1);
      }
    }
  }

  // Emit events to all subscribers
  private emit(event: DataUpdateEvent, data?: any) {
    const subs = this.subscribers.get(event);
    if (subs) {
      subs.forEach(callback => callback(data || this.unifiedState));
    }
  }

  // Get unified state (reactive)
  getState(): UnifiedDataState {
    return this.unifiedState;
  }

  // Force refresh all data from source of truth
  async refreshAllData(userEmail: string) {
    this.unifiedState.isLoading = true;
    this.unifiedState.error = null;

    try {
      console.log('🔄 DataSync: Starting unified data refresh for', userEmail);

      // 1. Try API first (Google Sheets linked customers)
      const apiCustomer = await this.fetchFromAPI(userEmail);
      
      if (apiCustomer) {
        console.log('✅ DataSync: API data loaded -', apiCustomer.leadData?.length, 'leads');
        await this.updateUnifiedData(apiCustomer);
      } else {
        // 2. Fallback to localStorage
        console.log('⚠️ DataSync: No API data, using localStorage');
        const localCustomer = await this.fetchFromLocalStorage(userEmail);
        
        if (localCustomer) {
          console.log('✅ DataSync: LocalStorage data loaded -', localCustomer.leadData?.length, 'leads');
          await this.updateUnifiedData(localCustomer);
        } else {
          throw new Error('No customer data found in any source');
        }
      }

      this.unifiedState.lastSync = new Date();
      this.emit('customer_updated', this.unifiedState);
      
    } catch (error) {
      console.error('❌ DataSync: Unified refresh failed:', error);
      this.unifiedState.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('customer_updated', this.unifiedState);
    } finally {
      this.unifiedState.isLoading = false;
    }
  }

  // Update unified data and notify subscribers
  private async updateUnifiedData(customer: Customer) {
    // Ensure customer data consistency
    if (!customer.leadData) {
      customer.leadData = [];
    }

    this.unifiedState.customer = customer;
    this.unifiedState.leads = [...customer.leadData]; // Shallow copy for reactivity

    // Generate branch analytics
    const { branchIntelligence } = await import('./branchIntelligence');
    if (customer.leadData.length > 0) {
      this.unifiedState.branchAnalytics = branchIntelligence.analyzeBranchPerformance(customer.leadData);
    } else {
      this.unifiedState.branchAnalytics = [];
    }

    console.log('🔄 DataSync: Data updated -', 
      'Customer:', customer.name, 
      'Leads:', this.unifiedState.leads.length,
      'Analytics branches:', this.unifiedState.branchAnalytics.length
    );

    // Notify all subscribers
    this.emit('leads_changed', this.unifiedState);
  }

  // Add new lead (synchronized across all modules)
  async addLead(leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!this.unifiedState.customer) {
      throw new Error('No customer data available');
    }

    console.log('➕ DataSync: Adding new lead:', leadData.name);
    
    // Add to CRM system
    const { crmSystem } = await import('./crmSystem');
    await crmSystem.addLeadToCustomer(this.unifiedState.customer.id, leadData);

    // Trigger refresh to get updated data
    await this.refreshAllData(this.unifiedState.customer.email);
    
    console.log('✅ DataSync: Lead added and data synced');
  }

  // Update lead (synchronized across all modules)
  async updateLead(leadId: string, updates: Partial<Lead>) {
    if (!this.unifiedState.customer) {
      throw new Error('No customer data available');
    }

    console.log('🔄 DataSync: Updating lead:', leadId);
    
    // Update in CRM system
    const { crmSystem } = await import('./crmSystem');
    crmSystem.updateCustomerLead(this.unifiedState.customer.id, leadId, updates);

    // Trigger refresh to get updated data
    await this.refreshAllData(this.unifiedState.customer.email);
    
    console.log('✅ DataSync: Lead updated and data synced');
  }

  // Delete lead (synchronized across all modules)
  async deleteLead(leadId: string) {
    if (!this.unifiedState.customer) {
      throw new Error('No customer data available');
    }

    console.log('🗑️ DataSync: Deleting lead:', leadId);
    
    // Remove from CRM system
    const { crmSystem } = await import('./crmSystem');
    crmSystem.removeLeadFromCustomer(this.unifiedState.customer.id, leadId);

    // Trigger refresh to get updated data
    await this.refreshAllData(this.unifiedState.customer.email);
    
    console.log('✅ DataSync: Lead deleted and data synced');
  }

  // Fetch from API (Google Sheets linked)
  private async fetchFromAPI(userEmail: string): Promise<Customer | null> {
    try {
      const response = await fetch('/api/customer-data', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        return data as Customer;
      }
      
      return null;
    } catch (error) {
      console.log('API fetch failed, will use localStorage fallback');
      return null;
    }
  }

  // Fetch from localStorage
  private async fetchFromLocalStorage(userEmail: string): Promise<Customer | null> {
    try {
      const { crmSystem } = require('./crmSystem');
      const customers = await crmSystem.getAllCustomers();
      return customers.find((c: Customer) => c.email === userEmail) || null;
    } catch (error) {
      console.error('LocalStorage fetch failed:', error);
      return null;
    }
  }

  // Setup cross-module event listeners
  private setupEventListeners() {
    // Listen for localStorage changes (other tabs/windows)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key?.includes('customer-data') && !e.newValue) {
          // Customer data was cleared, trigger refresh
          console.log('📡 DataSync: Storage change detected, triggering refresh');
          // Trigger refresh for current user if known
          if (this.unifiedState.customer) {
            this.refreshAllData(this.unifiedState.customer.email);
          }
        }
      });
    }
  }

  // Diagnostic info for debugging
  getDiagnosticInfo() {
    return {
      state: this.unifiedState,
      subscribers: Object.fromEntries(this.subscribers),
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const dataSyncService = new DataSyncService();

// Hook voor React components om data sync te gebruiken
export function useDataSync(userEmail?: string) {
  const [state, setState] = React.useState(dataSyncService.getState());

  React.useEffect(() => {
    // Subscribe to all data updates
    const handleUpdate = (newState: UnifiedDataState) => setState(newState);
    
    dataSyncService.subscribe('leads_changed', handleUpdate);
    dataSyncService.subscribe('customer_updated', handleUpdate);
    dataSyncService.subscribe('analytics_refreshed', handleUpdate);

    // Initial data load if user email provided
    if (userEmail && !state.customer) {
      dataSyncService.refreshAllData(userEmail);
    }

    return () => {
      dataSyncService.unsubscribe('leads_changed', handleUpdate);
      dataSyncService.unsubscribe('customer_updated', handleUpdate);
      dataSyncService.unsubscribe('analytics_refreshed', handleUpdate);
    };
  }, [userEmail]);

  return {
    ...state,
    addLead: (leadData: any) => dataSyncService.addLead(leadData),
    updateLead: (leadId: string, updates: any) => dataSyncService.updateLead(leadId, updates),
    deleteLead: (leadId: string) => dataSyncService.deleteLead(leadId),
    refresh: () => userEmail ? dataSyncService.refreshAllData(userEmail) : Promise.resolve(),
    diagnostic: () => dataSyncService.getDiagnosticInfo()
  };
}
