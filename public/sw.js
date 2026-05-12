/**
 * WarmeLeads service worker v4 — alleen push + cache-opruiming.
 * Geen fetch-handler: voorkomt conflicten met Next.js chunks/RSC en verouderde SW in browsers.
 */
const CACHE_VERSION = 'warmeleads-v4-push-only';

self.addEventListener('install', () => {
  console.info('[WL SW] install', CACHE_VERSION, self.location.origin);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.map((name) => {
            if (!name.startsWith('warmeleads-')) return Promise.resolve();
            return caches.delete(name);
          }),
        ),
      )
      .then(() => self.clients.claim())
      .then(() => console.info('[WL SW] activate: oude warmeleads-caches gewist', CACHE_VERSION)),
  );
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'WarmeLeads';
  const options = {
    body: data.body || 'Je hebt een nieuwe notificatie',
    icon: '/icons/icon-192x192.png',
    badge: '/favicon.png',
    tag: data.tag || 'default',
    data: { url: data.url || '/portal' },
    vibrate: [100, 50, 100],
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/portal';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener('error', (event) => {
  console.error('[WL SW] error', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[WL SW] unhandledrejection', event.reason);
  event.preventDefault();
});
