'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let intervalId = null;
    let registrationRef = null;
    let cancelled = false;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && registrationRef) {
        registrationRef.update();
      }
    };

    const onControllerChange = () => {
      if (refreshing.current) return;
      refreshing.current = true;
      console.log('🍀 New SW took control — reloading');
      window.location.reload();
    };

    const onMessage = (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('🍀 SW updated — reloading for latest version');
        window.location.reload();
      }
    };

    const refreshing = { current: false };

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (cancelled) return;
        registrationRef = registration;
        console.log('🍀 SW registered, scope:', registration.scope);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🍀 New version available — will reload shortly');
            }
          });
        });

        intervalId = setInterval(() => registration.update(), 5 * 60 * 1000);
        document.addEventListener('visibilitychange', onVisibilityChange);
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });

    navigator.serviceWorker.addEventListener('message', onMessage);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      navigator.serviceWorker.removeEventListener('message', onMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
