'use client';

import { useState, useEffect, useCallback } from 'react';
import { portalFetch } from '@/lib/portalAuth';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export type PushState = 'loading' | 'unsupported' | 'denied' | 'enabled' | 'disabled' | 'ios-not-installed';

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker niet beschikbaar');

  let reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  if (reg.active) return reg;

  return new Promise<ServiceWorkerRegistration>((resolve, reject) => {
    const installing = reg!.installing || reg!.waiting;
    if (!installing) {
      reject(new Error('Service Worker kon niet geactiveerd worden'));
      return;
    }

    const timeout = setTimeout(() => reject(new Error('Service Worker activering timeout')), 10000);

    installing.addEventListener('statechange', () => {
      if (installing.state === 'activated') {
        clearTimeout(timeout);
        resolve(reg!);
      } else if (installing.state === 'redundant') {
        clearTimeout(timeout);
        reject(new Error('Service Worker is redundant geworden'));
      }
    });
  });
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading');
  const [toggling, setToggling] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState('unsupported');
        return;
      }

      if (isIOSDevice() && !isStandaloneMode()) {
        setState('ios-not-installed');
        return;
      }

      if (!VAPID_PUBLIC_KEY) {
        console.warn('[Push] VAPID public key not configured');
        setState('unsupported');
        return;
      }

      const permission = Notification.permission;
      if (permission === 'denied') {
        setState('denied');
        return;
      }

      try {
        const reg = await Promise.race([
          ensureServiceWorker(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 8000)),
        ]);
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? 'enabled' : 'disabled');
      } catch (err) {
        console.warn('[Push] check failed:', err);
        setState('disabled');
      }
    }
    check();
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    setToggling(true);
    setLastError(null);
    try {
      if (!VAPID_PUBLIC_KEY) {
        setLastError('Push configuratie ontbreekt');
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        setLastError('Notificatie toestemming geweigerd');
        return false;
      }

      const reg = await ensureServiceWorker();

      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        try {
          await existingSub.unsubscribe();
        } catch { /* ignore */ }
      }

      const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const keyBuffer = new ArrayBuffer(keyBytes.length);
      new Uint8Array(keyBuffer).set(keyBytes);

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuffer,
      });

      const subJson = sub.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        setLastError('Ongeldige subscription data van browser');
        return false;
      }

      const res = await portalFetch('/api/portal/push-subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription: subJson }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setLastError(errData.error || 'Server kon subscription niet opslaan');
        return false;
      }

      setState('enabled');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Onbekende fout';
      console.error('[Push] enable error:', err);
      setLastError(msg);
      return false;
    } finally {
      setToggling(false);
    }
  }, []);

  const disable = useCallback(async (): Promise<boolean> => {
    setToggling(true);
    setLastError(null);
    try {
      const reg = await ensureServiceWorker();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await portalFetch('/api/portal/push-subscribe', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState('disabled');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Onbekende fout';
      console.error('[Push] disable error:', err);
      setLastError(msg);
      return false;
    } finally {
      setToggling(false);
    }
  }, []);

  const toggle = useCallback(async (): Promise<boolean> => {
    if (state === 'enabled') return disable();
    return enable();
  }, [state, enable, disable]);

  return { state, toggling, enable, disable, toggle, lastError };
}
