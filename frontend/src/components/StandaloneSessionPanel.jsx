import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'
import QrCodeModal from './QrCodeModal'
import RegistrationLinkModal from './RegistrationLinkModal'

// Attendance + evaluation control panel for a STANDALONE TRAINING.
//
// Collaborative events get this from CollaborativeDetail's schedule table, which
// is scoped to a collaborative and therefore unreachable for a standalone
// training. Rather than loosen that page, this is a self-contained panel shown on
// the standalone training's own Manage page — collaborative flows are untouched.
//
// The three public pages it hands out are the SAME ones collaborative sessions
// use (/session/:token, .../eval, .../signout); nothing new was built on the
// attendee side. The evaluation page already redirects to sign-out on submit, so
// an attendee who scans the evaluation QR is signed out at the end of it.
export default function StandaloneSessionPanel({ event, canManage }) {
  const [link, setLink] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({ signedIn: 0, signedOut: 0, evals: 0 })
  const [qr, setQr] = useState(null)     // { url, title, filename }
  const [copied, setCopied] = useState(null)
  const [regLink, setRegLink] = useState(null)
  const [showRegModal, setShowRegModal] = useState(false)

  const origin = window.location.origin

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Newest first: regenerating leaves the old row in place (deactivated), and
      // .maybeSingle() would throw on more than one row.
      const { data: links, error: e1 } = await supabase
        .from('session_links')
        .select('*')
        .eq('bsc_event_id', event.id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (e1) throw e1
      const current = links?.[0] || null
      setLink(current)

      const { data: att, error: e2 } = await supabase
        .from('session_attendance')
        .select('id, signed_out_at, evaluation_completed_at')
        .eq('bsc_event_id', event.id)
      if (e2) throw e2

      const { count: evalCount, error: e3 } = await supabase
        .from('session_evaluations')
        .select('id', { count: 'exact', head: true })
        .eq('bsc_event_id', event.id)
      if (e3) throw e3

      setStats({
        signedIn: (att || []).length,
        signedOut: (att || []).filter(a => a.signed_out_at).length,
        evals: evalCount ?? 0,
      })

      // Registration link covering this training, if one exists. Found through
      // the join table rather than by collaborative, since there isn't one.
      const { data: cover, error: e4 } = await supabase
        .from('event_registration_link_events')
        // Full row, not a subset: this object is handed to RegistrationLinkModal
        // as editingLink, and a partial would blank out description, waitlist,
        // open/close dates and form_schema on the next save.
        .select('registration_link_id, event_registration_links ( * )')
        .eq('event_id', event.id)
      if (e4) throw e4
      setRegLink(cover?.[0]?.event_registration_links || null)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [event.id])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    setBusy(true); setError(null)
    try {
      // 8 chars from the same alphabet CollaborativeDetail uses, so tokens look
      // consistent across the app.
      const token = Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 8)

      // Expire at end of day Eastern on the LAST day of the training, via the
      // same SQL helper the roster-share expiry uses — so DST is resolved in one
      // place instead of being reconstructed in the browser. (CollaborativeDetail
      // hardcodes "4PM EST = 9PM UTC", which is an hour off during EDT; not
      // touching it here, but this panel doesn't repeat it.)
      const lastDay = event.end_date || event.event_date
      const { data: expiresAt, error: rpcErr } = await supabase
        .rpc('roster_share_expiry_for_date', { p_date: lastDay })
      if (rpcErr) throw rpcErr

      const { data, error: insErr } = await supabase
        .from('session_links')
        .insert({
          bsc_event_id: event.id,
          collaborative_id: null,   // standalone: no collaborative by design
          token,
          expires_at: expiresAt,
        })
        .select().single()
      if (insErr) throw insErr
      setLink(data)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const setActive = async (active) => {
    if (!link) return
    if (!active && !window.confirm(
      'Close sign-in for this training?\n\nThe links and QR codes stop working, and anyone who never signed out is marked as signed out automatically.'
    )) return
    setBusy(true); setError(null)
    try {
      const { error: e1 } = await supabase
        .from('session_links').update({ is_active: active }).eq('id', link.id)
      if (e1) throw e1
      if (!active) {
        // Same bulk sign-out CollaborativeDetail does when closing a session, so
        // nobody is left indefinitely "still here".
        const { error: e2 } = await supabase
          .from('session_attendance')
          .update({ signed_out_at: new Date().toISOString(), sign_out_method: 'session_closed' })
          .eq('bsc_event_id', event.id)
          .is('signed_out_at', null)
        if (e2) throw e2
      }
      await load()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const copy = async (url, key) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(key)
      setTimeout(() => setCopied(c => (c === key ? null : c)), 1800)
    } catch {
      setError('Could not copy to the clipboard — select the link and copy it manually.')
    }
  }

  if (!canManage) return null

  const rows = link ? [
    {
      key: 'signin', label: 'Sign-in',
      hint: 'Scan on arrival. Attendees enter name, email and agency.',
      url: `${origin}/session/${link.token}`,
    },
    {
      key: 'eval', label: 'Evaluation',
      // The previous wording ("signs the attendee out automatically") was wrong
      // twice over: the evaluation doesn't sign anyone out — it hands off to the
      // sign-out page, which does — and it implied the evaluation knows who
      // submitted it. The answers carry no identity at all.
      hint: 'Answers are anonymous. Submitting sends them straight to sign-out.',
      url: `${origin}/session/${link.token}/eval`,
    },
    {
      key: 'signout', label: 'Sign-out',
      hint: 'For anyone leaving without evaluating. Same phone they signed in on.',
      url: `${origin}/session/${link.token}/signout`,
    },
  ] : []

  return (
    <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
      <div style={cardHeaderStyle}>
        <h3 style={{ margin: 0, color: COLORS.navy, fontSize: '1rem' }}>Attendance &amp; Evaluation</h3>
      </div>
      <div style={{ padding: '1rem' }}>
        {error && (
          <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 0.8rem', marginBottom: '0.8rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.88rem' }}>Loading…</p>
        ) : !link ? (
          <>
            <p style={{ margin: '0 0 0.8rem', color: '#4b5563', fontSize: '0.88rem' }}>
              Create the sign-in link to get QR codes for sign-in, the evaluation and sign-out.
              Attendees don&apos;t need an account.
            </p>
            <button
              onClick={generate}
              disabled={busy}
              style={{ background: COLORS.teal, color: 'white', border: 'none', padding: '0.55rem 1.1rem', borderRadius: '6px', cursor: busy ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
            >{busy ? 'Creating…' : 'Create sign-in link'}</button>
          </>
        ) : (
          <>
            {/* Counts */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem', paddingBottom: '0.9rem', borderBottom: '1px solid #e5e7eb' }}>
              {[
                ['Signed in', stats.signedIn],
                ['Signed out', stats.signedOut],
                ['Evaluations', stats.evals],
                ['Still here', Math.max(0, stats.signedIn - stats.signedOut)],
              ].map(([label, n]) => (
                <div key={label}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: COLORS.navy, lineHeight: 1.1 }}>{n}</div>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
                </div>
              ))}
              {!link.is_active && (
                <div style={{ alignSelf: 'center', background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600 }}>
                  Sign-in closed
                </div>
              )}
            </div>

            {!link.is_active && (
              <p style={{ margin: '0 0 0.9rem', fontSize: '0.82rem', color: '#92400e' }}>
                These links are closed and will not accept anyone. Reopen to use them again.
              </p>
            )}

            {rows.map(r => (
              <div key={r.key} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', flexWrap: 'wrap', padding: '0.6rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ minWidth: '150px', flex: '1 1 220px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111827' }}>{r.label}</div>
                  <div style={{ fontSize: '0.76rem', color: '#6b7280' }}>{r.hint}</div>
                  <code style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.72rem', color: '#4b5563', wordBreak: 'break-all' }}>{r.url}</code>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button
                    onClick={() => copy(r.url, r.key)}
                    style={{ background: 'transparent', border: '1px solid #d1d5db', padding: '0.35rem 0.7rem', borderRadius: '5px', cursor: 'pointer', fontSize: '0.78rem', color: '#374151', whiteSpace: 'nowrap' }}
                  >{copied === r.key ? 'Copied' : 'Copy link'}</button>
                  <button
                    onClick={() => setQr({ url: r.url, title: `${r.label} QR Code`, filename: `${event.title}-${r.key}` })}
                    style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.35rem 0.7rem', borderRadius: '5px', cursor: 'pointer', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                  >QR code</button>
                </div>
              </div>
            ))}

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActive(!link.is_active)}
                disabled={busy}
                style={{ background: link.is_active ? '#fef2f2' : '#ecfdf5', color: link.is_active ? '#991b1b' : '#065f46', border: `1px solid ${link.is_active ? '#fecaca' : '#a7f3d0'}`, padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: busy ? 'wait' : 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
              >{busy ? 'Working…' : link.is_active ? 'Close sign-in' : 'Reopen sign-in'}</button>
              <button
                onClick={load}
                disabled={busy}
                style={{ background: 'transparent', border: '1px solid #d1d5db', padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', color: '#374151' }}
              >Refresh counts</button>
            </div>

            <p style={{ margin: '0.9rem 0 0', fontSize: '0.76rem', color: '#9ca3af' }}>
              Links stop working after {new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium' }).format(new Date(link.expires_at))} (end of day Eastern).
            </p>
          </>
        )}
      </div>

      {/* Registration — separate from attendance on purpose: sign-up happens
          before the day, sign-in happens on it. */}
      <div style={{ borderTop: '1px solid #e5e7eb', padding: '1rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: COLORS.navy, marginBottom: '0.5rem' }}>Registration</div>
        {regLink ? (
          <>
            <div style={{ fontSize: '0.82rem', color: '#4b5563', marginBottom: '0.35rem' }}>
              <strong>{regLink.title}</strong>
              {!regLink.is_active && <span style={{ marginLeft: '0.4rem', background: '#fef3c7', color: '#92400e', padding: '0.1rem 0.45rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600 }}>closed</span>}
              {regLink.capacity != null && <span style={{ color: '#6b7280' }}> · capacity {regLink.capacity}</span>}
            </div>
            <code style={{ display: 'block', fontSize: '0.72rem', color: '#4b5563', wordBreak: 'break-all', marginBottom: '0.45rem' }}>
              {`${origin}/register/${regLink.token}`}
            </code>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => copy(`${origin}/register/${regLink.token}`, 'register')}
                style={{ background: 'transparent', border: '1px solid #d1d5db', padding: '0.35rem 0.7rem', borderRadius: '5px', cursor: 'pointer', fontSize: '0.78rem', color: '#374151' }}
              >{copied === 'register' ? 'Copied' : 'Copy link'}</button>
              <button
                onClick={() => setQr({ url: `${origin}/register/${regLink.token}`, title: 'Registration QR Code', filename: `${event.title}-register` })}
                style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.35rem 0.7rem', borderRadius: '5px', cursor: 'pointer', fontSize: '0.78rem' }}
              >QR code</button>
              <button
                onClick={() => setShowRegModal(true)}
                style={{ background: 'transparent', border: '1px solid #d1d5db', padding: '0.35rem 0.7rem', borderRadius: '5px', cursor: 'pointer', fontSize: '0.78rem', color: '#374151' }}
              >Edit form</button>
            </div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.76rem', color: '#9ca3af' }}>
              The roster, CSV export and shareable roster link live on Registrations in the admin menu.
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', color: '#4b5563' }}>
              No registration link yet. Create one to collect sign-ups before the training, with an optional capacity and waitlist.
            </p>
            <button
              onClick={() => setShowRegModal(true)}
              style={{ background: 'transparent', color: COLORS.navy, border: `1px solid ${COLORS.navy}`, padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
            >Create registration link</button>
          </>
        )}
      </div>

      {showRegModal && (
        <RegistrationLinkModal
          // No collaborative: the modal writes collaborative_id straight through,
          // and the RLS policy authorizes a NULL-collab link by creator instead.
          collaborativeId={null}
          eventsForCollab={[event]}
          editingLink={regLink}
          programType={null}
          onClose={() => setShowRegModal(false)}
          onSaved={() => { setShowRegModal(false); load() }}
        />
      )}

      {qr && (
        <QrCodeModal
          url={qr.url}
          title={qr.title}
          filename={qr.filename}
          subtitle={event.title}
          onClose={() => setQr(null)}
        />
      )}
    </div>
  )
}
