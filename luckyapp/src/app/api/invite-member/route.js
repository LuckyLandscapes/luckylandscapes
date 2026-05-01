import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';

export async function POST(request) {
  try {
    // ── Auth gate: only admins/owners of an org can invite members ──
    const auth = await authenticateRequest(request, { requireRole: 'admin' });
    if (!auth.ok) return auth.response;

    const { email, password, fullName, role, hourlyRate, orgName } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'worker', 'member', 'viewer'];
    const memberRole = validRoles.includes(role) ? role : 'worker';

    // Use the verified session's orgId — never trust the body.
    const orgId = auth.orgId;
    const invitedBy = auth.memberId;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user already exists as a team member in this org
    const { data: existingMember } = await supabaseAdmin
      .from('team_members')
      .select('id, is_active, user_id')
      .eq('org_id', orgId)
      .eq('email', email)
      .maybeSingle();

    if (existingMember?.is_active) {
      return NextResponse.json(
        { error: 'This email is already an active team member' },
        { status: 409 }
      );
    }

    // ── Step 1: Get or create the auth user ──
    let authUserId = null;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || email.split('@')[0],
        invited_org_id: orgId,
        invited_org_name: orgName,
        invited_role: memberRole,
      },
    });

    if (authError) {
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        // User already exists in auth — find them via admin API
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (!listErr) {
          const matched = (list?.users || []).find(u => u.email === email);
          if (matched) {
            authUserId = matched.id;
            await supabaseAdmin.auth.admin.updateUserById(authUserId, {
              password,
              user_metadata: {
                full_name: fullName || email.split('@')[0],
                invited_org_id: orgId,
                invited_org_name: orgName,
                invited_role: memberRole,
              },
            });
          }
        }

        if (!authUserId && existingMember?.user_id) {
          authUserId = existingMember.user_id;
          await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            password,
            user_metadata: {
              full_name: fullName || email.split('@')[0],
              invited_org_id: orgId,
              invited_org_name: orgName,
              invited_role: memberRole,
            },
          });
        }

        if (!authUserId) {
          // Don't echo the email back in the error — generic message only.
          console.error('[invite-member] could not resolve existing auth user');
          return NextResponse.json(
            { error: 'This email is already registered but could not be found. Please contact support.' },
            { status: 500 }
          );
        }
      } else {
        console.error('[invite-member] auth create failed');
        return NextResponse.json({ error: 'Account creation failed' }, { status: 500 });
      }
    } else {
      authUserId = authData?.user?.id;
    }

    if (!authUserId) {
      return NextResponse.json({ error: 'Failed to create or find user account' }, { status: 500 });
    }

    // ── Step 2: Create or update the team_member record ──
    let memberRecord;

    if (existingMember) {
      const { data, error: updateErr } = await supabaseAdmin
        .from('team_members')
        .update({
          is_active: true,
          role: memberRole,
          full_name: fullName || email.split('@')[0],
          user_id: authUserId,
          hourly_rate: hourlyRate || 15,
        })
        .eq('id', existingMember.id)
        .select()
        .single();

      if (updateErr) {
        console.error('[invite-member] team member update failed');
        return NextResponse.json(
          { error: 'Account created but team record failed' },
          { status: 500 }
        );
      }
      memberRecord = data;
    } else {
      const { data, error: insertErr } = await supabaseAdmin
        .from('team_members')
        .insert({
          org_id: orgId,
          user_id: authUserId,
          full_name: fullName || email.split('@')[0],
          email: email,
          role: memberRole,
          hourly_rate: hourlyRate || 15,
          is_active: true,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[invite-member] team member insert failed');
        return NextResponse.json(
          { error: 'Account created but team record failed. You may need to run the role constraint migration in Supabase SQL Editor.' },
          { status: 500 }
        );
      }
      memberRecord = data;
    }

    return NextResponse.json({
      success: true,
      message: 'Team member created — they can log in now',
      member: memberRecord,
      invitedBy,
    });
  } catch (err) {
    console.error('[invite-member] handler error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
