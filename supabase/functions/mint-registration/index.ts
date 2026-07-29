import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Public registration submission endpoint.
// Validates the form per the link's form_schema, enforces capacity + waitlist,
// dedupes on (link, email), and inserts. Returns the created registration
// (or the existing one if it's a duplicate) along with a cancel URL.
//
// POST body:
//   { token: string, responses: Record<string, any>, honeypot?: string }

type FieldDef = {
  key: string
  label: string
  type: 'text'|'textarea'|'email'|'email_confirm'|'phone'|'select'|'radio'|'yes_no'|'number'
  required?: boolean
  matches?: string
  options?: { value: string; label: string }[]
}

function validate(schema: FieldDef[], responses: Record<string, any>): string | null {
  for (const f of schema) {
    const v = responses[f.key]
    const present = v !== undefined && v !== null && String(v).trim() !== ''
    if (f.required && !present) return `Missing required field: ${f.label}`
    if (!present) continue
    if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v))) return `Invalid email: ${f.label}`
    if (f.type === 'email_confirm') {
      const target = f.matches ? responses[f.matches] : null
      if (!target || String(target).toLowerCase() !== String(v).toLowerCase()) return `${f.label} must match`
    }
    if (f.type === 'number' && Number.isNaN(Number(v))) return `Invalid number: ${f.label}`
    if ((f.type === 'select' || f.type === 'radio') && f.options) {
      if (!f.options.some(o => o.value === v)) return `Invalid choice for ${f.label}`
    }
    if (f.type === 'yes_no' && v !== 'yes' && v !== 'no') return `${f.label} must be yes or no`
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json().catch(() => ({}))
    const { token, responses, honeypot } = body as any
    if (honeypot) return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (!token || !responses) {
      return new Response(JSON.stringify({ error: 'token and responses are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Look up the link.
    const { data: link, error: linkErr } = await admin
      .from('event_registration_links')
      .select('*')
      .eq('token', token)
      .maybeSingle()
    if (linkErr || !link) {
      return new Response(JSON.stringify({ error: 'Invalid or expired registration link.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!link.is_active) {
      return new Response(JSON.stringify({ error: 'Registration is closed.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const now = new Date()
    if (link.registration_opens_at && new Date(link.registration_opens_at) > now) {
      return new Response(JSON.stringify({ error: `Registration opens ${new Date(link.registration_opens_at).toLocaleString()}.` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (link.registration_closes_at && new Date(link.registration_closes_at) < now) {
      return new Response(JSON.stringify({ error: 'Registration is closed.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validate per schema.
    const schema = (link.form_schema || []) as FieldDef[]
    const validationError = validate(schema, responses)
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Resolve canonical email + name from responses (the seeded email/full_name keys).
    const email = String(responses.email || '').trim().toLowerCase()
    const fullName = String(responses.full_name || '').trim()
    if (!email || !fullName) {
      return new Response(JSON.stringify({ error: 'Name and email are required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Idempotent on duplicate email.
    // Exact match, NOT ilike: emails are stored lowercased already, and `_`/`%`
    // are LIKE wildcards — ilike would make a_b@x.com collide with axb@x.com.
    const { data: existing } = await admin
      .from('event_registrations')
      .select('id, status, cancel_token')
      .eq('registration_link_id', link.id)
      .eq('email', email)
      .maybeSingle()
    if (existing && existing.status !== 'cancelled') {
      return new Response(JSON.stringify({
        success: true, duplicate: true,
        registration_id: existing.id,
        cancel_url: `https://bsc.ctac.app/cancel-registration/${existing.cancel_token}`,
        message: "You're already registered. Use the cancel link if you need to remove your registration."
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Capacity check + waitlist.
    let status: 'registered' | 'waitlisted' = 'registered'
    let waitlistPosition: number | null = null
    if (link.capacity != null) {
      const { count: registeredCount } = await admin
        .from('event_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('registration_link_id', link.id)
        .eq('status', 'registered')
      if ((registeredCount ?? 0) >= link.capacity) {
        if (!link.waitlist_enabled) {
          return new Response(JSON.stringify({ error: 'Registration is full.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        status = 'waitlisted'
        const { data: maxRow } = await admin
          .from('event_registrations')
          .select('waitlist_position')
          .eq('registration_link_id', link.id)
          .eq('status', 'waitlisted')
          .order('waitlist_position', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()
        waitlistPosition = (maxRow?.waitlist_position ?? 0) + 1
      }
    }

    // Insert. If a cancelled row exists, replace it (clearing cancellation).
    let registration: any
    if (existing && existing.status === 'cancelled') {
      const { data: updated, error: updErr } = await admin
        .from('event_registrations')
        .update({
          full_name: fullName, responses, status,
          waitlist_position: waitlistPosition,
          registered_at: new Date().toISOString(),
          cancelled_at: null,
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (updErr) throw updErr
      registration = updated
    } else {
      const { data: inserted, error: insErr } = await admin
        .from('event_registrations')
        .insert({
          registration_link_id: link.id,
          email, full_name: fullName, responses, status,
          waitlist_position: waitlistPosition,
        })
        .select()
        .single()
      if (insErr) throw insErr
      registration = inserted
    }

    // Send the confirmation. AWAITED on purpose: on Deno Deploy the isolate can
    // be torn down as soon as we return, so an un-awaited fetch may never
    // actually leave. A failure must never fail the registration itself (the
    // row is already committed) — log it and let the roster's "not sent" badge
    // + resend button handle recovery.
    try {
      const mailResp = await fetch(`${supabaseUrl}/functions/v1/send-registration-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: registration.id }),
      })
      if (!mailResp.ok) {
        console.error('confirmation email failed', mailResp.status, (await mailResp.text()).slice(0, 500))
      }
    } catch (mailErr) {
      console.error('confirmation email threw:', (mailErr as Error).message)
    }

    return new Response(JSON.stringify({
      success: true,
      registration_id: registration.id,
      status: registration.status,
      waitlist_position: registration.waitlist_position,
      cancel_url: `https://bsc.ctac.app/cancel-registration/${registration.cancel_token}`,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
