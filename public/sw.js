const CACHE_NAME = 'warmeleads-v3.2';
const STATIC_CACHE = 'warmeleads-static-v3.2';

const CRITICAL_RESOURCES = [
  '/portal',
  '/favicon.ico',
  '/manifest.json',
  '/logo-wit.png',
  '/warmeleads-logo-2026.png',
];

const OFFLINE_PAGE = '/portal';

/**
 * Next.js chunks, RSC payloads, image optimizer, etc. must not go through
 * custom SW caching — stale caches across deployments cause failed chunk
 * loads, rejected FetchEvent promises, and browser resource exhaustion.
 */
function shouldBypassServiceWorker(url) {
  const p = url.pathname;
  if (p.startsWith('/_next/')) return true;
  if (p.startsWith('/__nextjs')) return true;
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(CRITICAL_RESOURCES))
      .catch((err) => console.error('SW cache failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (shouldBypassServiceWorker(url)) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/admin')) return;

  // HTML pages: network-first with offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_PAGE))
        )
    );
    return;
  }

  // Static assets (same-origin, non-Next): cache-first, never leave fetch() rejected
  if (
    url.pathname.includes('/favicon') ||
    url.pathname.includes('/manifest.json') ||
    /\.(png|jpg|jpeg|svg|webp|avif|ico|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
            }
            return response;
          })
          .catch(() => Response.error());
      })
    );
    return;
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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(url));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});

self.addEventListener('error', (event) => {
  console.error('SW error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('SW unhandled rejection:', event.reason);
  event.preventDefault();
});
