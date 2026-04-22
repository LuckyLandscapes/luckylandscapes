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

    // Check if user already exists in the org
    const { data: existing } = await supabaseAdmin
      .from('team_members')
      .select('id, is_active')
      .eq('org_id', orgId)
      .eq('email', email)
      .maybeSingle();

    if (existing?.is_active) {
      return NextResponse.json(
        { error: 'This email is already an active team member' },
        { status: 409 }
      );
    }

    // Create the auth user with a password (no email confirmation needed)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm so they can log in immediately
      user_metadata: {
        full_name: fullName || email.split('@')[0],
        invited_org_id: orgId,
        invited_org_name: orgName,
        invited_role: memberRole,
      },
    });

    if (authError) {
      // If user already exists in auth, try to get their ID
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        // Look up existing auth user by email
        const { data: { users: matchedUsers } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1, filter: email });
        const existingUser = matchedUsers?.[0];

        if (existingUser) {
          // Update their password and metadata
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            password,
            user_metadata: {
              full_name: fullName || email.split('@')[0],
              invited_org_id: orgId,
              invited_org_name: orgName,
              invited_role: memberRole,
            },
          });

          // Create or update team member record
          if (existing) {
            await supabaseAdmin
              .from('team_members')
              .update({
                is_active: true,
                role: memberRole,
                full_name: fullName || email.split('@')[0],
                user_id: existingUser.id,
                hourly_rate: hourlyRate || 15,
              })
              .eq('id', existing.id);
          } else {
            await supabaseAdmin
              .from('team_members')
              .insert({
                org_id: orgId,
                user_id: existingUser.id,
                full_name: fullName || email.split('@')[0],
                email: email,
                role: memberRole,
                hourly_rate: hourlyRate || 15,
                is_active: true,
              });
          }

          return NextResponse.json({
            success: true,
            message: 'User updated and added to team',
          });
        }

        return NextResponse.json({ error: authError.message }, { status: 500 });
      }

      console.error('Auth create error:', authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const userId = authData?.user?.id;

    // If there was an existing deactivated record, reactivate it
    if (existing && !existing.is_active) {
      await supabaseAdmin
        .from('team_members')
        .update({
          is_active: true,
          role: memberRole,
          full_name: fullName || email.split('@')[0],
          user_id: userId,
          hourly_rate: hourlyRate || 15,
        })
        .eq('id', existing.id);

      return NextResponse.json({
        success: true,
        message: 'Member reactivated',
        memberId: existing.id,
      });
    }

    // Create a new team member record linked to the owner's org
    if (userId) {
      const { data: member, error: memberError } = await supabaseAdmin
        .from('team_members')
        .insert({
          org_id: orgId,
          user_id: userId,
          full_name: fullName || email.split('@')[0],
          email: email,
          role: memberRole,
          hourly_rate: hourlyRate || 15,
          is_active: true, // Active immediately — they can log in right away
        })
        .select()
        .single();

      if (memberError) {
        console.error('Team member insert error:', memberError);
      }

      return NextResponse.json({
        success: true,
        message: 'Team member created — they can log in now',
        memberId: member?.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'User created',
    });
  } catch (err) {
    console.error('Invite member error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
