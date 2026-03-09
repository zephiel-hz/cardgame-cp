// Aggressively unregister old service workers and clear cache
if ('serviceWorker' in navigator) {
  // First, unregister all existing service workers
  navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('[RegisterSW] Found', registrations.length, 'existing SW registrations');
    registrations.forEach(reg => {
      console.log('[RegisterSW] Unregistering old SW:', reg);
      reg.unregister();
    });
  });

  // Clear all cache storage
  if (caches) {
    caches.keys().then(cacheNames => {
      console.log('[RegisterSW] Found caches:', cacheNames);
      cacheNames.forEach(cacheName => {
        console.log('[RegisterSW] Clearing cache:', cacheName);
        caches.delete(cacheName);
      });
    });
  }

  // After cleanup, register new SW with skipWaiting to take over immediately
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[RegisterSW] Service Worker registered:', reg);
        // Claim clients immediately to take over everything
        if (reg.active) {
          reg.active.postMessage({ type: 'SKIP_WAITING' });
        }
      })
      .catch(err => {
        console.error('[RegisterSW] Service Worker registration failed:', err);
      });
  });
}