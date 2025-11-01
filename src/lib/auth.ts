import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserPermissions {
  canViewLeads: boolean;
  canViewOrders: boolean;
  canManageEmployees: boolean;
  canCheckout: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  company?: string;
  phone?: string;
  createdAt: Date;
  lastLogin: Date;
  isGuest: boolean;
  orders: Order[];
  
  // Employee system fields
  role?: 'owner' | 'employee';
  companyId?: string; // Email of the owner
  ownerEmail?: string; // Email of the owner
  permissions?: UserPermissions;
}

export interface Order {
  id: string;
  type: string;
  quantity: number;
  status: 'pending' | 'active' | 'delivered' | 'cancelled';
  date: string;
  amount: number;
  leads?: number;
  conversions?: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  loginAsGuest: (guestData: GuestData) => void;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
  createAccountFromGuest: (userData: RegisterData) => Promise<void>;
  clearError: () => void;
  init: () => void;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  company?: string;
  phone?: string;
}

export interface GuestData {
  email: string;
  name: string;
  company?: string;
  phone?: string;
}

export interface EmployeeAccount {
  email: string;
  name: string;
  role: 'employee';
  permissions: UserPermissions;
  invitedAt: string;
  acceptedAt?: string;
  isActive: boolean;
}

export interface Company {
  id: string;
  ownerEmail: string;
  companyName: string;
  employees: EmployeeAccount[];
  createdAt: string;
}

// All accounts are now stored in Supabase - no more hardcoded mock users

// Helper function to get default permissions for owners
const getDefaultOwnerPermissions = (): UserPermissions => ({
  canViewLeads: true,
  canViewOrders: true,
  canManageEmployees: true,
  canCheckout: true,
});

// Helper function to get default permissions for employees
const getDefaultEmployeePermissions = (): UserPermissions => ({
  canViewLeads: true,
  canViewOrders: true,
  canManageEmployees: false,
  canCheckout: false,
});

// Helper function to load employee/company data
const loadUserWithCompanyData = async (user: User): Promise<User> => {
  try {
    // If user has companyId/ownerEmail, load company data
    if (user.companyId || user.ownerEmail) {
      const companyResponse = await fetch(`/api/auth/company?ownerEmail=${encodeURIComponent(user.companyId || user.ownerEmail || '')}`);
      if (companyResponse.ok) {
        const companyData = await companyResponse.json();
        if (companyData.success && companyData.company) {
          // Merge company info into user
          user.company = user.company || companyData.company.companyName;
        }
      }
    }
    
    // Ensure permissions are set
    if (!user.permissions) {
      user.permissions = user.role === 'owner' 
        ? getDefaultOwnerPermissions() 
        : getDefaultEmployeePermissions();
    }
    
    return user;
  } catch (error) {
    console.error('Error loading company data:', error);
    // Return user with default permissions if loading fails
    if (!user.permissions) {
      user.permissions = user.role === 'owner' 
        ? getDefaultOwnerPermissions() 
        : getDefaultEmployeePermissions();
    }
    return user;
  }
};

// Simple auth store without complex state management
let authState = {
  user: null as User | null,
  isAuthenticated: false,
  isLoading: false,
  error: null as string | null,
};

// Listeners for state changes
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

