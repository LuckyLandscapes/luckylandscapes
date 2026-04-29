// ============================================
// 🍀 Lucky App — Service Worker
// Network-first with automatic updates
// ============================================

// IMPORTANT: Bump this version string on every deploy.
// Vercel rebuilds this file each deploy, so the browser
// sees a byte-changed SW and triggers an update cycle.
const CACHE_VERSION = 'lucky-app-v' + Date.now();
const OFFLINE_URL = '/offline';

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/offline',
  '/favicon.ico',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Install: pre-cache critical assets, skip waiting immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Don't wait for old SW to finish — activate immediately
  self.skipWaiting();
});

// Activate: purge ALL old caches, take control of all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Notify all open tabs that the SW has been updated
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Push: show a notification when the server pushes an event.
// Payload format: { title, body, link, tag, data }
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Lucky Landscapes', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Lucky Landscapes';
  const options = {
    body: payload.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.tag || 'lucky-app',
    renotify: true,
    data: { link: payload.link || '/', ...(payload.data || {}) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click: focus an existing tab on the link, or open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      try {
        const url = new URL(client.url);
        // If we already have a luckyapp tab open, focus it and navigate
        if (url.origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(link);
          return;
        }
      } catch {}
    }
    await self.clients.openWindow(link);
  })());
});

// Fetch: network-first strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip non-http requests
  if (!event.request.url.startsWith('http')) return;

  // Skip API routes — always go to network
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests (page loads) — ALWAYS network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Static assets: network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (
          response.status === 200 &&
          (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/) ||
            url.pathname.startsWith('/_next/static/'))
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
