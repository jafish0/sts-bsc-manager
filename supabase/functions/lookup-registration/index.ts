import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Public, token-scoped read for the cancel page (/cancel-registration/:token).
//
// Exists so the BROWSER never needs SELECT on event_registrations. That table
// previously carried a `qual = true` public read policy, which exposed every
// registrant's name / email / responses jsonb and every cancel_token to anyone
// holding the publishable key. This returns ONLY the handful of fields the
// cancel page actually renders, for the single row matching the token.
//
// Unauthenticated by design (visitors arrive from an email link) — the
// cancel_token IS the credential, same posture as cancel-registration.
//
// POST { cancel_token: string }
//   200 { full_name, email, status, title, collaborative_name }
//   404 { error }  unknown token

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { cancel_token } = await req.json().catch(() => ({}))
    if (!cancel_token || typeof cancel_token !== 'string') {
      return json({ error: 'cancel_token required' }, 400)
    }

    const { data: reg, error } = await admin
      .from('event_registrations')
      .select('full_name, email, status, event_registration_links ( title, collaboratives ( name ) )')
      .eq('cancel_token', cancel_token)
      .maybeSingle()

    if (error) return json({ error: error.message }, 500)
    if (!reg) return json({ error: 'Invalid cancel link' }, 404)

    const link = (reg as Record<string, any>).event_registration_links

    return json({
      full_name: reg.full_name,
      email: reg.email,
      status: reg.status,
      title: link?.title ?? null,
      collaborative_name: link?.collaboratives?.name ?? null,
    })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
