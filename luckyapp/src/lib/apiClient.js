'use client';

// Client-side fetch wrapper that automatically attaches the current Supabase
// session's access token. Use this for any call into our own /api/* routes
// that requires auth.
//
// Usage:
//   const res = await apiFetch('/api/invite-member', {
//     method: 'POST',
//     body: JSON.stringify({ email, password, role }),
//   });

import { supabase } from './supabase';

export async function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}
