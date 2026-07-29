import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Send pre-event reminder emails to all participants of one event,
// embedding RSVP buttons + Add-to-Calendar (.ics) + an unsubscribe/cancel link.
//
// Recipients = team members of the collaborative UNION registrants whose
// registration link covers this event, deduped on lowercased email. Excluded:
// unsubscribed members, cancelled and WAITLISTED registrants (no seat), and
// anyone who already RSVP'd not_attending for this event.
//
// POST body: { event_id: string, reminder_type: 'week_before'|'day_before'|'hour_before'|'starting_now'|'custom', skip_log_check?: boolean }
//
// Auth: this function is called either by an authenticated admin (UI "Send reminder now")
// OR by pg_cron via pg_net using the project's service-role key in the Authorization header.
//
// Idempotency: refuses to re-send the same (event, reminder_type) unless skip_log_check.

type Body = {
  event_id: string
  reminder_type: 'week_before' | 'day_before' | 'hour_before' | 'starting_now' | 'custom'
  skip_log_check?: boolean
}

function esc(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Program labels, mirroring send-registration-email. Duplicated on purpose —
// an edge function runs in Deno with no bundler and must not reach into the
// frontend tree. Short forms match PROGRAM_TYPE_COLORS.
const PROGRAM_LABELS: Record<string, { long: string; short: string }> = {
  sts_bsc: { long: 'STS Breakthrough Series Collaborative', short: 'STS-BSC' },
  tic_lc:  { long: 'TIC Learning Collaborative',            short: 'TIC LC'  },
  tipe_lc: { long: 'TIPE Learning Collaborative',           short: 'TIPE LC' },
  fourc:   { long: 'FourC Collaborative',                   short: 'FourC'   },
}

// btoa() only accepts code points 0-255 and THROWS above U+00FF. This function
// built the base64 ONCE before the recipient loop, so a single curly apostrophe
// or em dash in a title — i.e. anything from an imported Word schedule — took
// down the reminder for EVERY participant, on a cron nobody is watching.
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// RFC 5545 TEXT values must escape backslash, semicolon, comma and newlines.
// SUMMARY/LOCATION/DESCRIPTION were interpolated raw, so a comma in a title
// ("Cognitive Coping, Part 1") was parsed as a value separator.
function escIcsText(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Same VTIMEZONE as send-registration-email: RRULE-based (DST 2nd Sunday March
// -> 1st Sunday November) rather than a fixed offset, so a cohort spanning the
// boundary resolves correctly off one definition.
const VTIMEZONES: Record<string, string[]> = {
  'America/New_York': [
    'BEGIN:VTIMEZONE',
    'TZID:America/New_York',
    'X-LIC-LOCATION:America/New_York',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'TZNAME:EDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'TZNAME:EST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ],
}

// Build an ICS calendar file for the event.
// All-day events not supported here — we require start_time.
//
// Deliberately does NOT emit VALARM, unlike send-registration-email. A reminder
// email IS the alarm; attaching a day-before popup to a calendar entry that was
// delivered an hour before the event would be incoherent.
function buildIcs(event: any, programType?: string | null): string {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const tz = event.timezone || 'America/New_York'
  // Build ISO-style strings for DTSTART/DTEND in TZID format.
  // event_date is YYYY-MM-DD, start_time is HH:MM:SS.
  const startBits = event.start_time?.split(':') || ['00','00','00']
  const endBits = event.end_time?.split(':') || startBits
  const dateNoDash = event.event_date.replace(/-/g, '')
  const start = `${dateNoDash}T${startBits[0]}${startBits[1]}${startBits[2] || '00'}`
  const end = `${dateNoDash}T${endBits[0]}${endBits[1]}${endBits[2] || '00'}`
  const tag = programType ? PROGRAM_LABELS[programType]?.short : null
  const summary = tag ? `${tag}: ${event.title}` : event.title
  const description = [
    event.title,
    event.zoom_link ? `Join: ${event.zoom_link}` : null,
    event.location ? `Location: ${event.location}` : null,
  ].filter(Boolean).map(part => escIcsText(part as string)).join('\\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CTAC//BSC Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    event.collaboratives?.name ? `X-WR-CALNAME:${escIcsText(event.collaboratives.name)}` : '',
    ...(VTIMEZONES[tz] || []),
    'BEGIN:VEVENT',
    `UID:${event.id}@bsc.ctac.app`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${tz}:${start}`,
    `DTEND;TZID=${tz}:${end}`,
    `SUMMARY:${escIcsText(summary)}`,
    `DESCRIPTION:${description}`,
    event.location ? `LOCATION:${escIcsText(event.location)}` : '',
    event.zoom_link ? `URL:${event.zoom_link}` : '',
    'ORGANIZER;CN=UK CTAC:mailto:no-reply@ctac.app',
    'CATEGORIES:CTAC Learning Collaborative',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

function reminderSubject(event: any, reminderType: string): string {
  const dt = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  switch (reminderType) {
    case 'week_before':  return `One week out: ${event.title} on ${dt}`
    case 'day_before':   return `Tomorrow: ${event.title}`
    case 'hour_before':  return `Starting in 1 hour: ${event.title}`
    case 'starting_now': return `Starting now: ${event.title}`
    default:             return `Reminder: ${event.title}`
  }
}

function reminderHeadline(event: any, reminderType: string): string {
  switch (reminderType) {
    case 'week_before':  return 'You’re registered for an upcoming Learning Session in one week.'
    case 'day_before':   return 'A friendly reminder — your session is tomorrow.'
    case 'hour_before':  return 'Heads up — your session starts in an hour.'
    case 'starting_now': return 'We’re live now — join us!'
    default:             return 'A reminder about an upcoming session.'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const body: Body = await req.json()
    const { event_id, reminder_type, skip_log_check } = body

    if (!event_id || !reminder_type) {
      return new Response(JSON.stringify({ error: 'event_id and reminder_type are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Idempotency: short-circuit if we've already sent this reminder for this event.
    if (!skip_log_check) {
      const { data: existing } = await admin
        .from('event_reminder_log')
        .select('id')
        .eq('event_id', event_id)
        .eq('reminder_type', reminder_type)
        .maybeSingle()
      if (existing) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'already_sent' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Fetch event + collaborative.
    const { data: event, error: eventErr } = await admin
      .from('bsc_events')
      .select('id, title, event_date, start_time, end_time, location, zoom_link, timezone, collaborative_id, collaboratives(name, program_type)')
      .eq('id', event_id)
      .single()
    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Resolve recipients as the UNION of team members and registrants.
    //
    // This used to be team members only. Registrants are deliberately NOT
    // user_profiles rows (registering creates no account), so every registrant
    // got their confirmation email and then silence — no week-before,
    // day-before, hour-before or starting-now reminder — while the crons
    // reported success. For the AWARE cohort, which has 0 teams and will have
    // ~297 registrants, that meant literally zero reminders for everyone.
    const { data: teams } = await admin
      .from('teams').select('id').eq('collaborative_id', event.collaborative_id)
    const teamIds = (teams || []).map(t => t.id)

    // No early return on an empty team list any more — that check WAS the bug.
    let members: any[] = []
    if (teamIds.length > 0) {
      const { data: m } = await admin
        .from('user_profiles')
        .select('id, full_name, email, unsubscribe_token, notifications_unsubscribed_at')
        .in('team_id', teamIds)
        .eq('is_active', true)
      members = m || []
    }

    // Registrants whose link covers THIS event. Two hops because
    // event_registrations has no FK to event_registration_link_events (both
    // point at event_registration_links), so a PostgREST embed can't express it.
    const { data: coveringLinks } = await admin
      .from('event_registration_link_events')
      .select('registration_link_id')
      .eq('event_id', event_id)
    const coveringLinkIds = [...new Set((coveringLinks || []).map(r => r.registration_link_id))]

    let registrants: any[] = []
    if (coveringLinkIds.length > 0) {
      // status filter: 'registered' and 'checked_in' only.
      // - 'cancelled'  — they withdrew.
      // - 'waitlisted' — no seat. A "your session is tomorrow" email would read
      //   as confirmation they're in and create confusion at the door. They
      //   already know their position and get a promotion email if one opens.
      const { data: rg } = await admin
        .from('event_registrations')
        .select('id, full_name, email, status, cancel_token')
        .in('registration_link_id', coveringLinkIds)
        .in('status', ['registered', 'checked_in'])
      registrants = rg || []
    }

    // Merge, deduping on lowercased email. A team member who also registered
    // must not get two copies; the team-member record wins because it carries
    // full_name, a real user_id and an unsubscribe_token.
    type Recipient = {
      email: string
      full_name: string | null
      user_id: string | null
      unsubscribe_token: string | null
      cancel_token: string | null
      source: 'member' | 'registrant'
    }
    const byEmail = new Map<string, Recipient>()
    for (const m of members) {
      if (!m.email || m.notifications_unsubscribed_at) continue
      byEmail.set(m.email.toLowerCase(), {
        email: m.email, full_name: m.full_name, user_id: m.id,
        unsubscribe_token: m.unsubscribe_token, cancel_token: null, source: 'member',
      })
    }
    for (const r of registrants) {
      if (!r.email) continue
      const key = r.email.toLowerCase()
      if (byEmail.has(key)) continue // team member already present — keep theirs
      byEmail.set(key, {
        email: r.email, full_name: r.full_name, user_id: null,
        unsubscribe_token: null, cancel_token: r.cancel_token, source: 'registrant',
      })
    }

    let recipients = [...byEmail.values()]
    if (recipients.length === 0) {
      await admin.from('event_reminder_log').insert({ event_id, reminder_type, recipient_count: 0 })
      return new Response(JSON.stringify({ success: true, recipient_count: 0, reason: 'no_recipients' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Upsert event_rsvps so each recipient has a stable token. user_id is
    // nullable, which is what lets registrants hold RSVP tokens without
    // needing fake accounts.
    const rsvpRows = recipients.map(r => ({ event_id, user_id: r.user_id, email: r.email }))
    await admin.from('event_rsvps').upsert(rsvpRows, { onConflict: 'event_id,email', ignoreDuplicates: true })
    const { data: rsvps } = await admin
      .from('event_rsvps')
      .select('email, rsvp_token, status')
      .eq('event_id', event_id)
    const tokenByEmail = new Map<string, string>((rsvps || []).map(r => [r.email.toLowerCase(), r.rsvp_token]))

    // Drop anyone who already told us they can't attend THIS event. Their other
    // sessions are unaffected — event_rsvps is per (event, email).
    const declined = new Set(
      (rsvps || []).filter(r => r.status === 'not_attending').map(r => r.email.toLowerCase())
    )
    const skippedDeclined = recipients.filter(r => declined.has(r.email.toLowerCase())).length
    recipients = recipients.filter(r => !declined.has(r.email.toLowerCase()))
    if (recipients.length === 0) {
      await admin.from('event_reminder_log').insert({
        event_id, reminder_type, recipient_count: 0,
        notes: `all ${skippedDeclined} recipient(s) had RSVP'd not_attending`,
      })
      return new Response(JSON.stringify({ success: true, recipient_count: 0, reason: 'all_declined', skipped_declined: skippedDeclined }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Build common email pieces.
    //
    // The calendar attachment is now BEST-EFFORT. Previously a throw here (see
    // utf8ToBase64's note) propagated out of the handler, so: no email to
    // anyone, and no event_reminder_log row — which meant the every-5-minutes
    // imminent-reminders cron retried the same poisoned event forever, silently.
    // A missing .ics is a far smaller problem than a missing reminder, so a
    // calendar failure now degrades to sending without the attachment.
    const programType = (event as any).collaboratives?.program_type as string | undefined
    let icsBase64: string | null = null
    let logNotes: string | null = null
    try {
      icsBase64 = utf8ToBase64(buildIcs(event, programType))
    } catch (icsErr) {
      logNotes = `.ics build failed, sent without calendar attachment: ${(icsErr as Error).message}`
      console.error(logNotes)
    }
    const subject = reminderSubject(event, reminder_type)
    const headline = reminderHeadline(event, reminder_type)
    const eventDateLabel = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    const timeLabel = event.start_time
      ? (event.end_time ? `${event.start_time.slice(0,5)}–${event.end_time.slice(0,5)} ${event.timezone === 'America/New_York' ? 'ET' : event.timezone || ''}`
                        : `${event.start_time.slice(0,5)} ${event.timezone === 'America/New_York' ? 'ET' : event.timezone || ''}`)
      : null

    // Each recipient gets their own personalised message (own rsvp_token, and
    // own footer link — see buildFooter).
    const buildMessage = (r: Recipient, rsvpToken: string) => {
      const attendUrl = `https://bsc.ctac.app/rsvp/${rsvpToken}?status=attending`
      const declineUrl = `https://bsc.ctac.app/rsvp/${rsvpToken}?status=not_attending`

      // Registrants have no unsubscribe_token — the old footer interpolated it
      // unconditionally, so a registrant would have received a dead
      // `/unsubscribe/null` link. Rather than mint a second token system for
      // them, reuse the cancel_token they already have: for a registrant,
      // "stop emailing me about this" and "cancel my registration" are the
      // same intent. Team members keep the real unsubscribe link.
      const footerLink = r.source === 'member' && r.unsubscribe_token
        ? { url: `https://bsc.ctac.app/unsubscribe/${r.unsubscribe_token}`, label: 'Unsubscribe from all notifications' }
        : r.cancel_token
          ? { url: `https://bsc.ctac.app/cancel-registration/${r.cancel_token}`, label: 'Cancel my registration' }
          : null

      const html = `<!doctype html><html><body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.5;">
        <div style="max-width: 640px; margin: 0 auto; padding: 1rem;">
          <h2 style="color: #0E1F56; margin-bottom: 0.25rem;">${esc(event.title)}</h2>
          <div style="color: #6b7280; font-size: 14px;">${esc(event.collaboratives?.name || '')}</div>
          <p style="margin-top: 1rem;">${esc(headline)}</p>
          <table cellpadding="6" style="margin: 0.75rem 0; font-size: 14px;">
            <tr><td style="color:#6b7280;">When</td><td><strong>${esc(eventDateLabel)}</strong>${timeLabel ? ` at ${esc(timeLabel)}` : ''}</td></tr>
            ${event.location ? `<tr><td style="color:#6b7280;">Where</td><td>${esc(event.location)}</td></tr>` : ''}
            ${event.zoom_link ? `<tr><td style="color:#6b7280;">Join</td><td><a href="${esc(event.zoom_link)}" style="color:#2563eb;">${esc(event.zoom_link)}</a></td></tr>` : ''}
          </table>
          <div style="margin: 1.5rem 0;">
            <a href="${attendUrl}" style="display:inline-block; background:#16a34a; color:white; text-decoration:none; padding:0.6rem 1rem; border-radius:6px; margin-right:0.5rem; font-weight:600;">✓ I plan to attend</a>
            <a href="${declineUrl}" style="display:inline-block; background:#fee2e2; color:#991b1b; text-decoration:none; padding:0.6rem 1rem; border-radius:6px; margin-right:0.5rem; font-weight:600;">✕ Can't attend</a>
          </div>
          ${icsBase64 ? `<p style="font-size: 13px; color: #6b7280;">An <strong>add-to-calendar</strong> file (event.ics) is attached — open it in Apple Calendar, Outlook, or Google Calendar to RSVP locally.</p>` : ''}
          <hr style="margin-top: 2rem; border: 0; border-top: 1px solid #e5e7eb;"/>
          <p style="font-size: 11px; color: #9ca3af;">
            You're receiving this because you're ${r.source === 'member' ? 'a member of' : 'registered for'} <strong>${esc(event.collaboratives?.name || 'a collaborative')}</strong> on the CTAC BSC Manager.
            ${footerLink ? `<a href="${footerLink.url}" style="color:#9ca3af; text-decoration: underline;">${esc(footerLink.label)}</a>.` : ''}
          </p>
        </div></body></html>`

      const text = [
        event.title,
        event.collaboratives?.name || null,
        '',
        headline,
        '',
        `When: ${eventDateLabel}${timeLabel ? ' at ' + timeLabel : ''}`,
        event.location ? `Where: ${event.location}` : null,
        event.zoom_link ? `Join: ${event.zoom_link}` : null,
        '',
        `I'm attending: ${attendUrl}`,
        `Can't attend:  ${declineUrl}`,
        '',
        footerLink ? `${footerLink.label}: ${footerLink.url}` : null,
      ].filter(p => p !== null).join('\n')

      return { html, text }
    }

    const sendOne = async (r: Recipient): Promise<boolean> => {
      const rsvpToken = tokenByEmail.get(r.email.toLowerCase())
      if (!rsvpToken) return false
      const { html, text } = buildMessage(r, rsvpToken)

      const resendPayload: Record<string, unknown> = {
        from: 'CTAC <no-reply@ctac.app>',
        to: [r.email],
        subject,
        html, text,
      }
      if (icsBase64) {
        resendPayload.attachments = [
          { filename: 'event.ics', content: icsBase64, content_type: 'text/calendar' },
        ]
      }

      // Retry on 429 (and on a thrown request) with exponential backoff,
      // honouring Retry-After when Resend supplies it.
      //
      // This matters at cohort scale. Resend's per-account rate limit is only a
      // couple of requests per second unless raised, so a 297-recipient send
      // WILL be throttled: the pool below simply self-limits to whatever Resend
      // allows, and the backoff is what keeps a throttled recipient from
      // silently losing their reminder — which is the exact class of failure
      // this whole change exists to remove. 5 attempts with 0.5/1/2/4s backoff
      // tolerates a sustained throttle; total wall clock stays far inside the
      // edge-function limit even if every send needs a retry.
      const MAX_ATTEMPTS = 5
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const backoff = () => new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt)))
        try {
          const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(resendPayload),
          })
          if (resp.ok) return true
          if (resp.status === 429 && attempt < MAX_ATTEMPTS - 1) {
            const retryAfter = Number(resp.headers?.get?.('retry-after'))
            if (Number.isFinite(retryAfter) && retryAfter > 0) {
              await new Promise(res => setTimeout(res, Math.min(retryAfter, 10) * 1000))
            } else {
              await backoff()
            }
            continue
          }
          console.error(`reminder send failed for ${r.email}`, resp.status, (await resp.text()).slice(0, 300))
          return false
        } catch (err) {
          if (attempt === MAX_ATTEMPTS - 1) {
            console.error(`reminder send threw for ${r.email}:`, (err as Error).message)
            return false
          }
          await backoff()
        }
      }
      return false
    }

    // Bounded concurrency rather than one-at-a-time. The old loop awaited each
    // Resend call in series; at 297 recipients that is 297 sequential round
    // trips in a single invocation, which risks the wall-clock limit. A small
    // pool keeps us well inside it without stampeding Resend's rate limit.
    const CONCURRENCY = 4
    let sent = 0
    let failed = 0
    let cursor = 0
    const worker = async () => {
      while (cursor < recipients.length) {
        const r = recipients[cursor++]
        if (await sendOne(r)) sent += 1
        else failed += 1
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, recipients.length) }, worker))

    // `failed` used to be computed and thrown away, so a send where most
    // recipients errored looked identical to a clean one. Persist it.
    await admin.from('event_reminder_log').insert({
      event_id, reminder_type,
      recipient_count: sent,
      failed_count: failed,
      notes: logNotes,
    })

    return new Response(JSON.stringify({
      success: true, sent, failed,
      recipient_count: recipients.length,
      members: recipients.filter(r => r.source === 'member').length,
      registrants: recipients.filter(r => r.source === 'registrant').length,
      skipped_declined: skippedDeclined,
      calendar_attached: !!icsBase64,
      notes: logNotes,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
