import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Send pre-event reminder emails to all participants of one event,
// embedding RSVP buttons + Add-to-Calendar (.ics) + unsubscribe link.
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

// Build an ICS calendar file for the event.
// All-day events not supported here — we require start_time.
function buildIcs(event: any): string {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const tz = event.timezone || 'America/New_York'
  // Build ISO-style strings for DTSTART/DTEND in TZID format.
  // event_date is YYYY-MM-DD, start_time is HH:MM:SS.
  const startBits = event.start_time?.split(':') || ['00','00','00']
  const endBits = event.end_time?.split(':') || startBits
  const dateNoDash = event.event_date.replace(/-/g, '')
  const start = `${dateNoDash}T${startBits[0]}${startBits[1]}${startBits[2] || '00'}`
  const end = `${dateNoDash}T${endBits[0]}${endBits[1]}${endBits[2] || '00'}`
  const description = [
    event.title,
    event.zoom_link ? `Join: ${event.zoom_link}` : null,
    event.location ? `Location: ${event.location}` : null,
  ].filter(Boolean).join('\\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CTAC//BSC Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@bsc.ctac.app`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${tz}:${start}`,
    `DTEND;TZID=${tz}:${end}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${description}`,
    event.location ? `LOCATION:${event.location}` : '',
    event.zoom_link ? `URL:${event.zoom_link}` : '',
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
      .select('id, title, event_date, start_time, end_time, location, zoom_link, timezone, collaborative_id, collaboratives(name)')
      .eq('id', event_id)
      .single()
    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Resolve recipients: every active member of every team in the collab,
    // minus anyone who has unsubscribed.
    const { data: teams } = await admin
      .from('teams').select('id').eq('collaborative_id', event.collaborative_id)
    const teamIds = (teams || []).map(t => t.id)
    if (teamIds.length === 0) {
      return new Response(JSON.stringify({ success: true, recipient_count: 0, reason: 'no_teams' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: members } = await admin
      .from('user_profiles')
      .select('id, full_name, email, unsubscribe_token, notifications_unsubscribed_at')
      .in('team_id', teamIds)
      .eq('is_active', true)
    const recipients = (members || []).filter(m => m.email && !m.notifications_unsubscribed_at)

    if (recipients.length === 0) {
      await admin.from('event_reminder_log').insert({ event_id, reminder_type, recipient_count: 0 })
      return new Response(JSON.stringify({ success: true, recipient_count: 0, reason: 'no_recipients' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Upsert event_rsvps so each recipient has a stable token.
    const rsvpRows = recipients.map(r => ({ event_id, user_id: r.id, email: r.email }))
    await admin.from('event_rsvps').upsert(rsvpRows, { onConflict: 'event_id,email', ignoreDuplicates: true })
    const { data: rsvps } = await admin
      .from('event_rsvps')
      .select('email, rsvp_token')
      .eq('event_id', event_id)
    const tokenByEmail = new Map<string, string>((rsvps || []).map(r => [r.email.toLowerCase(), r.rsvp_token]))

    // Build common email pieces.
    const ics = buildIcs(event)
    const icsBase64 = btoa(ics)
    const subject = reminderSubject(event, reminder_type)
    const headline = reminderHeadline(event, reminder_type)
    const eventDateLabel = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    const timeLabel = event.start_time
      ? (event.end_time ? `${event.start_time.slice(0,5)}–${event.end_time.slice(0,5)} ${event.timezone === 'America/New_York' ? 'ET' : event.timezone || ''}`
                        : `${event.start_time.slice(0,5)} ${event.timezone === 'America/New_York' ? 'ET' : event.timezone || ''}`)
      : null

    // Send each recipient their own personalised email (rsvp_token + unsubscribe_token).
    let sent = 0
    let failed = 0
    for (const r of recipients) {
      const rsvpToken = tokenByEmail.get(r.email.toLowerCase())
      if (!rsvpToken) continue
      const attendUrl = `https://bsc.ctac.app/rsvp/${rsvpToken}?status=attending`
      const declineUrl = `https://bsc.ctac.app/rsvp/${rsvpToken}?status=not_attending`
      const unsubUrl = `https://bsc.ctac.app/unsubscribe/${r.unsubscribe_token}`

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
          <p style="font-size: 13px; color: #6b7280;">An <strong>add-to-calendar</strong> file (event.ics) is attached — open it in Apple Calendar, Outlook, or Google Calendar to RSVP locally.</p>
          <hr style="margin-top: 2rem; border: 0; border-top: 1px solid #e5e7eb;"/>
          <p style="font-size: 11px; color: #9ca3af;">
            You're receiving this because you're a member of <strong>${esc(event.collaboratives?.name || 'a collaborative')}</strong> on the CTAC BSC Manager.
            <a href="${unsubUrl}" style="color:#9ca3af; text-decoration: underline;">Unsubscribe from all notifications</a>.
          </p>
        </div></body></html>`

      const text = [
        event.title,
        event.collaboratives?.name || '',
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
        `Unsubscribe: ${unsubUrl}`,
      ].filter(Boolean).join('\n')

      const resendPayload = {
        from: 'CTAC <no-reply@ctac.app>',
        to: [r.email],
        subject,
        html, text,
        attachments: [
          { filename: 'event.ics', content: icsBase64, content_type: 'text/calendar' },
        ],
      }

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(resendPayload),
      })
      if (resp.ok) sent += 1; else failed += 1
    }

    await admin.from('event_reminder_log').insert({ event_id, reminder_type, recipient_count: sent })

    return new Response(JSON.stringify({ success: true, sent, failed, recipient_count: recipients.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
