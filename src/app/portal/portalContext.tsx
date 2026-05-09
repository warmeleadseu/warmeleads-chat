'use client';

import { createContext, useContext } from 'react';

export interface PortalCustomer {
  id: string;
  name: string;
  email: string;
  contact_person: string;
  branches: string[];
  demo_mode: boolean;
  /** Zelfservice website-registratie */
  signup_source?: string | null;
  /** Server-berekend: demo-ervaring tot eerste betaalde customer_batch */
  show_demo_portal?: boolean;
  has_paid_customer_batch?: boolean;
}

export interface ClientPortalUser {
  id: string;
  customer_id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'agent';
  permissions: string[];
  phone: string | null;
}

export interface PortalCtx {
  customer: PortalCustomer;
  portalUser: ClientPortalUser | null;
  isOwner: boolean;
  hasPermission: (perm: string) => boolean;
  logout: () => void;
}

export const PortalContext = createContext<PortalCtx | null>(null);

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used inside PortalLayout');
  return ctx;
}
