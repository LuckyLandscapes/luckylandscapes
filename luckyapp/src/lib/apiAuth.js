// Server-side auth helper for API route handlers.
// Verifies the caller's Supabase access token, then resolves their team_member
// row to extract orgId + role. Use this in every authenticated API route so
// that orgId is derived from the verified session, NEVER trusted from the body.
//
// Usage:
//   const auth = await authenticateRequest(request, { requireRole: 'admin' });
//   if (!auth.ok) return auth.response;
//   const { orgId, memberId, userId, role } = auth;

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const ROLE_RANK = { owner: 4, admin: 3, worker: 2, member: 2, viewer: 1 };

export async function authenticateRequest(request, options = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Supabase not configured on server' }, { status: 500 }),
    };
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 }),
    };
  }

  // Verify the token via the auth API. This is the only way to confirm the
  // token is real and unexpired without trusting client claims.
  const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 }),
    };
  }

  // Resolve their team_member row (using service role to read past RLS — we've
  // already authenticated the user, this is only to map auth.uid → org).
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: member, error: memberErr } = await admin
    .from('team_members')
    .select('id, org_id, role, is_active')
    .eq('user_id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (memberErr || !member) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No active team membership for this account' }, { status: 403 }),
    };
  }

  if (options.requireRole) {
    const required = ROLE_RANK[options.requireRole] || 0;
    const got = ROLE_RANK[member.role] || 0;
    if (got < required) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Insufficient role' }, { status: 403 }),
      };
    }
  }

  return {
    ok: true,
    userId: userData.user.id,
    email: userData.user.email,
    orgId: member.org_id,
    memberId: member.id,
    role: member.role,
  };
}
