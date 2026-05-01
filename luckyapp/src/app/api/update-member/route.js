import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';

export async function POST(request) {
  try {
    // ── Auth gate: only admins/owners can mutate other team members ──
    const auth = await authenticateRequest(request, { requireRole: 'admin' });
    if (!auth.ok) return auth.response;

    const { memberId, fullName, email, password } = await request.json();

    if (!memberId) {
      return NextResponse.json(
        { error: 'Missing required field: memberId' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Look up the target member, scoped to the caller's verified org.
    // This is the authorization check: caller can only touch their own org's members.
    const { data: member, error: fetchErr } = await supabaseAdmin
      .from('team_members')
      .select('id, user_id, email, full_name, org_id')
      .eq('id', memberId)
      .eq('org_id', auth.orgId)
      .single();

    if (fetchErr || !member) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    const teamUpdate = {};
    if (fullName) teamUpdate.full_name = fullName;
    if (email) teamUpdate.email = email;

    if (Object.keys(teamUpdate).length > 0) {
      const { error: updateErr } = await supabaseAdmin
        .from('team_members')
        .update(teamUpdate)
        .eq('id', memberId);

      if (updateErr) {
        console.error('[update-member] team_members update failed');
        return NextResponse.json(
          { error: 'Failed to update team member' },
          { status: 500 }
        );
      }
    }

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
          console.error('[update-member] auth update failed');
          return NextResponse.json(
            { error: 'Failed to update auth credentials' },
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
    console.error('[update-member] handler error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
