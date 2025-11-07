/**
 * NEW Supabase-based CRM System
 * Replaces localStorage with Supabase database
 * 
 * MIGRATION STRATEGY:
 * - All customer data now in Supabase customers table
 * - Chat messages in chat_messages table
 * - Orders in orders table
 * - NO MORE localStorage usage
 */

import { createClient } from '@supabase/supabase-js';

// Types (keep existing interfaces)
export interface ChatMessage {
  id: string;
  type: 'lisa' | 'user';
  content: string;
  timestamp: Date;
  step?: string;
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  company?: string;
  createdAt: Date;
  lastActivity: Date;
  status: 'lead' | 'contacted' | 'customer' | 'inactive';
  source: 'chat' | 'direct' | 'landing_page';
  chatHistory: ChatMessage[];
  orders: Order[];
  openInvoices: OpenInvoice[];
  dataHistory: DataChange[];
  hasAccount: boolean;
  accountCreatedAt?: Date;
  googleSheetId?: string;
  googleSheetUrl?: string;
  leadData?: Lead[];
  emailNotifications?: {
    enabled: boolean;
    newLeads: boolean;
    lastNotificationSent?: Date;
  };
  branch_id?: string; // Branch Configuration System
  branch_config_version?: number;
  portalLeadGoal?: number;
  portalGoalFrequency?: 'maand' | 'kwartaal' | string | null;
  portalGoalUpdatedAt?: Date;
}

export interface Order {
  id: string;
  customerId: string;
  industry: string;
  leadType: 'exclusive' | 'shared';
  quantity: number;
  amount: number;
  status: 'pending' | 'paid' | 'delivered' | 'cancelled';
  createdAt: Date;
  paidAt?: Date;
  deliveredAt?: Date;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
}

export interface OpenInvoice {
  id: string;
  customerId: string;
  industry: string;
  leadType: string;
  quantity: string;
  amount: string;
  createdAt: Date;
  lastReminderSent?: Date;
  reminderCount: number;
  status: 'draft' | 'sent' | 'overdue' | 'abandoned';
}

export interface DataChange {
  field: string;
  oldValue: string | undefined;
  newValue: string;
  timestamp: Date;
  source: 'chat' | 'form' | 'admin';
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  address?: string;
  city?: string;
  interest: string;
  budget?: string;
  timeline?: string;
  notes?: string;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'converted' | 'deal_closed' | 'lost';
  dealValue?: number;
  profit?: number;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  source: 'campaign' | 'manual' | 'import';
  sheetRowNumber?: number;
  branchData?: any;
}

// Helper to get Supabase client (CLIENT-SIDE - uses anon key)
function getSupabaseClient() {
  // For client-side, use the public anon key
  const supabaseUrl = typeof window !== 'undefined' 
    ? (window as any).ENV?.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    : process.env.NEXT_PUBLIC_SUPABASE_URL;
    
  const supabaseAnonKey = typeof window !== 'undefined'
    ? (window as any).ENV?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase config:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!supabaseAnonKey,
      url: supabaseUrl?.substring(0, 30),
      isWindow: typeof window !== 'undefined'
    });
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Transform Supabase customer data to Customer interface
 */
