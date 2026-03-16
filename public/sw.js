// Service Worker for Push Notifications
const CACHE_NAME = 'cardgame-v4';

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (!event.data) {
    console.warn('[SW] No data in push event');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW] Push data:', data);
    
    // Use provided icon/badge or fallback to defaults
    const options = {
      body: data.body || 'Notifikasi dari Card Game',
      icon: data.icon || '/pwa-icon-192.svg',
      badge: data.badge || '/pwa-icon-192.svg',
      tag: data.tag || 'cardgame-notification',
      requireInteraction: data.requireInteraction || false,
      data: data.data || {},
      actions: data.actions || [],
      vibrate: [200, 100, 200],
    };

    const title = data.title || 'Card Game Couple ❤️';
    console.log('[SW] Showing notification - Title:', title, 'Body:', options.body);
    
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW] Error parsing push data:', err);
    // Fallback notification
    try {
      event.waitUntil(self.registration.showNotification('Card Game Couple ❤️', {
        body: 'Ada notifikasi baru untuk Anda',
        icon: '/pwa-icon-192.svg',
        tag: 'fallback-notification',
      }));
    } catch (fallbackErr) {
      console.error('[SW] Even fallback notification failed:', fallbackErr);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  event.notification.close();

  const data = event.notification.data;
  const urlToOpen = data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if target URL is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// Fetch event - caching strategy for offline support
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API calls
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});
