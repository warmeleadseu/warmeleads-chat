'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminAuth';

/**
 * Pushmeldingen in het admin-paneel voor terugbelafspraken (migratie 203).
 * Gebruikt dezelfde service worker als het portaal (/sw.js); een aanmelding die
 * er al is, wordt hergebruikt en aan deze admin gekoppeld.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export type AdminPushState = 'loading' | 'unsupported' | 'denied' | 'enabled' | 'disabled' | 'ios-not-installed';

function sleutel(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const buf = new ArrayBuffer(raw.length);
  const v = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) v[i] = raw.charCodeAt(i);
  return buf;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

async function registratie(): Promise<ServiceWorkerRegistration> {
  const reg = (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
  if (reg.active) return reg;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, nee) => setTimeout(() => nee(new Error('Service worker start niet')), 10_000)),
  ]);
}

/** Koppelt een bestaande aanmelding in deze browser aan de ingelogde admin. */
export async function koppelBestaandeAanmelding(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return false;
    const sub = await (await navigator.serviceWorker.getRegistration('/'))?.pushManager?.getSubscription();
    if (!sub) return false;
    const res = await adminFetch('/api/admin/push-subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON() }) });
    return res.ok;
  } catch {
    return false;
  }
}

export function useAdminPush() {
  const [state, setState] = useState<AdminPushState>('loading');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) { setState('unsupported'); return; }
    if (isIOS() && !isStandalone()) { setState('ios-not-installed'); return; }
    if (Notification.permission === 'denied') { setState('denied'); return; }
    if (Notification.permission !== 'granted') { setState('disabled'); return; }
    void koppelBestaandeAanmelding().then(ok => setState(ok ? 'enabled' : 'disabled'));
  }, []);

  const zetAan = useCallback(async (): Promise<boolean> => {
    setBezig(true);
    setFout(null);
    try {
      const toestemming = await Notification.requestPermission();
      if (toestemming !== 'granted') { setState('denied'); setFout('Meldingen zijn geweigerd in deze browser'); return false; }
      const reg = await registratie();
      const sub = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: sleutel(VAPID_PUBLIC_KEY) }));
      const res = await adminFetch('/api/admin/push-subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (!res.ok) { setFout('Opslaan mislukt, probeer het opnieuw'); return false; }
      setState('enabled');
      return true;
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Aanzetten mislukt');
      return false;
    } finally {
      setBezig(false);
    }
  }, []);

  return { state, bezig, fout, zetAan };
}
