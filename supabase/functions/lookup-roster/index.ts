import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Public, token + access-code scoped roster read for /roster/:token.
//
// ⚠️ This is the ONE endpoint that deliberately returns participant PII to an
// unauthenticated caller. Anonymous SELECT on event_registrations stays revoked
// (2026-07-17 hardening); this reads with the service role and returns an
// explicitly built, allowlisted payload — same posture as lookup-registration.
//
// POST { token: string, access_code: string }
//   200 { link, events, registrants }
//   401 { error }  bad code OR unknown token — deliberately identical
//   403 { error }  revoked / expired (only AFTER the code is accepted)
//   429 { error }  too many failed attempts, locked out
//
// Deployed with verify_jwt: false (pass it explicitly — the MCP tool's parameter
// defaults to true).

// Constant-time comparison, so response latency can't leak how many leading
// digits of the access code were correct.
function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  // Compare a fixed number of bytes regardless of input length.
  const len = Math.max(ab.length, bb.length, 16)
  let diff = ab.length ^ bb.length
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0)
  }
  return diff === 0
}

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  // One message for both "no such token" and "wrong code". If these differed,
  // an attacker could enumerate which tokens exist without ever knowing a code —
  // exactly the probe this endpoint must not enable.
  const REJECT = { error: 'That roster link or access code is not valid.' }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { token, access_code } = await req.json().catch(() => ({}))
    if (!token || typeof token !== 'string') return json(REJECT, 401)

    const { data: link, error: linkErr } = await admin
      .from('event_registration_links')
      .select('id, title, capacity, registration_opens_at, registration_closes_at, form_schema, collaborative_id, roster_share_include_emails, roster_share_access_code, roster_share_expires_at, roster_share_revoked_at, roster_share_view_count, roster_share_failed_attempts, roster_share_locked_until, collaboratives(name)')
      .eq('roster_share_token', token)
      .maybeSingle()
    if (linkErr) return json({ error: linkErr.message }, 500)
    if (!link) return json(REJECT, 401)

    // Lockout check comes before the code comparison so a locked token stops
    // burning attempts.
    if (link.roster_share_locked_until && new Date(link.roster_share_locked_until) > new Date()) {
      return json({ error: 'Too many incorrect attempts. Please try again in a few minutes.' }, 429)
    }

    // Access code required. A link with no code set is treated as unusable
    // rather than open — failing closed matters more than convenience here.
    const expected = link.roster_share_access_code
    if (!expected || !access_code || typeof access_code !== 'string'
        || !timingSafeEqual(String(access_code).trim(), String(expected))) {
      const attempts = (link.roster_share_failed_attempts || 0) + 1
      const patch: Record<string, unknown> = { roster_share_failed_attempts: attempts }
      if (attempts >= MAX_ATTEMPTS) {
        patch.roster_share_locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
        patch.roster_share_failed_attempts = 0
      }
      await admin.from('event_registration_links').update(patch).eq('id', link.id)
      return json(REJECT, 401)
    }

    // Code accepted — only now may we distinguish revoked from expired, because
    // before this point those messages would confirm the token exists.
    if (link.roster_share_revoked_at) {
      return json({ error: 'This roster link is no longer active. Contact CTAC for an updated link.' }, 403)
    }
    if (!link.roster_share_expires_at || new Date(link.roster_share_expires_at) < new Date()) {
      return json({ error: 'This roster link has expired. Contact CTAC for an updated link.' }, 403)
    }

    // Successful auth: clear any accumulated failures.
    if (link.roster_share_failed_attempts || link.roster_share_locked_until) {
      await admin.from('event_registration_links')
        .update({ roster_share_failed_attempts: 0, roster_share_locked_until: null })
        .eq('id', link.id)
    }

    // Events covered, for context.
    const { data: linkEventRows } = await admin
      .from('event_registration_link_events')
      .select('event_id')
      .eq('registration_link_id', link.id)
    const eventIds = (linkEventRows || []).map(r => r.event_id)
    let events: any[] = []
    if (eventIds.length > 0) {
      const { data: ev } = await admin
        .from('bsc_events')
        .select('id, title, event_date, start_time, end_time, location, timezone')
        .in('id', eventIds)
        .order('event_date', { ascending: true })
      // Allowlisted, and NO zoom_link — same reasoning as the public
      // registration page: join details don't belong on a shared roster URL.
      events = (ev || []).map(e => ({
        title: e.title, event_date: e.event_date,
        start_time: e.start_time, end_time: e.end_time,
        location: e.location, timezone: e.timezone,
      }))
    }

    const { data: regs } = await admin
      .from('event_registrations')
      .select('full_name, email, status, waitlist_position, registered_at, responses')
      .eq('registration_link_id', link.id)
      .order('registered_at', { ascending: true })

    // The link's own configured form fields, minus the system ones. Driven off
    // form_schema so a link with different fields renders correctly, and so we
    // never iterate the raw responses object (which carries email_confirm and
    // would leak the address even with emails switched off).
    const SYSTEM_KEYS = new Set(['full_name', 'email', 'email_confirm'])
    const formFields = ((link.form_schema || []) as any[])
      .filter(f => f && f.key && !SYSTEM_KEYS.has(f.key))
      .map(f => ({ key: f.key, label: f.label || f.key }))

    const includeEmails = link.roster_share_include_emails === true

    // Built field by field on purpose. Never spread the row: cancel_token alone
    // would let anyone holding this URL cancel a participant's registration.
    const registrants = (regs || []).map(r => {
      const responses = (r.responses || {}) as Record<string, unknown>
      const fields: Record<string, string> = {}
      for (const f of formFields) {
        const v = responses[f.key]
        if (v !== undefined && v !== null && String(v).trim() !== '') fields[f.key] = String(v)
      }
      const out: Record<string, unknown> = {
        full_name: r.full_name,
        status: r.status,
        waitlist_position: r.waitlist_position,
        registered_at: r.registered_at,
        fields,
      }
      if (includeEmails) out.email = r.email
      return out
    })

    const counts = { registered: 0, waitlisted: 0, cancelled: 0, checked_in: 0 } as Record<string, number>
    ;(regs || []).forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })

    // Audit trail — worth having when the payload is personal data.
    await admin.from('event_registration_links').update({
      roster_share_view_count: (link.roster_share_view_count || 0) + 1,
      roster_share_last_viewed_at: new Date().toISOString(),
    }).eq('id', link.id)

    return json({
      link: {
        title: link.title,
        collaborative_name: (link as any).collaboratives?.name ?? null,
        capacity: link.capacity,
        registration_opens_at: link.registration_opens_at,
        registration_closes_at: link.registration_closes_at,
        include_emails: includeEmails,
        expires_at: link.roster_share_expires_at,
      },
      counts,
      form_fields: formFields,
      events,
      registrants,
    })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
