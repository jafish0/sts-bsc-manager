import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { eventsHeading, formatEventDate, formatTimeRange } from '../config/programConfig'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'
import ukLogo from '../assets/UK_Lockup-286.png'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// Breakpoint hook shared by the two responsive pieces below.
//
// matchMedia is the authority for the VALUE (correct on first paint, no
// off-by-one against CSS), but we subscribe to both its `change` event and
// `resize`. Some embedded/automated browsers resize the viewport without
// dispatching a matchMedia change — observed while verifying this page — and a
// stale layout there means a 3-column table on a 360px screen. Listening to
// both costs nothing and can't be wrong in either direction.
function useMaxWidth(px) {
  const query = `(max-width: ${px}px)`
  const read = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false
  const [matches, setMatches] = useState(read)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const sync = () => setMatches(mql.matches)
    sync()
    mql.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    return () => {
      mql.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
    }
  }, [query])
  return matches
}

// Public registration form. URL: /register/:token
// Renders dynamically from event_registration_links.form_schema, validates,
// and submits via the mint-registration edge function (which handles
// capacity + waitlist server-side).
export default function RegisterPage() {
  const { token } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [link, setLink] = useState(null)
  const [collab, setCollab] = useState(null) // { collaborative_name, program_type }
  const [events, setEvents] = useState([])
  const [windowStatus, setWindowStatus] = useState('open') // 'open' | 'pre_open' | 'closed'

  // Submission state
  const [responses, setResponses] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [confirmation, setConfirmation] = useState(null) // { status, waitlist_position, cancel_url, duplicate, message }
  const [honeypot, setHoneypot] = useState('') // bots fill, humans don't

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: l, error: lErr } = await supabase
          .from('event_registration_links')
          .select('*')
          .eq('token', token)
          .maybeSingle()
        if (cancelled) return
        if (lErr || !l) { setError('Invalid registration link.'); setLoading(false); return }
        setLink(l)

        // Collaborative name + program_type via RPC. anon can read
        // event_registration_links but NOT collaboratives, so the previous
        // `collaboratives(name, program_type)` embed silently returned null —
        // which dropped the name subtitle entirely and made the program-aware
        // heading fall back to the generic wording. Verified in-browser.
        const { data: collabRows } = await supabase
          .rpc('registration_link_public', { p_token: token })
        if (!cancelled) setCollab(Array.isArray(collabRows) ? collabRows[0] : collabRows)

        // Window status
        const now = new Date()
        if (!l.is_active || (l.registration_closes_at && new Date(l.registration_closes_at) < now)) {
          setWindowStatus('closed')
        } else if (l.registration_opens_at && new Date(l.registration_opens_at) > now) {
          setWindowStatus('pre_open')
        }

        // Pull events covered, through a SECURITY DEFINER RPC.
        //
        // This used to embed `bsc_events(...)` off event_registration_link_events,
        // but anon's only SELECT path on bsc_events requires an ACTIVE
        // session_link — which no future session has — so the embed resolved to
        // NULL for every row and this list rendered EMPTY. Verified against the
        // real AWARE link: 8 rows returned, bsc_events null on all 8. The RPC is
        // token-scoped and deliberately does not return zoom_link (Zoom belongs
        // in the confirmation email, not on a public page).
        const { data: evs } = await supabase
          .rpc('registration_link_events', { p_token: token })
        if (!cancelled) {
          setEvents((evs || []).map(e => ({ ...e, id: e.event_id })))
        }
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const setField = (key, value) => {
    setResponses(prev => ({ ...prev, [key]: value }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mint-registration`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, responses, honeypot }),
      })
      const json = await resp.json()
      if (!resp.ok) {
        setSubmitError(json.error || `Failed to register (HTTP ${resp.status})`)
        return
      }
      setConfirmation(json)
    } catch (err) {
      setSubmitError(err.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Shell>Loading…</Shell>
  if (error) return <Shell><p>{error}</p></Shell>

  // Confirmation screen
  if (confirmation) {
    return (
      <Shell wide>
        <h2 style={{ color: NAVY, marginTop: 0 }}>
          {confirmation.duplicate ? "You're already registered" : confirmation.status === 'waitlisted' ? "You're on the waitlist" : "You're registered!"}
        </h2>
        {confirmation.duplicate && (
          <p>{confirmation.message}</p>
        )}
        {!confirmation.duplicate && confirmation.status === 'registered' && (
          <p>Thanks! Check your inbox — we sent a confirmation with the event details and a calendar file you can add to Outlook, Apple Calendar, or Google Calendar.</p>
        )}
        {!confirmation.duplicate && confirmation.status === 'waitlisted' && (
          <p>You're #{confirmation.waitlist_position} on the waitlist. We'll email if a spot opens up.</p>
        )}
        <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
          Need to cancel later? Use this link: <a href={confirmation.cancel_url}>{confirmation.cancel_url}</a>
        </p>
      </Shell>
    )
  }

  const schema = link.form_schema || []
  const collabName = collab?.collaborative_name

  return (
    <Shell wide>
      <h2 style={{ color: NAVY, marginTop: 0, marginBottom: '0.25rem' }}>{link.title}</h2>
      {collabName && <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>{collabName}</div>}
      {link.description && <p style={{ color: '#374151' }}>{link.description}</p>}

      {events.length > 0 && <EventsTable events={events} programType={collab?.program_type} />}

      {windowStatus === 'closed' && (
        <Banner color="#991b1b" bg="#fee2e2">Registration is closed.</Banner>
      )}
      {windowStatus === 'pre_open' && (
        <Banner color="#92400e" bg="#fef3c7">Registration opens {new Date(link.registration_opens_at).toLocaleString()}.</Banner>
      )}

      {windowStatus === 'open' && (
        <form onSubmit={submit} style={{ marginTop: '1.5rem' }}>
          {schema.map(field => (
            <FieldRenderer key={field.key} field={field} value={responses[field.key] ?? ''} onChange={setField} />
          ))}

          {/* Honeypot — hidden from humans, bots usually fill */}
          <div style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }} aria-hidden="true">
            <label>Leave this field empty: <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={e => setHoneypot(e.target.value)} /></label>
          </div>

          {submitError && (
            <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: '6px', marginTop: '0.75rem', fontSize: '0.9rem' }}>{submitError}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '1rem', background: TEAL, color: 'white',
              border: 'none', padding: '0.7rem 1.4rem',
              borderRadius: '6px', fontSize: '1rem', fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >{submitting ? 'Submitting…' : 'Register'}</button>

          <p style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: '#9ca3af' }}>
            Your registration information will be shared with the trainers running this collaborative.
          </p>
        </form>
      )}
    </Shell>
  )
}

function FieldRenderer({ field, value, onChange }) {
  const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }
  const inputStyle = {
    width: '100%', padding: '0.55rem 0.75rem',
    border: '1px solid #d1d5db', borderRadius: '6px',
    fontSize: '0.95rem', boxSizing: 'border-box',
  }
  const required = !!field.required
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <label style={labelStyle}>
        {field.label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {field.helpText && (
        <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.25rem' }}>{field.helpText}</div>
      )}
      {field.type === 'textarea' ? (
        <textarea value={value} onChange={(e) => onChange(field.key, e.target.value)} required={required} rows={3} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} placeholder={field.placeholder || ''} />
      ) : field.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(field.key, e.target.value)} required={required} style={inputStyle}>
          <option value="">— Select —</option>
          {(field.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : field.type === 'radio' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {(field.options || []).map(o => (
            <label key={o.value} style={{ fontSize: '0.9rem' }}>
              <input type="radio" name={field.key} value={o.value} checked={value === o.value} onChange={() => onChange(field.key, o.value)} required={required} /> {o.label}
            </label>
          ))}
        </div>
      ) : field.type === 'yes_no' ? (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <label><input type="radio" name={field.key} value="yes" checked={value === 'yes'} onChange={() => onChange(field.key, 'yes')} required={required} /> Yes</label>
          <label><input type="radio" name={field.key} value="no" checked={value === 'no'} onChange={() => onChange(field.key, 'no')} required={required} /> No</label>
        </div>
      ) : (
        <input
          type={field.type === 'email' || field.type === 'email_confirm' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          required={required}
          placeholder={field.placeholder || ''}
          style={inputStyle}
        />
      )}
    </div>
  )
}

// Session list, matching the rebuilt confirmation email (bbd7adc) minus the
// Join column — Zoom belongs in the confirmation email and reminders, not on a
// public pre-registration page.
//
// Two layouts rather than one responsive table: a real 3-column table on wider
// screens, and stacked label/value cards below 560px. A 3-column table with
// "10:00 AM to 2:30 PM ET" in it cannot wrap cleanly at 360px, and many
// educators will register from a phone.
function EventsTable({ events, programType }) {
  const narrow = useMaxWidth(559)
  const heading = eventsHeading(programType)
  const headingStyle = {
    color: NAVY, fontSize: '1rem', fontWeight: 700,
    margin: '1.5rem 0 0.5rem', lineHeight: 1.4,
  }

  if (narrow) {
    return (
      <>
        <h3 style={headingStyle}>{heading}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {events.map(e => (
            <div key={e.id} style={{
              border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.6rem 0.75rem',
              background: '#f9fafb',
            }}>
              <div style={{ fontWeight: 700, color: NAVY, fontSize: '0.9rem', lineHeight: 1.35 }}>{e.title}</div>
              <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: '0.2rem', lineHeight: 1.45 }}>
                {formatEventDate(e.event_date)}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.45 }}>
                {formatTimeRange(e.start_time, e.end_time, e.timezone)}
              </div>
              {e.location && (
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.15rem', lineHeight: 1.4 }}>{e.location}</div>
              )}
            </div>
          ))}
        </div>
      </>
    )
  }

  const th = { textAlign: 'left', padding: '0.5rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.04em', background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }
  const td = { padding: '0.55rem 0.6rem', fontSize: '0.85rem', color: '#1f2937', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top', lineHeight: 1.45 }

  return (
    <>
      <h3 style={headingStyle}>{heading}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th scope="col" style={{ ...th, width: '44%' }}>Session</th>
            <th scope="col" style={{ ...th, width: '25%' }}>Date</th>
            <th scope="col" style={{ ...th, width: '31%' }}>Time</th>
          </tr>
        </thead>
        <tbody>
          {events.map(e => (
            <tr key={e.id}>
              <td style={td}>
                <span style={{ fontWeight: 700, color: NAVY }}>{e.title}</span>
                {e.location && (
                  <span style={{ display: 'block', fontSize: '0.78rem', color: '#6b7280', marginTop: '0.1rem' }}>{e.location}</span>
                )}
              </td>
              <td style={td}>{formatEventDate(e.event_date)}</td>
              <td style={td}>{formatTimeRange(e.start_time, e.end_time, e.timezone)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// Every render state of this page goes through Shell — the form, the closed and
// pre-open banners, the error state, and the success/waitlist/duplicate screen —
// so putting the branding here means the last thing a registrant sees carries it
// too, without touching five call sites.
//
// Chose INLINE styles over importing TeamCodeEntry.css: this file is inline-only
// per project convention and imports no stylesheet, and pulling in a stylesheet
// scoped to a different page's class names would half-apply two systems. The
// dimensions below are copied deliberately from .logo-top / .logo-bottom
// (255px / 250px, 2px #e5e7eb divider, 200px under 640px) so the public pages
// stay visually identical.
function Shell({ children, wide = false }) {
  const small = useMaxWidth(640) // matches TeamCodeEntry.css's mobile breakpoint

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      // Same teal-to-navy gradient the assessment entry page already uses
      // (.team-code-container), so the two public entry points match.
      // backgroundAttachment: fixed stops the gradient re-tiling down a long
      // form — this page can be much taller than the viewport.
      background: `linear-gradient(135deg, ${TEAL} 0%, ${NAVY} 100%)`,
      backgroundAttachment: 'fixed',
      padding: small ? '1rem 0.75rem' : '2rem 1rem',
    }}>
      <div style={{
        background: 'white', borderRadius: '0.75rem',
        padding: small ? '1.5rem 1.25rem' : '2rem',
        // Deeper shadow than before to lift the card off the gradient.
        boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
        maxWidth: wide ? '640px' : '520px', width: '100%',
        marginTop: small ? '1rem' : '2rem', marginBottom: small ? '1rem' : '2rem',
      }}>
        <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'center' }}>
          <img src={ctacLogo} alt="Center on Trauma and Children"
            style={{ maxWidth: small ? '200px' : '255px', width: '100%', height: 'auto' }} />
        </div>

        {children}

        <div style={{
          marginTop: '2rem', paddingTop: '2rem', borderTop: '2px solid #e5e7eb',
          display: 'flex', justifyContent: 'center',
        }}>
          <img src={ukLogo} alt="University of Kentucky"
            style={{ maxWidth: small ? '200px' : '250px', width: '100%', height: 'auto' }} />
        </div>
      </div>
    </div>
  )
}

function Banner({ color, bg, children }) {
  return (
    <div style={{ background: bg, color, padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.9rem', marginTop: '1rem' }}>{children}</div>
  )
}
