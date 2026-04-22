'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('🍀 SW registered, scope:', registration.scope);

        // When a new SW finishes installing and becomes waiting, skip waiting
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW is ready — it will skipWaiting on its own,
              // but we reload once it takes over
              console.log('🍀 New version available — will reload shortly');
            }
          });
        });

        // Check for updates every 5 minutes (instead of 1 hour)
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);

        // Also check for updates on page visibility change (tab refocus)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update();
          }
        });
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });

    // Listen for the SW_UPDATED message from the new service worker
    // and reload the page to get the latest version
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('🍀 SW updated — reloading for latest version');
        window.location.reload();
      }
    });

    // Also reload if the controlling SW changes (another approach for the same goal)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('🍀 New SW took control — reloading');
      window.location.reload();
    });
  }, []);

  return null;
}
