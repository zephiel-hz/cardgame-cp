if('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[RegisterSW] Service Worker registered:', reg);
      })
      .catch(err => {
        console.error('[RegisterSW] Service Worker registration failed:', err);
      });
  });
}
