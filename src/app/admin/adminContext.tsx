'use client';

import { createContext, useContext } from 'react';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_account_manager?: boolean;
  avatar_url?: string | null;
}

export interface AdminCtx {
  user: AdminUser;
  logout: () => void;
}

export const AdminContext = createContext<AdminCtx | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside AdminLayout');
  return ctx;
}
