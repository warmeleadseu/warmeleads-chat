'use client';

import dynamic from 'next/dynamic';
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';

// Lazy load heavy components
const CustomerPortal = dynamic(() => import('@/components/CustomerPortal').then(mod => mod.CustomerPortal), {
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <span className="text-white font-bold text-3xl">W</span>
        </div>
        <p className="text-white text-lg">Portal wordt geladen...</p>
      </div>
    </div>
  ),
  ssr: false
});

const EmployeeSetupModal = dynamic(() => import('@/components/EmployeeSetupModal').then(mod => mod.EmployeeSetupModal), {
  ssr: false
});

function PortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout, init, isAuthenticated } = useAuthStore();
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupEmail, setSetupEmail] = useState<string>('');

  // Initialize auth state on portal load
  React.useEffect(() => {
    init();
  }, [init]);

  // Check for setup parameter
  React.useEffect(() => {
    const setupParam = searchParams.get('setup');
    if (setupParam && !isAuthenticated) {
      setSetupEmail(decodeURIComponent(setupParam));
      setShowSetupModal(true);
    }
  }, [searchParams, isAuthenticated]);

  const handleBackToHome = () => {
    // Navigate to homepage WITHOUT logging out - user stays logged in
    console.log('🏠 Portal: Navigating to home, user should stay logged in');
    router.push('/');
  };

  const handleStartChat = () => {
    router.push('/?chat=direct');
  };

  const handleSetupSuccess = () => {
    setShowSetupModal(false);
    // Redirect to clean URL without setup parameter
    router.push('/portal');
  };

  const handleSetupClose = () => {
    setShowSetupModal(false);
    // Redirect to clean URL without setup parameter
    router.push('/portal');
  };

  return (
    <>
      <CustomerPortal onBackToHome={handleBackToHome} onStartChat={handleStartChat} />
      
      {showSetupModal && setupEmail && (
        <EmployeeSetupModal
          isOpen={showSetupModal}
          onClose={handleSetupClose}
          employeeEmail={setupEmail}
          onSuccess={handleSetupSuccess}
        />
      )}
    </>
  );
}

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PortalContent />
    </Suspense>
  );
}