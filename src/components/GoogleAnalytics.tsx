'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';

const STORAGE_KEY = 'warmeleads-cookie-consent';

export function GoogleAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'accepted') {
        setConsented(true);
      }
    } catch {}

    function onConsentUpdate(e: Event) {
      if ((e as CustomEvent).detail === 'accepted') {
        setConsented(true);
      }
    }

    window.addEventListener('cookie-consent-update', onConsentUpdate);
    return () => window.removeEventListener('cookie-consent-update', onConsentUpdate);
  }, []);

  if (!consented) return null;

  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-PBJPRGK8VL"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-PBJPRGK8VL');
        `}
      </Script>
    </>
  );
}
