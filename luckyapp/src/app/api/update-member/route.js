import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { memberId, fullName, email, password, orgId } = await request.json();

    if (!memberId || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: memberId, orgId' },
        { status: 400 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: service role key is missing.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get the team member to find their user_id
    const { data: member, error: fetchErr } = await supabaseAdmin
      .from('team_members')
      .select('id, user_id, email, full_name')
      .eq('id', memberId)
      .eq('org_id', orgId)
      .single();

    if (fetchErr || !member) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Update team_members table
    const teamUpdate = {};
    if (fullName) teamUpdate.full_name = fullName;
    if (email) teamUpdate.email = email;

    if (Object.keys(teamUpdate).length > 0) {
      const { error: updateErr } = await supabaseAdmin
        .from('team_members')
        .update(teamUpdate)
        .eq('id', memberId);

      if (updateErr) {
        console.error('Team member update error:', updateErr);
        return NextResponse.json(
          { error: `Failed to update team member: ${updateErr.message}` },
          { status: 500 }
        );
      }
    }

    // Update auth user (email, password, metadata)
    if (member.user_id) {
      const authUpdate = {};
      if (email) authUpdate.email = email;
      if (password) {
        if (password.length < 6) {
          return NextResponse.json(
            { error: 'Password must be at least 6 characters' },
            { status: 400 }
          );
        }
        authUpdate.password = password;
      }
      if (fullName) {
        authUpdate.user_metadata = { full_name: fullName };
      }

      if (Object.keys(authUpdate).length > 0) {
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
          member.user_id,
          authUpdate
        );

        if (authErr) {
          console.error('Auth user update error:', authErr);
          return NextResponse.json(
            { error: `Failed to update auth credentials: ${authErr.message}` },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Team member updated successfully',
    });
  } catch (err) {
    console.error('Update member error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
