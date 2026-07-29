import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Public cancellation endpoint reached from /cancel-registration/:token.
// Calls the SQL helper public.cancel_registration_and_promote(uuid) which
// atomically marks the row cancelled and promotes the next waitlister.
// Then fires send-registration-email twice: once 'cancellation' to the
// cancelling registrant, and once 'promoted' to whoever moved up (if any).
//
// POST body: { cancel_token: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { cancel_token } = await req.json().catch(() => ({}))
    if (!cancel_token) {
      return new Response(JSON.stringify({ error: 'cancel_token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: reg } = await admin
      .from('event_registrations')
      .select('id, email, full_name, status')
      .eq('cancel_token', cancel_token)
      .maybeSingle()
    if (!reg) {
      return new Response(JSON.stringify({ error: 'Invalid cancel link' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (reg.status === 'cancelled') {
      return new Response(JSON.stringify({ success: true, already: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Atomic cancel + promote via SQL helper.
    const { data: rpcRows, error: rpcErr } = await admin
      .rpc('cancel_registration_and_promote', { p_registration_id: reg.id })
    if (rpcErr) {
      return new Response(JSON.stringify({ error: rpcErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const promoted = (rpcRows && rpcRows.length > 0) ? rpcRows[0] : null

    // Send the emails. AWAITED on purpose: on Deno Deploy the isolate can be
    // torn down as soon as we return, so an un-awaited fetch may never actually
    // leave. Failures must never fail the cancellation (it is already
    // committed) — log and continue.
    const sendMail = async (registrationId: string, kind: string) => {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-registration-email`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ registration_id: registrationId, kind }),
        })
        if (!resp.ok) console.error(`${kind} email failed`, resp.status, (await resp.text()).slice(0, 500))
      } catch (err) {
        console.error(`${kind} email threw:`, (err as Error).message)
      }
    }

    await sendMail(reg.id, 'cancellation')
    if (promoted?.promoted_registration_id) {
      await sendMail(promoted.promoted_registration_id, 'promoted')
    }

    return new Response(JSON.stringify({
      success: true,
      promoted_email: promoted?.promoted_email || null,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
