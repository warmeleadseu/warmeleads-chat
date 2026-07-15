'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const FloatingWhatsAppButton = dynamic(
  () => import('@/components/FloatingWhatsAppButton').then((m) => m.FloatingWhatsAppButton),
  { ssr: false }
);

const CookieConsent = dynamic(
  () => import('@/components/CookieConsent').then((m) => m.CookieConsent),
  { ssr: false }
);

export function DeferredGlobals() {
  const [ready, setReady] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <>
      <FloatingWhatsAppButton />
      <CookieConsent />
    </>
  );
}

export default DeferredGlobals;