function transformSupabaseCustomer(data: any): Customer {
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    phone: data.phone,
    company: data.company,
    status: data.status,
    source: data.source,
    hasAccount: data.has_account,
    accountCreatedAt: data.account_created_at ? new Date(data.account_created_at) : undefined,
    googleSheetId: data.google_sheet_id,
    googleSheetUrl: data.google_sheet_url,
    branch_id: data.branch_id,
    branch_config_version: data.branch_config_version,
    portalLeadGoal: data.portal_lead_goal ?? undefined,
    portalGoalFrequency: data.portal_goal_frequency ?? null,
    portalGoalUpdatedAt: data.portal_goal_updated_at ? new Date(data.portal_goal_updated_at) : undefined,
    emailNotifications: {
      enabled: data.email_notifications_enabled,
      newLeads: data.email_notifications_new_leads,
      lastNotificationSent: data.last_notification_sent ? new Date(data.last_notification_sent) : undefined
    },
    createdAt: new Date(data.created_at),
    lastActivity: new Date(data.last_activity),
    chatHistory: (data.chat_messages || []).map((msg: any) => ({
      id: msg.id,
      type: msg.type,
      content: msg.content,
      step: msg.step,
      timestamp: new Date(msg.timestamp)
    })),
    orders: (data.orders || []).map((order: any) => ({
      id: order.id,
      customerId: order.customer_id,
      industry: order.industry,
      leadType: order.lead_type,
      quantity: order.quantity,
      amount: order.total_amount,
      status: order.status,
      createdAt: new Date(order.created_at),
      paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
      deliveredAt: order.delivered_at ? new Date(order.delivered_at) : undefined,
      stripeSessionId: order.stripe_session_id,
      stripePaymentIntentId: order.stripe_payment_intent_id
    })),
    openInvoices: (data.open_invoices || []).map((inv: any) => ({
      id: inv.id,
      customerId: inv.customer_id,
      industry: inv.industry,
      leadType: inv.lead_type,
      quantity: inv.quantity.toString(),
      amount: inv.amount.toString(),
      createdAt: new Date(inv.created_at),
      lastReminderSent: inv.last_reminder_sent ? new Date(inv.last_reminder_sent) : undefined,
      reminderCount: inv.reminder_count,
      status: inv.status
    })),
    dataHistory: (data.data_changes || []).map((change: any) => ({
      field: change.field,
      oldValue: change.old_value,
      newValue: change.new_value,
      timestamp: new Date(change.timestamp),
      source: change.source
    })),
    leadData: (data.leads || []).map((lead: any) => ({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      address: lead.address,
      city: lead.city,
      interest: lead.interest,
      budget: lead.budget,
      timeline: lead.timeline,
      notes: lead.notes,
      status: lead.status,
      dealValue: lead.deal_value,
      profit: lead.profit,
      assignedTo: lead.assigned_to,
      createdAt: new Date(lead.created_at),
      updatedAt: new Date(lead.updated_at),
      source: lead.source,
      sheetRowNumber: lead.sheet_row_number,
      branchData: lead.lead_branch_data?.[0] || {}
    }))
  };
}

class CRMSystem {
  /**
   * Create or update customer
   * NO MORE localStorage - direct Supabase insert/update
   */
  async createOrUpdateCustomer(data: {
    email?: string;
    name?: string;
    phone?: string;
    company?: string;
    source?: 'chat' | 'direct' | 'landing_page';
  }): Promise<Customer> {
    const supabase = getSupabaseClient();
    
    if (!data.email) {
      throw new Error('Email is required to create/update customer');
    }

    // Check if customer exists
    const { data: existing } = await supabase
      .from('customers')
      .select('*')
      .eq('email', data.email)
      .single();

    if (existing) {
      // Update existing customer
      const updates: any = {
        last_activity: new Date().toISOString()
      };
      
      if (data.name && data.name !== existing.name) {
        updates.name = data.name;
        
        // Log data change
        await supabase.from('data_changes').insert({
          customer_id: existing.id,
          field: 'name',
          old_value: existing.name,
          new_value: data.name,
          source: 'form'
        });
      }
      
      if (data.phone && data.phone !== existing.phone) {
        updates.phone = data.phone;
        
        await supabase.from('data_changes').insert({
          customer_id: existing.id,
          field: 'phone',
          old_value: existing.phone,
          new_value: data.phone,
          source: 'form'
        });
      }
      
      if (data.company && data.company !== existing.company) {
        updates.company = data.company;
        
        await supabase.from('data_changes').insert({
          customer_id: existing.id,
          field: 'company',
          old_value: existing.company,
          new_value: data.company,
          source: 'form'
        });
      }

      await supabase
        .from('customers')
        .update(updates)
        .eq('id', existing.id);

      // Fetch updated customer with relations
      const { data: updated } = await supabase
        .from('customers')
        .select(`
          *,
          chat_messages(*),
          orders(*),
          open_invoices(*),
          data_changes(*),
          leads(*, lead_branch_data(*))
        `)
        .eq('id', existing.id)
        .single();

      return transformSupabaseCustomer(updated);
    } else {
      // Create new customer
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          email: data.email,
          name: data.name,
          phone: data.phone,
          company: data.company,
          status: 'lead',
          source: data.source || 'chat',
          has_account: false
        })
        .select(`
          *,
          chat_messages(*),
          orders(*),
          open_invoices(*),
          data_changes(*),
          leads(*, lead_branch_data(*))
        `)
        .single();

