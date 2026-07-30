import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import { COLORS } from '../utils/constants'

// "Share roster" admin modal for one registration link.
//
// Writes go through the normal authenticated admin path — RLS
// "Admins manage registration links" via is_admin_for_collaborative — NOT the
// public lookup-roster edge function. That function is read-only for partners.
//
// The default access code is seeded here rather than as a column DEFAULT so it
// stays out of the schema, and it is editable per link without a deploy.
const DEFAULT_ACCESS_CODE = '2112'

// The expiry date box is an EASTERN calendar date, because the rule is "end of
// the day, Eastern". Reading it needs an explicit conversion: slicing the first
// 10 characters off a timestamptz gives the UTC date, which for an 11:59 PM ET
// instant is the NEXT day — that was the bug (the picker showed Oct 29 for a
// value meaning Oct 28, and reopening the modal drifted it again).
function etDateOf(ts) {
  if (!ts) return ''
  // en-CA formats as YYYY-MM-DD, which is exactly what <input type="date"> wants.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ts))
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem', zIndex: 1000,
}

export default function RosterShareModal({ link, onClose, onSaved }) {
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  // Form state
  const [includeEmails, setIncludeEmails] = useState(false)
  const [accessCode, setAccessCode] = useState(DEFAULT_ACCESS_CODE)
  const [expiresAt, setExpiresAt] = useState('') // yyyy-mm-dd

  useEffect(() => {
    ;(async () => {
      const { data, error: err } = await supabase
        .from('event_registration_links')
        .select('id, title, roster_share_token, roster_share_include_emails, roster_share_access_code, roster_share_expires_at, roster_share_revoked_at, roster_share_view_count, roster_share_last_viewed_at')
        .eq('id', link.id)
        .single()
      if (err) { setError(err.message); setLoading(false); return }
      setRow(data)
      setIncludeEmails(data.roster_share_include_emails === true)
      setAccessCode(data.roster_share_access_code || DEFAULT_ACCESS_CODE)
      setExpiresAt(etDateOf(data.roster_share_expires_at))
      // Prefill the expiry from the "day after Session 1" rule for a link that
      // has never been shared, so Josh sees the suggested date before saving.
      if (!data.roster_share_expires_at) {
        const { data: def } = await supabase.rpc('default_roster_share_expiry', { p_link_id: link.id })
        if (def) setExpiresAt(etDateOf(def))
      }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.id])

  const shareUrl = row?.roster_share_token
    ? `https://bsc.ctac.app/roster/${row.roster_share_token}`
    : null

  const patch = async (fields, { regenerate = false } = {}) => {
    setSaving(true)
    setError(null)
    const body = { ...fields }
    if (regenerate) {
      // 16 random bytes as hex, matching the other tokens in this system.
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)
      body.roster_share_token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
      // Regenerating is the "this leaked" action, so clear any lockout state
      // too — the new URL should start clean.
      body.roster_share_failed_attempts = 0
      body.roster_share_locked_until = null
    }
    const { data, error: err } = await supabase
      .from('event_registration_links')
      .update(body)
      .eq('id', link.id)
      .select('id, roster_share_token, roster_share_include_emails, roster_share_access_code, roster_share_expires_at, roster_share_revoked_at, roster_share_view_count, roster_share_last_viewed_at')
    setSaving(false)
    if (err) { setError(err.message); return false }
    if (!data || data.length === 0) {
      setError('Nothing was saved — you may not have admin access to this collaborative.')
      return false
    }
    setRow(data[0])
    onSaved?.()
    return true
  }

  const save = async () => {
    if (!accessCode.trim()) { setError('An access code is required.'); return }
    if (!expiresAt) { setError('An expiry date is required.'); return }

    // Convert the Eastern calendar date to an instant in SQL rather than here.
    // Sending a naive `${expiresAt}T23:59:59` made PostgREST interpret it in the
    // session zone (UTC), storing 7:59 PM ET instead of 11:59 PM ET. The helper
    // shares the AT TIME ZONE construction with default_roster_share_expiry(),
    // so the offset is resolved per-date and DST is handled in one place.
    const { data: instant, error: convErr } = await supabase
      .rpc('roster_share_expiry_for_date', { p_date: expiresAt })
    if (convErr) { setError(`Could not set the expiry date: ${convErr.message}`); return }

    await patch({
      roster_share_include_emails: includeEmails,
      roster_share_access_code: accessCode.trim(),
      roster_share_expires_at: instant,
    }, { regenerate: !row?.roster_share_token })
  }

  const revoked = !!row?.roster_share_revoked_at
  const expired = row?.roster_share_expires_at && new Date(row.roster_share_expires_at) < new Date()

  return (
    <div style={overlay} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '10px', padding: '1.5rem', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h3 style={{ margin: '0 0 0.25rem', color: COLORS.navy, fontSize: '1.1rem' }}>Share roster</h3>
        <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '1rem' }}>{link.title}</div>

        {loading ? <p style={{ color: '#6b7280' }}>Loading…</p> : (
          <>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#92400e', marginBottom: '1rem', lineHeight: 1.5 }}>
              Anyone with this URL <strong>and</strong> the access code can see registrant
              names{includeEmails ? ' and email addresses' : ''}. Send the code separately from
              the link — pasted together in one email, it adds almost nothing.
            </div>

            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.88rem', marginBottom: '0.85rem' }}>
              <input type="checkbox" checked={includeEmails} onChange={e => setIncludeEmails(e.target.checked)} style={{ marginTop: '0.2rem' }} />
              <span>
                <strong>Include email addresses</strong>
                <span style={{ display: 'block', color: '#6b7280', fontSize: '0.78rem' }}>
                  Off by default. Leave off unless the partner genuinely needs to contact registrants.
                </span>
              </span>
            </label>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
              <div style={{ flex: '1 1 10rem' }}>
                <label style={labelStyle}>Access code</label>
                <input value={accessCode} onChange={e => setAccessCode(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: '1 1 10rem' }}>
                <label style={labelStyle}>Expires after (end of day, ET)</label>
                <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</div>
            )}

            {shareUrl && (
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.7rem 0.75rem', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                  <Badge on={!includeEmails} label={includeEmails ? 'emails visible' : 'emails hidden'} />
                  {revoked && <Badge danger label="revoked" />}
                  {!revoked && expired && <Badge danger label="expired" />}
                  {!revoked && !expired && <Badge ok label="active" />}
                </div>
                <code style={{ fontSize: '0.72rem', color: '#374151', wordBreak: 'break-all' }}>{shareUrl}</code>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                    style={btn(COLORS.navy, 'white')}
                  >{copied ? 'Copied' : 'Copy link'}</button>
                  <button onClick={() => patch({}, { regenerate: true })} disabled={saving} style={btnOutline('#92400e')}>
                    Regenerate token
                  </button>
                  {revoked ? (
                    <button onClick={() => patch({ roster_share_revoked_at: null })} disabled={saving} style={btnOutline('#166534')}>Un-revoke</button>
                  ) : (
                    <button onClick={() => patch({ roster_share_revoked_at: new Date().toISOString() })} disabled={saving} style={btnOutline('#991b1b')}>Revoke</button>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  Viewed <strong>{row.roster_share_view_count || 0}</strong> time{(row.roster_share_view_count || 0) === 1 ? '' : 's'}
                  {row.roster_share_last_viewed_at && <> · last {new Date(row.roster_share_last_viewed_at).toLocaleString()}</>}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.3rem' }}>
                  Regenerating makes the old URL stop working immediately.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={btnOutline('#374151')}>Close</button>
              <button onClick={save} disabled={saving} style={btn(COLORS.teal, 'white')}>
                {saving ? 'Saving…' : shareUrl ? 'Save changes' : 'Create share link'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Badge({ label, on, ok, danger }) {
  const style = danger
    ? { bg: '#fee2e2', fg: '#991b1b' }
    : ok ? { bg: '#dcfce7', fg: '#166534' }
    : on ? { bg: '#f3f4f6', fg: '#374151' }
    : { bg: '#fef3c7', fg: '#92400e' }
  return (
    <span style={{ background: style.bg, color: style.fg, padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>{label}</span>
  )
}

const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.2rem' }
const inputStyle = { width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.88rem', boxSizing: 'border-box' }
const btn = (bg, fg) => ({ background: bg, color: fg, border: 'none', padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 })
const btnOutline = (c) => ({ background: 'transparent', color: c, border: `1px solid ${c}`, padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 })
