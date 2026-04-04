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

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading');
  const [toggling, setToggling] = useState(false);

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

      const permission = Notification.permission;
      if (permission === 'denied') {
        setState('denied');
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? 'enabled' : 'disabled');
      } catch {
        setState('disabled');
      }
    }
    check();
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    setToggling(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      const res = await portalFetch('/api/portal/push-subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (!res.ok) throw new Error('Subscription opslaan mislukt');
      setState('enabled');
      return true;
    } catch (err) {
      console.error('Push enable error:', err);
      return false;
    } finally {
      setToggling(false);
    }
  }, []);

  const disable = useCallback(async (): Promise<boolean> => {
    setToggling(true);
    try {
      const reg = await navigator.serviceWorker.ready;
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
      console.error('Push disable error:', err);
      return false;
    } finally {
      setToggling(false);
    }
  }, []);

  const toggle = useCallback(async (): Promise<boolean> => {
    if (state === 'enabled') return disable();
    return enable();
  }, [state, enable, disable]);

  return { state, toggling, enable, disable, toggle };
}
