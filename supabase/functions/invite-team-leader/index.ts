import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify caller is authenticated and is a super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace('Bearer ', '')

    // Create service role client (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Verify caller using the admin client with their token
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check caller's role using admin client to bypass RLS
    const { data: callerProfile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('role, team_id')
      .eq('id', caller.id)
      .single()

    if (profileError || !callerProfile) {
      return new Response(JSON.stringify({ error: 'Could not verify caller permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body.
    // collaborative_ids (uuid[]) applies to trainer_admin invites only: the
    // collaboratives the new trainer is assigned to via collaborative_trainers.
    const { email, name, team_id, role, agency_role, is_senior_leader, resend, collaborative_ids } = await req.json()

    // Validate role parameter. Two families:
    //  - team roles (require a team; agency admins can invite to their own team)
    //  - CTAC staff roles (no team; SUPER ADMINS ONLY — added 2026-09-01 for
    //    the Admin Dashboard "Add CTAC Staff" feature). The invite email link
    //    lets the person set their own password; no password is ever emailed.
    const inviteRole = role || 'agency_admin'
    const teamRoles = ['agency_admin', 'team_leader', 'team_member']
    const staffRoles = ['super_admin', 'trainer_admin']
    const isStaffInvite = staffRoles.includes(inviteRole)
    if (!teamRoles.includes(inviteRole) && !isStaffInvite) {
      return new Response(JSON.stringify({ error: 'Invalid role: ' + inviteRole }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Authorization: staff invites are super_admin-only. For team invites,
    // super_admin can invite to any team; agency_admin/team_leader to their own.
    if (isStaffInvite) {
      if (callerProfile.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Only super admins can add CTAC staff' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else if (callerProfile.role === 'super_admin') {
      // allowed for any team
    } else if (['agency_admin', 'team_leader'].includes(callerProfile.role)) {
      if (callerProfile.team_id !== team_id) {
        return new Response(JSON.stringify({ error: 'You can only invite members to your own team' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      return new Response(JSON.stringify({ error: 'Not authorized to invite users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!email || !name || (!isStaffInvite && !team_id)) {
      return new Response(JSON.stringify({ error: isStaffInvite ? 'email and name are required' : 'email, name, and team_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify team exists (team invites only — staff have no team)
    let team: { id: string; agency_name: string } | null = null
    if (!isStaffInvite) {
      const { data: teamRow, error: teamError } = await adminClient
        .from('teams')
        .select('id, agency_name')
        .eq('id', team_id)
        .single()

      if (teamError || !teamRow) {
        return new Response(JSON.stringify({ error: 'Team not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      team = teamRow
    }

    // Validate trainer collaborative assignments up front, before any user is
    // created, so a bad id can't leave a half-provisioned account.
    const trainerCollabIds: string[] = inviteRole === 'trainer_admin' && Array.isArray(collaborative_ids)
      ? collaborative_ids.filter((v: unknown) => typeof v === 'string' && v.length > 0)
      : []
    if (trainerCollabIds.length > 0) {
      const { data: collabRows, error: collabErr } = await adminClient
        .from('collaboratives')
        .select('id')
        .in('id', trainerCollabIds)
      if (collabErr || !collabRows || collabRows.length !== trainerCollabIds.length) {
        return new Response(JSON.stringify({ error: 'One or more collaboratives not found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    // Handle resend: delete existing user and re-invite
    if (existingUser && resend) {
      await adminClient.from('user_profiles').delete().eq('id', existingUser.id)
      await adminClient.auth.admin.deleteUser(existingUser.id)
    } else if (existingUser) {
      return new Response(JSON.stringify({ error: `A user with email ${email} already exists` }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Invite user via Supabase Auth (sends invite email automatically)
    const redirectUrl = 'https://bsc.ctac.app/set-password'
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: name },
        redirectTo: redirectUrl,
      }
    )

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newUser = inviteData.user

    // Create user_profiles record (staff have no team)
    const profileData: Record<string, unknown> = {
      id: newUser.id,
      email: email,
      full_name: name,
      role: inviteRole,
      team_id: isStaffInvite ? null : team_id,
      is_active: true,
    }
    if (agency_role) profileData.agency_role = agency_role
    if (is_senior_leader !== undefined) profileData.is_senior_leader = is_senior_leader

    const { error: insertError } = await adminClient
      .from('user_profiles')
      .insert(profileData)

    if (insertError) {
      // Clean up: delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(newUser.id)
      return new Response(JSON.stringify({ error: 'Failed to create user profile: ' + insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Trainer collaborative assignments (source of truth for what a
    // trainer_admin can see — collaborative_trainers, never is_coordinator
    // from here; coordinators stay a deliberate one-per-collab assignment).
    if (trainerCollabIds.length > 0) {
      const { error: assignError } = await adminClient
        .from('collaborative_trainers')
        .insert(trainerCollabIds.map((cid: string) => ({
          collaborative_id: cid,
          user_id: newUser.id,
          is_coordinator: false,
        })))
      if (assignError) {
        // Roll back the whole invite — a trainer with no assignments would
        // land on an empty dashboard and the failure would be invisible.
        await adminClient.from('user_profiles').delete().eq('id', newUser.id)
        await adminClient.auth.admin.deleteUser(newUser.id)
        return new Response(JSON.stringify({ error: 'Failed to assign collaboratives: ' + assignError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.id,
        email: email,
        role: inviteRole,
        team: team ? team.agency_name : null,
        collaboratives_assigned: trainerCollabIds.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
