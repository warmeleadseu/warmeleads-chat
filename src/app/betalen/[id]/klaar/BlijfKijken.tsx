'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Terug van Mollie: de webhook kan een paar seconden achterlopen. Een minuut lang opnieuw kijken. */
export default function BlijfKijken() {
  const router = useRouter();
  useEffect(() => {
    let keer = 0;
    const timer = setInterval(() => {
      keer++;
      if (keer > 15) { clearInterval(timer); return; }
      router.refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
