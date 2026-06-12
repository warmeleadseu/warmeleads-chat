/**
 * WarmeLeads service worker v5 — push-only met version-probe voor recovery.
 *
 * Belangrijk:
 * - GEEN fetch-handler. Oudere versies (v3.x) hadden er een en die zorgden voor
 *   stale-cached HTML die naar verdwenen Next.js-chunks verwees, met als gevolg
 *   dat React nooit kon hydrateren (vooral op iOS Safari, waar oude SW's lang
 *   blijven plakken). Door de fetch-handler weg te laten lopen alle requests
 *   gewoon naar het netwerk.
 * - Reageert op `getVersion`-postMessage zodat de pagina kan detecteren of een
 *   stale/onresponsieve SW is geregistreerd en die kan opruimen.
 */
const CACHE_VERSION = 'warmeleads-v5-push-only';

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

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'getVersion') {
    const reply = { type: 'wl-sw-version', value: CACHE_VERSION };
    if (event.source && typeof event.source.postMessage === 'function') {
      event.source.postMessage(reply);
    } else if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(reply);
    }
    return;
  }

  if (data.type === 'skipWaiting') {
    self.skipWaiting();
  }
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
