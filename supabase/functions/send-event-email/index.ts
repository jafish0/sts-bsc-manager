import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Trainer/coordinator-composed email about a specific event.
// Now sends ONE email per recipient (no BCC) so each gets a personalised
// unsubscribe link. Recipients who have unsubscribed are skipped.
//
// Body: { event_id, recipients_type: 'all' | 'team' | 'coordinator', team_id?, subject, body }
// Auth: super_admin OR trainer-on-collab.

function esc(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const token = authHeader.replace('Bearer ', '')

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { data: { user: caller }, error: authError } = await admin.auth.getUser(token)
    if (authError || !caller) return new Response(JSON.stringify({ error: 'Invalid authentication' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: callerProfile, error: profileError } = await admin
      .from('user_profiles').select('role, full_name, email').eq('id', caller.id).single()
    if (profileError || !callerProfile) return new Response(JSON.stringify({ error: 'Could not verify caller profile' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { event_id, recipients_type, team_id, subject, body } = await req.json()
    if (!event_id || !recipients_type || !subject || !body) {
      return new Response(JSON.stringify({ error: 'event_id, recipients_type, subject, and body are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!['all','team','coordinator'].includes(recipients_type)) {
      return new Response(JSON.stringify({ error: 'Invalid recipients_type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: event, error: eventError } = await admin
      .from('bsc_events').select('id, title, event_date, collaborative_id, collaboratives ( id, name )').eq('id', event_id).single()
    if (eventError || !event) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    let authorized = callerProfile.role === 'super_admin'
    if (!authorized) {
      const { data: trainerRow } = await admin.from('collaborative_trainers').select('id').eq('collaborative_id', event.collaborative_id).eq('user_id', caller.id).maybeSingle()
      authorized = !!trainerRow
    }
    if (!authorized) return new Response(JSON.stringify({ error: 'Not authorized to send email for this event' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Build recipient list with per-user unsubscribe tokens.
    type Recipient = { email: string; full_name?: string | null; unsubscribe_token?: string | null; unsubscribed?: boolean }
    let recipients: Recipient[] = []

    if (recipients_type === 'team') {
      if (!team_id) return new Response(JSON.stringify({ error: 'team_id required when recipients_type=team' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const { data: teamMembers } = await admin
        .from('user_profiles')
        .select('email, full_name, unsubscribe_token, notifications_unsubscribed_at')
        .eq('team_id', team_id).eq('is_active', true)
      recipients = (teamMembers || []).filter(m => m.email).map(m => ({
        email: m.email, full_name: m.full_name,
        unsubscribe_token: m.unsubscribe_token,
        unsubscribed: !!m.notifications_unsubscribed_at,
      }))
    } else if (recipients_type === 'all') {
      const { data: teams } = await admin.from('teams').select('id').eq('collaborative_id', event.collaborative_id)
      const teamIds = (teams || []).map(t => t.id)
      if (teamIds.length > 0) {
        const { data: allMembers } = await admin
          .from('user_profiles')
          .select('email, full_name, unsubscribe_token, notifications_unsubscribed_at')
          .in('team_id', teamIds).eq('is_active', true)
        recipients = (allMembers || []).filter(m => m.email).map(m => ({
          email: m.email, full_name: m.full_name,
          unsubscribe_token: m.unsubscribe_token,
          unsubscribed: !!m.notifications_unsubscribed_at,
        }))
      }
    } else {
      const { data: coordRows } = await admin
        .from('collaborative_trainers')
        .select('user_profiles ( email, full_name, unsubscribe_token, notifications_unsubscribed_at )')
        .eq('collaborative_id', event.collaborative_id)
        .eq('is_coordinator', true)
      // @ts-ignore — nested
      recipients = (coordRows || []).map((r: any) => r.user_profiles).filter((u: any) => u?.email).map((u: any) => ({
        email: u.email, full_name: u.full_name,
        unsubscribe_token: u.unsubscribe_token,
        unsubscribed: !!u.notifications_unsubscribed_at,
      }))
    }

    // Drop unsubscribed + dedupe (case-insensitive on email).
    const seen = new Set<string>()
    const eligible = recipients.filter(r => {
      if (r.unsubscribed) return false
      const k = r.email.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    if (eligible.length === 0) {
      return new Response(JSON.stringify({ error: 'No eligible recipients found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const senderName = callerProfile.full_name || 'CTAC'
    const fromAddress = `${senderName} via CTAC <no-reply@ctac.app>`

    let sent = 0; let failed = 0
    for (const r of eligible) {
      const unsubUrl = r.unsubscribe_token ? `https://bsc.ctac.app/unsubscribe/${r.unsubscribe_token}` : null
      const html = `<!doctype html><html><body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.5;">
        <div style="max-width: 640px; margin: 0 auto; padding: 1rem;">
          <div style="white-space: pre-wrap;">${esc(body)}</div>
          <hr style="margin-top: 2rem; border: 0; border-top: 1px solid #e5e7eb;"/>
          <p style="font-size: 12px; color: #6b7280;">Sent on behalf of ${esc(senderName)} for <strong>${esc(event.title)}</strong> (${esc(event.event_date)}). Reply directly to reach ${esc(senderName)}.</p>
          ${unsubUrl ? `<p style="font-size: 11px; color: #9ca3af;"><a href="${unsubUrl}" style="color:#9ca3af; text-decoration: underline;">Unsubscribe from all CTAC notifications</a></p>` : ''}
        </div></body></html>`
      const text = body + '\n\n— ' + senderName + (unsubUrl ? `\n\nUnsubscribe: ${unsubUrl}` : '')
      const resendPayload = {
        from: fromAddress, to: [r.email], reply_to: callerProfile.email,
        subject, html, text,
      }
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(resendPayload),
      })
      if (resp.ok) sent += 1; else failed += 1
    }

    return new Response(JSON.stringify({
      success: true, recipient_count: eligible.length, sent, failed,
      skipped_unsubscribed: recipients.length - eligible.length,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
