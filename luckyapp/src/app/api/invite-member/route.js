import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password, fullName, role, hourlyRate, orgId, orgName, invitedBy } = await request.json();

    // Validate required fields
    if (!email || !password || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, orgId' },
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

    // Validate the service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: service role key is missing. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (find it in Supabase Dashboard → Settings → API).' },
        { status: 500 }
      );
    }

    // Create a service-role client (admin privileges, bypasses RLS)
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

    // Try creating a new auth user first
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
      // User already exists in auth — find them by listing all users and matching
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        // Use the GoTrue admin REST API directly to find user by email
        const gotrueLookup = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
            },
          }
        );

        if (gotrueLookup.ok) {
          const gotrueData = await gotrueLookup.json();
          const users = gotrueData.users || gotrueData;
          const matchedUser = (Array.isArray(users) ? users : []).find(u => u.email === email);
          if (matchedUser) {
            authUserId = matchedUser.id;

            // Update their password and metadata
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

        // If we still couldn't find the user, try using the existing team member's user_id
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
          console.error('Could not find existing auth user for email:', email);
          return NextResponse.json(
            { error: 'This email is already registered but could not be found. Please contact support.' },
            { status: 500 }
          );
        }
      } else {
        console.error('Auth create error:', authError);
        return NextResponse.json({ error: authError.message }, { status: 500 });
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
      // Reactivate or update existing record
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

      if (updateErr) console.error('Team member update error:', updateErr);
      memberRecord = data;
    } else {
      // Create new team member record
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

      if (insertErr) console.error('Team member insert error:', insertErr);
      memberRecord = data;
    }

    return NextResponse.json({
      success: true,
      message: 'Team member created — they can log in now',
      member: memberRecord,
    });
  } catch (err) {
    console.error('Invite member error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
