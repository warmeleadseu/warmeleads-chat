const CACHE_NAME = 'warmeleads-v3.0';
const STATIC_CACHE = 'warmeleads-static-v3.0';

const CRITICAL_RESOURCES = [
  '/',
  '/portal',
  '/favicon.ico',
  '/manifest.json',
  '/logo-wit.png',
  '/warmeleads-logo-2026.png',
];

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
        names.map((name) => {
          if (name !== CACHE_NAME && name !== STATIC_CACHE) {
            return caches.delete(name);
          }
        })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

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
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  if (
    request.url.includes('/_next/static/') ||
    request.url.includes('/favicon') ||
    request.url.includes('/manifest.json') ||
    request.url.match(/\.(png|jpg|jpeg|svg|webp|avif|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'WarmeLeads';
  const options = {
    body: data.body || 'U heeft een nieuwe notificatie',
    icon: '/icons/icon-144x144.svg',
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