      if (error) {
        console.error('❌ Error creating customer:', error);
        throw error;
      }

      return transformSupabaseCustomer(newCustomer);
    }
  }

  /**
   * Log chat message to database
   */
  async logChatMessage(customerEmail: string, message: ChatMessage): Promise<void> {
    const supabase = getSupabaseClient();
    
    // Get customer ID
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customerEmail)
      .single();

    if (!customer) {
      console.warn(`⚠️  Customer not found: ${customerEmail}`);
      return;
    }

    // Insert chat message
    await supabase.from('chat_messages').insert({
      customer_id: customer.id,
      type: message.type,
      content: message.content,
      step: message.step,
      timestamp: message.timestamp.toISOString()
    });

    // Update last activity
    await supabase
      .from('customers')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', customer.id);
  }

  /**
   * Create open invoice
   */
  async createOpenInvoice(customerEmail: string, invoiceData: {
    industry: string;
    leadType: string;
    quantity: string;
    amount: string;
  }): Promise<OpenInvoice> {
    const supabase = getSupabaseClient();
    
    // Get or create customer
    const customer = await this.createOrUpdateCustomer({ email: customerEmail });

    // Insert invoice
    const { data: invoice, error } = await supabase
      .from('open_invoices')
      .insert({
        customer_id: customer.id,
        customer_email: customerEmail,
        industry: invoiceData.industry,
        lead_type: invoiceData.leadType,
        quantity: parseInt(invoiceData.quantity.match(/\d+/)?.[0] || '0'),
        amount: parseFloat(invoiceData.amount.replace(/[€.,]/g, '')) || 0,
        status: 'draft',
        reminder_count: 0
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating invoice:', error);
      throw error;
    }

    return {
      id: invoice.id,
      customerId: invoice.customer_id,
      industry: invoice.industry,
      leadType: invoice.lead_type,
      quantity: invoice.quantity.toString(),
      amount: invoice.amount.toString(),
      createdAt: new Date(invoice.created_at),
      reminderCount: invoice.reminder_count,
      status: invoice.status
    };
  }

  /**
   * Convert open invoice to paid order
   */
  async convertInvoiceToOrder(invoiceId: string, stripeData: {
    sessionId?: string;
    paymentIntentId?: string;
  }): Promise<Order | null> {
    const supabase = getSupabaseClient();

    // Get invoice
    const { data: invoice } = await supabase
      .from('open_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      return null;
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: `WL-${Date.now()}`,
        customer_id: invoice.customer_id,
        customer_email: invoice.customer_email,
        customer_name: 'Customer', // TODO: Get from customer
        package_id: 'custom',
        package_name: invoice.industry,
        industry: invoice.industry,
        lead_type: invoice.lead_type.toLowerCase().includes('exclusief') ? 'exclusive' : 'shared',
        quantity: invoice.quantity,
        price_per_lead: Math.round(invoice.amount / invoice.quantity),
        total_amount: invoice.amount,
        vat_amount: Math.round(invoice.amount * 0.21),
        total_amount_incl_vat: Math.round(invoice.amount * 1.21),
        status: 'completed',
        payment_status: 'paid',
        payment_method: 'stripe',
        stripe_session_id: stripeData.sessionId,
        stripe_payment_intent_id: stripeData.paymentIntentId,
        paid_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError) {
      console.error('❌ Error creating order:', orderError);
      throw orderError;
    }

    // Delete open invoice
    await supabase
      .from('open_invoices')
      .delete()
      .eq('id', invoiceId);

    // Update customer status
    await supabase
      .from('customers')
      .update({ 
        status: 'customer',
        last_activity: new Date().toISOString()
      })
      .eq('id', invoice.customer_id);

    return {
      id: order.id,
      customerId: order.customer_id,
      industry: order.industry,
      leadType: order.lead_type,
      quantity: order.quantity,
      amount: order.total_amount,
      status: order.status,
      createdAt: new Date(order.created_at),
      paidAt: new Date(order.paid_at),
      stripeSessionId: order.stripe_session_id,
      stripePaymentIntentId: order.stripe_payment_intent_id
    };
  }

  /**
   * Get all customers
   */
  async getAllCustomers(): Promise<Customer[]> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        chat_messages(*),
        orders(*),
        open_invoices(*),
        data_changes(*),
        leads(*, lead_branch_data(*))
      `)
      .order('last_activity', { ascending: false });

    if (error) {
      console.error('❌ Error fetching customers:', error);
      return [];
    }

    return (data || []).map(transformSupabaseCustomer);
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<Customer | null> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        chat_messages(*),
        orders(*),
        open_invoices(*),
        data_changes(*),
        leads(*, lead_branch_data(*))
      `)
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('❌ Error fetching customer:', error);
      return null;
    }

    return transformSupabaseCustomer(data);
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(email: string): Promise<Customer | null> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        chat_messages(*),
        orders(*),
        open_invoices(*),
        data_changes(*),
        leads(*, lead_branch_data(*))
      `)
      .eq('email', email)
      .single();

    if (error || !data) {
      return null;
    }

    return transformSupabaseCustomer(data);
  }

  /**
   * Update customer
   */
  async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    const dbUpdates: any = {
      last_activity: new Date().toISOString()
    };
    
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.company !== undefined) dbUpdates.company = updates.company;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.hasAccount !== undefined) dbUpdates.has_account = updates.hasAccount;
    if (updates.googleSheetUrl !== undefined) dbUpdates.google_sheet_url = updates.googleSheetUrl;
    
    const { error } = await supabase
      .from('customers')
      .update(dbUpdates)
      .eq('id', customerId);

    return !error;
  }

  /**
   * Get customers with open invoices
   */
  async getCustomersWithOpenInvoices(): Promise<Customer[]> {
    const customers = await this.getAllCustomers();
    return customers.filter(c => c.openInvoices.length > 0);
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(): Promise<{ customer: Customer; invoice: OpenInvoice }[]> {
    const customers = await this.getAllCustomers();
    const overdueList: { customer: Customer; invoice: OpenInvoice }[] = [];
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const customer of customers) {
      for (const invoice of customer.openInvoices) {
        if (new Date(invoice.createdAt) < oneDayAgo && invoice.status !== 'abandoned') {
          overdueList.push({ customer, invoice });
        }
      }
    }

    return overdueList.sort((a, b) => 
      new Date(a.invoice.createdAt).getTime() - new Date(b.invoice.createdAt).getTime()
    );
  }

  /**
   * Mark reminder sent
   */
  async markReminderSent(invoiceId: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    await supabase
      .from('open_invoices')
      .update({
        last_reminder_sent: new Date().toISOString(),
        reminder_count: supabase.rpc('increment', { row_id: invoiceId }),
        status: 'sent'
      })
      .eq('id', invoiceId);
  }

  /**
   * Update customer status
   */
  async updateCustomerStatus(customerId: string, status: Customer['status']): Promise<void> {
    await this.updateCustomer(customerId, { status });
  }

  /**
   * Create account
   */
  async createAccount(customerId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('customers')
      .update({
        has_account: true,
        account_created_at: new Date().toISOString(),
        status: 'customer',
        last_activity: new Date().toISOString()
      })
      .eq('id', customerId);

    if (!error) {
      // Log data change
      await supabase.from('data_changes').insert({
        customer_id: customerId,
        field: 'hasAccount',
        old_value: 'false',
        new_value: 'true',
        source: 'admin'
      });
    }

    return !error;
  }

  /**
   * Link Google Sheet
   */
  async linkGoogleSheet(customerId: string, sheetUrl: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    // Extract sheet ID
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return false;
    }

    const sheetId = match[1];
    
    const { error } = await supabase
      .from('customers')
      .update({
        google_sheet_id: sheetId,
        google_sheet_url: sheetUrl,
        last_activity: new Date().toISOString()
      })
      .eq('id', customerId);

    if (!error) {
      // Log data change
      await supabase.from('data_changes').insert({
        customer_id: customerId,
        field: 'googleSheetId',
        old_value: null,
        new_value: sheetId,
        source: 'admin'
      });
    }

    return !error;
  }

  /**
   * Add lead to customer
   */
  async addLeadToCustomer(customerId: string, leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead | null> {
    const supabase = getSupabaseClient();
    
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        customer_id: customerId,
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
        deal_value: leadData.dealValue,
        profit: leadData.profit,
        assigned_to: leadData.assignedTo,
        source: leadData.source,
        sheet_row_number: leadData.sheetRowNumber
      })
      .select()
      .single();

    if (leadError) {
      console.error('❌ Error adding lead:', leadError);
      return null;
    }

    // Add branch data if exists
    if (leadData.branchData && Object.keys(leadData.branchData).length > 0) {
      await supabase.from('lead_branch_data').insert({
        lead_id: lead.id,
        data: leadData.branchData
      });
    }

    // Update customer last activity
    await supabase
      .from('customers')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', customerId);

    return {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      address: lead.address,
      city: lead.city,
      interest: lead.interest,
      budget: lead.budget,
      timeline: lead.timeline,
      notes: lead.notes,
      status: lead.status,
      dealValue: lead.deal_value,
      profit: lead.profit,
      assignedTo: lead.assigned_to,
      createdAt: new Date(lead.created_at),
      updatedAt: new Date(lead.updated_at),
      source: lead.source,
      sheetRowNumber: lead.sheet_row_number,
      branchData: leadData.branchData
    };
  }

  /**
   * Update lead
   */
  async updateCustomerLead(customerId: string, leadId: string, updates: Partial<Lead>): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    const dbUpdates: any = {
      updated_at: new Date().toISOString()
    };
    
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.notes) dbUpdates.notes = updates.notes;
    if (updates.dealValue !== undefined) dbUpdates.deal_value = updates.dealValue;
    if (updates.profit !== undefined) dbUpdates.profit = updates.profit;
    
    const { error } = await supabase
      .from('leads')
      .update(dbUpdates)
      .eq('id', leadId)
      .eq('customer_id', customerId);

    if (!error && updates.branchData) {
      // Update branch data
      await supabase
        .from('lead_branch_data')
        .update({ data: updates.branchData })
        .eq('lead_id', leadId);
    }

    return !error;
  }

  /**
   * Remove lead
   */
  async removeLeadFromCustomer(customerId: string, leadId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('customer_id', customerId);

    return !error;
  }

  /**
   * Get customers with accounts
   */
  async getCustomersWithAccounts(): Promise<Customer[]> {
    const customers = await this.getAllCustomers();
    return customers.filter(c => c.hasAccount);
  }

  /**
   * Get customers without accounts
   */
  async getCustomersWithoutAccounts(): Promise<Customer[]> {
    const customers = await this.getAllCustomers();
    return customers.filter(c => !c.hasAccount);
  }

  /**
   * Get analytics
   */
  async getAnalytics() {
    const customers = await this.getAllCustomers();
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.status !== 'inactive').length;
    const customersWithAccounts = customers.filter(c => c.hasAccount).length;
    const totalOrders = customers.reduce((sum, c) => sum + c.orders.length, 0);
    const totalRevenue = customers.reduce((sum, c) => 
      sum + c.orders.reduce((orderSum, o) => orderSum + o.amount, 0), 0
    );
    const openInvoices = customers.reduce((sum, c) => sum + c.openInvoices.length, 0);
    const overdueInvoices = (await this.getOverdueInvoices()).length;
    const totalLeads = customers.reduce((sum, c) => sum + (c.leadData?.length || 0), 0);

    return {
      totalCustomers,
      activeCustomers,
      customersWithAccounts,
      customersWithoutAccounts: totalCustomers - customersWithAccounts,
      totalOrders,
      totalRevenue,
      openInvoices,
      overdueInvoices,
      totalLeads,
      conversionRate: totalCustomers > 0 ? (totalOrders / totalCustomers * 100) : 0
    };
  }
}

// Singleton instance
export const crmSystem = new CRMSystem();

// Helper functions for easy access (now async)
export const logChatMessage = (customerEmail: string, message: ChatMessage) => {
  return crmSystem.logChatMessage(customerEmail, message);
};

export const createOrUpdateCustomer = (data: Parameters<typeof crmSystem.createOrUpdateCustomer>[0]) => {
  return crmSystem.createOrUpdateCustomer(data);
};

export const createOpenInvoice = (customerEmail: string, invoiceData: Parameters<typeof crmSystem.createOpenInvoice>[1]) => {
  return crmSystem.createOpenInvoice(customerEmail, invoiceData);
};

export const getAllCustomers = () => {
  return crmSystem.getAllCustomers();
};

export const getCustomersWithOpenInvoices = () => {
  return crmSystem.getCustomersWithOpenInvoices();
};

export const getOverdueInvoices = () => {
  return crmSystem.getOverdueInvoices();
};

export const getCRMAnalytics = () => {
  return crmSystem.getAnalytics();
};
