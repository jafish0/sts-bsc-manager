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

    // Parse request body
    const { email, name, team_id, role, agency_role, is_senior_leader, resend } = await req.json()

    // Authorization: super_admin can invite to any team, agency_admin/team_leader can invite to own team
    if (callerProfile.role === 'super_admin') {
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

    // Validate role parameter
    const inviteRole = role || 'agency_admin'
    const allowedRoles = ['agency_admin', 'team_leader', 'team_member']
    if (!allowedRoles.includes(inviteRole)) {
      return new Response(JSON.stringify({ error: 'Invalid role: ' + inviteRole }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!email || !name || !team_id) {
      return new Response(JSON.stringify({ error: 'email, name, and team_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify team exists
    const { data: team, error: teamError } = await adminClient
      .from('teams')
      .select('id, agency_name')
      .eq('id', team_id)
      .single()

    if (teamError || !team) {
      return new Response(JSON.stringify({ error: 'Team not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
    const redirectUrl = 'https://sts-bsc-manager.vercel.app/set-password'
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

    // Create user_profiles record
    const profileData: Record<string, unknown> = {
      id: newUser.id,
      email: email,
      full_name: name,
      role: inviteRole,
      team_id: team_id,
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

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.id,
        email: email,
        team: team.agency_name,
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
