'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check admin authentication
    const token = localStorage.getItem('warmeleads_admin_token');
    const adminUser = localStorage.getItem('warmeleads_admin_user');
    
    if (pathname === '/admin/login') {
      setIsLoading(false);
      return;
    }
    
    if (token === 'admin_authenticated' && adminUser) {
      setIsAuthenticated(true);
    } else {
      router.push('/admin/login');
    }
    
    setIsLoading(false);
  }, [router, pathname]);

  // Show login page
  if (pathname === '/admin/login') {
    return children;
  }

  // Show loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-brand-purple to-brand-pink rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">W</span>
          </div>
          <p className="text-gray-600">Admin wordt geladen...</p>
        </div>
      </div>
    );
  }

  // Show admin interface if authenticated
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="flex">
          {/* Sidebar */}
          <AdminSidebar />
          
          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Add left padding on mobile to account for hamburger */}
            <AdminHeader />
            <main className="flex-1 p-4 lg:p-6 pt-16 lg:pt-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  return null;
}
