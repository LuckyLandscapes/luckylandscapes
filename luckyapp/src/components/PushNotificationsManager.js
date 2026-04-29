'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase, isSupabaseConnected } from '@/lib/supabase';

// Asks for notification permission once per device, then subscribes the
// browser to web push and persists the subscription to push_subscriptions.
// Skipped silently if VAPID is not configured, in demo mode, or for workers.

const PROMPTED_KEY = 'lucky_push_prompted_v1';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushNotificationsManager() {
  const { user, isWorker } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (typeof window === 'undefined') return;
    if (!user || isWorker) return;
    if (!isSupabaseConnected()) return; // demo mode — no real subscriptions
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return; // not configured — silently skip

    ranRef.current = true;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;

        // If we already have a subscription, just make sure it's stored server-side.
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          // Only auto-prompt once per browser. If permission is 'default', wait
          // until we've been mounted with a logged-in user (which is what we
          // already check above) and ask now.
          const previouslyPrompted = localStorage.getItem(PROMPTED_KEY);
          if (Notification.permission === 'denied') return;
          if (Notification.permission === 'default') {
            if (previouslyPrompted) return;
            localStorage.setItem(PROMPTED_KEY, '1');
            const result = await Notification.requestPermission();
            if (result !== 'granted') return;
          }
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }

        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

        // Upsert by endpoint (unique). RLS enforces user_id = auth.uid().
        const { error } = await supabase
          .from('push_subscriptions')
          .upsert(
            {
              org_id: user.orgId,
              user_id: user.id,
              endpoint: json.endpoint,
              p256dh: json.keys.p256dh,
              auth: json.keys.auth,
              user_agent: navigator.userAgent || null,
              last_used_at: new Date().toISOString(),
            },
            { onConflict: 'endpoint' }
          );
        if (error) console.error('[push] save subscription failed', error);
      } catch (err) {
        console.error('[push] subscribe failed', err);
      }
    })();
  }, [user, isWorker]);

  return null;
}