export const useAuthStore = create<AuthState>()(
  (set, get) => ({
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    error: authState.error,

    login: async (email: string, password: string) => {
      console.log('🔐 LOGIN ATTEMPT:', { email });
      
      // Update local state
      authState.isLoading = true;
      authState.error = null;
      set({ isLoading: true, error: null });
      
      try {
        // Call Supabase login API
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Ongeldig emailadres of wachtwoord');
        }
        
        // Create user from API response
        let user: User = {
          id: data.user.email,
          email: data.user.email,
          name: data.user.name,
          company: data.user.company,
          phone: data.user.phone,
          createdAt: new Date(data.user.createdAt),
          lastLogin: new Date(),
          isGuest: false,
          orders: [],
          role: data.user.role || 'owner',
          companyId: data.user.companyId,
          ownerEmail: data.user.ownerEmail,
          permissions: data.user.permissions || getDefaultOwnerPermissions()
        };
        
        // Load company data and ensure permissions are set
        user = await loadUserWithCompanyData(user);
        
        console.log('🔐 LOGIN SUCCESS:', { email, isAuthenticated: true, role: user.role });
        
        // Update local state
        authState.user = user;
        authState.isAuthenticated = true;
        authState.isLoading = false;
        authState.error = null;
        
        set({ 
          user, 
          isAuthenticated: true, 
          isLoading: false,
          error: null 
        });
        
        notifyListeners();
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Login mislukt';
        
        // Update local state
        authState.error = errorMessage;
        authState.isLoading = false;
        
        set({ 
          error: errorMessage, 
          isLoading: false 
        });
        
        // IMPORTANT: Re-throw the error so LoginForm knows login failed
        throw error;
      }
    },

      register: async (userData: RegisterData) => {
        set({ isLoading: true, error: null });
        
        try {
          // Call real API to register in Blob Storage
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || 'Registratie mislukt');
          }
          
          const newUser: User = {
            id: data.user.email,
            email: data.user.email,
            name: data.user.name,
            company: data.user.company,
            phone: data.user.phone,
            createdAt: new Date(data.user.createdAt),
            lastLogin: new Date(),
            isGuest: false,
            orders: []
          };
          
          // ALSO add to CRM system so the customer appears in admin
          try {
            const { crmSystem } = await import('./crmSystem');
            
            // Use createOrUpdateCustomer to add/update in CRM
            const customer = await crmSystem.createOrUpdateCustomer({
              email: userData.email,
              name: userData.name,
              company: userData.company,
              phone: userData.phone,
              source: 'direct'
            });
            
            // Mark as having account
            await crmSystem.updateCustomer(customer.id, {
              hasAccount: true,
              accountCreatedAt: new Date()
            });
            
            console.log('✅ Customer synced to CRM system:', userData.email);
          } catch (crmError) {
            console.error('⚠️ Error syncing customer to CRM:', crmError);
            // Don't fail the registration if CRM sync fails
          }
          
          set({ 
            user: newUser, 
            isAuthenticated: true, 
            isLoading: false,
            error: null 
          });
          
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Registratie mislukt', 
            isLoading: false 
          });
          throw error;
        }
      },

      loginAsGuest: (guestData: GuestData) => {
        const guestUser: User = {
          id: `guest_${Date.now()}`,
          email: guestData.email,
          name: guestData.name,
          company: guestData.company,
          phone: guestData.phone,
          createdAt: new Date(),
          lastLogin: new Date(),
          isGuest: true,
          orders: []
        };
        
        set({ 
          user: guestUser, 
          isAuthenticated: true, 
          isLoading: false,
          error: null 
        });
      },

      logout: () => {
        console.log('🚨 EXPLICIT LOGOUT CALLED - Stack trace:', new Error().stack);
        console.log('🚨 Current state before logout:', authState);
        
        // Update local state
        authState.user = null;
        authState.isAuthenticated = false;
        authState.isLoading = false;
        authState.error = null;
        
        set({ 
          user: null, 
          isAuthenticated: false, 
          isLoading: false,
          error: null 
        });
        
        console.log('🚨 State after logout:', authState);
        notifyListeners();
      },

      updateProfile: (updates: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = { ...currentUser, ...updates };
          set({ user: updatedUser });
        }
      },

      createAccountFromGuest: async (userData: RegisterData) => {
        set({ isLoading: true, error: null });
        
        try {
          const currentUser = get().user;
          if (!currentUser?.isGuest) {
            throw new Error('Alleen gasten kunnen een account aanmaken');
          }
          
          // Use register API to create account in Supabase
          await get().register(userData);
          
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Account aanmaken mislukt', 
            isLoading: false 
          });
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      // Initialize auth state (no localStorage persistence)
      init: () => {
        // Auth state is managed server-side via Supabase JWT tokens
        // No client-side persistence needed
        console.log('🔄 Auth initialized - using Supabase sessions');
      }
    })
);
