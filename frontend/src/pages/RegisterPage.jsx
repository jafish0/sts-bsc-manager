import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// Public registration form. URL: /register/:token
// Renders dynamically from event_registration_links.form_schema, validates,
// and submits via the mint-registration edge function (which handles
// capacity + waitlist server-side).
export default function RegisterPage() {
  const { token } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [link, setLink] = useState(null)
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
          .select('*, collaboratives(name)')
          .eq('token', token)
          .maybeSingle()
        if (cancelled) return
        if (lErr || !l) { setError('Invalid registration link.'); setLoading(false); return }
        setLink(l)

        // Window status
        const now = new Date()
        if (!l.is_active || (l.registration_closes_at && new Date(l.registration_closes_at) < now)) {
          setWindowStatus('closed')
        } else if (l.registration_opens_at && new Date(l.registration_opens_at) > now) {
          setWindowStatus('pre_open')
        }

        // Pull events covered
        const { data: linkEvents } = await supabase
          .from('event_registration_link_events')
          .select('event_id, bsc_events(id, title, event_date, start_time, end_time, location, zoom_link)')
          .eq('registration_link_id', l.id)
        if (!cancelled) {
          setEvents((linkEvents || []).map(le => le.bsc_events).filter(Boolean).sort((a, b) => (a.event_date || '').localeCompare(b.event_date || '')))
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
  const collabName = link.collaboratives?.name

  return (
    <Shell wide>
      <h2 style={{ color: NAVY, marginTop: 0, marginBottom: '0.25rem' }}>{link.title}</h2>
      {collabName && <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>{collabName}</div>}
      {link.description && <p style={{ color: '#374151' }}>{link.description}</p>}

      {events.length > 0 && (
        <>
          <h3 style={{ color: NAVY, fontSize: '1rem', marginTop: '1.25rem', marginBottom: '0.4rem' }}>Events covered</h3>
          <ul style={{ paddingLeft: '1.2rem', marginTop: 0, fontSize: '0.9rem' }}>
            {events.map(e => (
              <li key={e.id} style={{ marginBottom: '0.4rem' }}>
                <strong>{e.title}</strong> — {new Date(e.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {e.start_time && ` at ${e.start_time.slice(0,5)}`}
                {e.location && ` · ${e.location}`}
              </li>
            ))}
          </ul>
        </>
      )}

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

function Shell({ children, wide = false }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: '#f9fafb', padding: '1rem',
    }}>
      <div style={{
        background: 'white', borderRadius: '0.75rem', padding: '2rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        maxWidth: wide ? '640px' : '520px', width: '100%',
        marginTop: '2rem',
      }}>
        {children}
      </div>
    </div>
  )
}

function Banner({ color, bg, children }) {
  return (
    <div style={{ background: bg, color, padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.9rem', marginTop: '1rem' }}>{children}</div>
  )
}
