'use client';

import { createContext, useContext } from 'react';

export interface PortalCustomer {
  id: string;
  name: string;
  email: string;
  contact_person: string;
  branches: string[];
  demo_mode: boolean;
}

export interface PortalCtx {
  customer: PortalCustomer;
  logout: () => void;
}

export const PortalContext = createContext<PortalCtx | null>(null);

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used inside PortalLayout');
  return ctx;
}
