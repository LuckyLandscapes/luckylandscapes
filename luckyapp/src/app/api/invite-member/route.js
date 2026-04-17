import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, fullName, role, orgId, orgName, invitedBy } = await request.json();

    // Validate required fields
    if (!email || !orgId) {
      return NextResponse.json({ error: 'Missing required fields: email, orgId' }, { status: 400 });
    }

    const validRoles = ['admin', 'member', 'viewer'];
    const memberRole = validRoles.includes(role) ? role : 'member';

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
      return NextResponse.json({ error: 'This email is already an active team member' }, { status: 409 });
    }

    // Invite the user via Supabase Auth (sends an invite email automatically)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName || email.split('@')[0],
        invited_org_id: orgId,
        invited_org_name: orgName,
        invited_role: memberRole,
      },
    });

    if (authError) {
      // If user already exists in auth, that's okay — we just need to add them to the org
      if (!authError.message?.includes('already been registered')) {
        console.error('Auth invite error:', authError);
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }
    }

    const userId = authData?.user?.id;

    // If there was an existing deactivated record, reactivate it
    if (existing && !existing.is_active) {
      await supabaseAdmin
        .from('team_members')
        .update({
          is_active: false, // Will be activated when they accept
          role: memberRole,
          full_name: fullName || email.split('@')[0],
          user_id: userId || existing.id, // preserve if no new auth user
        })
        .eq('id', existing.id);

      return NextResponse.json({
        success: true,
        message: 'Invite re-sent',
        memberId: existing.id,
      });
    }

    // Create a pending team member record
    if (userId) {
      const { data: member, error: memberError } = await supabaseAdmin
        .from('team_members')
        .insert({
          org_id: orgId,
          user_id: userId,
          full_name: fullName || email.split('@')[0],
          email: email,
          role: memberRole,
          is_active: false, // Pending until they log in
        })
        .select()
        .single();

      if (memberError) {
        console.error('Team member insert error:', memberError);
        // Don't fail the whole request — the auth invite was sent
      }

      return NextResponse.json({
        success: true,
        message: 'Invitation sent successfully',
        memberId: member?.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent — member will be added when they accept',
    });
  } catch (err) {
    console.error('Invite member error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
