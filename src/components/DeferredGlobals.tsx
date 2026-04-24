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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    const mount = () => {
      if (!cancelled) setReady(true);
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(mount, { timeout: 2000 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }

    const timer = window.setTimeout(mount, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
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
