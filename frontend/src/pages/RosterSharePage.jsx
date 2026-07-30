import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { formatEventDate, formatTimeRange } from '../config/programConfig'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'
import ukLogo from '../assets/UK_Lockup-286.png'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// Public read-only roster page. URL: /roster/:token
//
// Reads exclusively through the `lookup-roster` edge function, which requires
// the access code and returns an allowlisted payload. The browser never touches
// event_registrations — anon SELECT on that table stays revoked (verified).
//
// Read-only by construction: there is no cancel, promote, edit or admin call
// anywhere on this page. The CSV button below is built from the already-fetched
// payload, so it cannot expose anything the page isn't already showing.

const STATUS_STYLE = {
  registered: { bg: '#dcfce7', color: '#166534', label: 'Registered' },
  waitlisted: { bg: '#fef3c7', color: '#92400e', label: 'Waitlisted' },
  cancelled: { bg: '#fee2e2', color: '#991b1b', label: 'Cancelled' },
  checked_in: { bg: '#dbeafe', color: '#1e40af', label: 'Checked in' },
}

function useMaxWidth(px) {
  const query = `(max-width: ${px}px)`
  const read = () =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false
  const [matches, setMatches] = useState(read)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const sync = () => setMatches(mql.matches)
    sync()
    mql.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    return () => { mql.removeEventListener('change', sync); window.removeEventListener('resize', sync) }
  }, [query])
  return matches
}

export default function RosterSharePage() {
  const { token } = useParams()
  const sessionKey = `roster_code_${token}`

  const [code, setCode] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false) // finished any auto-attempt
  const narrow = useMaxWidth(720)

  // Keep this URL out of search indexes. It carries participant PII behind a
  // short code, so it must never be crawlable. Injected per-route and removed
  // on unmount so it doesn't leak onto other pages of the SPA.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => { document.head.removeChild(meta) }
  }, [])

  const load = async (accessCode) => {
    setLoading(true)
    setError(null)
    const { data: payload, error: fnErr } = await supabase.functions.invoke('lookup-roster', {
      body: { token, access_code: accessCode },
    })
    setLoading(false)
    // functions.invoke surfaces a non-2xx as an error; the body carries our message.
    if (fnErr) {
      let msg = 'That roster link or access code is not valid.'
      try {
        const body = await fnErr.context?.json?.()
        if (body?.error) msg = body.error
      } catch { /* keep the default */ }
      setError(msg)
      sessionStorage.removeItem(sessionKey)
      return false
    }
    if (payload?.error) { setError(payload.error); return false }
    setData(payload)
    // sessionStorage only — deliberately not localStorage, so the code does not
    // persist beyond the browser session.
    sessionStorage.setItem(sessionKey, accessCode)
    return true
  }

  // Re-use an accepted code within the session so a refresh doesn't re-prompt.
  useEffect(() => {
    const saved = sessionStorage.getItem(sessionKey)
    if (!saved) { setChecked(true); return }
    load(saved).finally(() => setChecked(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const downloadCsv = () => {
    if (!data) return
    const cols = ['Name', ...(data.link.include_emails ? ['Email'] : []),
      ...data.form_fields.map(f => f.label), 'Status', 'Registered']
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = data.registrants.map(r => [
      r.full_name,
      ...(data.link.include_emails ? [r.email || ''] : []),
      ...data.form_fields.map(f => r.fields?.[f.key] || ''),
      STATUS_STYLE[r.status]?.label || r.status,
      r.registered_at ? new Date(r.registered_at).toLocaleDateString('en-US') : '',
    ].map(esc).join(','))
    const blob = new Blob([[cols.map(esc).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `roster-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ---------- access-code gate ----------
  if (!data) {
    return (
      <Shell narrow={narrow}>
        <h2 style={{ color: NAVY, margin: '0 0 0.5rem', fontSize: '1.35rem' }}>Registration roster</h2>
        <p style={{ color: '#4b5563', fontSize: '0.9rem', marginTop: 0 }}>
          Enter the access code you were given to view this roster.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); load(code.trim()) }}>
          <input
            type="text" inputMode="numeric" autoComplete="off" value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code" aria-label="Access code"
            style={{
              width: '100%', padding: '0.6rem 0.75rem', fontSize: '1rem',
              border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box',
            }}
          />
          {error && (
            <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: '6px', marginTop: '0.75rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
          <button
            type="submit" disabled={loading || !code.trim() || !checked}
            style={{
              marginTop: '1rem', width: '100%', background: NAVY, color: 'white',
              border: 'none', padding: '0.65rem 1rem', borderRadius: '6px',
              fontWeight: 600, fontSize: '0.95rem',
              cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !code.trim() ? 0.6 : 1,
            }}
          >{loading ? 'Checking…' : 'View roster'}</button>
        </form>
      </Shell>
    )
  }

  // ---------- roster ----------
  const { link, counts, form_fields: formFields, events, registrants } = data
  const seatsLeft = link.capacity != null ? link.capacity - (counts.registered || 0) : null

  return (
    <Shell narrow={narrow} wide>
      <h2 style={{ color: NAVY, margin: '0 0 0.25rem', fontSize: '1.35rem', lineHeight: 1.3 }}>{link.title}</h2>
      {link.collaborative_name && (
        <div style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>{link.collaborative_name}</div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <Stat label="Registered" value={counts.registered || 0} color="#166534" bg="#dcfce7" />
        {(counts.waitlisted || 0) > 0 && <Stat label="Waitlisted" value={counts.waitlisted} color="#92400e" bg="#fef3c7" />}
        {(counts.cancelled || 0) > 0 && <Stat label="Cancelled" value={counts.cancelled} color="#991b1b" bg="#fee2e2" />}
        {link.capacity != null && <Stat label="Capacity" value={link.capacity} color={NAVY} bg="#eef2ff" />}
        {seatsLeft != null && <Stat label="Seats left" value={Math.max(0, seatsLeft)} color={TEAL} bg="#ecfeff" />}
      </div>

      {events.length > 0 && (
        <>
          <h3 style={{ color: NAVY, fontSize: '0.95rem', margin: '0 0 0.5rem' }}>Sessions</h3>
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {events.map((e, i) => (
              <div key={i} style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, color: NAVY }}>{e.title}</span>
                {' — '}{formatEventDate(e.event_date)}, {formatTimeRange(e.start_time, e.end_time, e.timezone)}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h3 style={{ color: NAVY, fontSize: '0.95rem', margin: 0 }}>
          Roster ({registrants.length})
          {!link.include_emails && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', background: '#f3f4f6', padding: '0.15rem 0.45rem', borderRadius: '999px' }}>
              emails hidden
            </span>
          )}
        </h3>
        {registrants.length > 0 && (
          <button onClick={downloadCsv} style={{ background: 'transparent', color: NAVY, border: `1px solid ${NAVY}`, padding: '0.35rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
            Download CSV
          </button>
        )}
      </div>

      {registrants.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '0.9rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem', margin: 0 }}>
          Nobody has registered yet. This page updates as registrations come in — reload to see the latest.
        </p>
      ) : narrow ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {registrants.map((r, i) => {
            const s = STATUS_STYLE[r.status] || { bg: '#f3f4f6', color: '#374151', label: r.status }
            return (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.6rem 0.75rem', background: '#f9fafb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: NAVY, fontSize: '0.9rem' }}>{r.full_name}</span>
                  <Pill s={s} />
                </div>
                {link.include_emails && r.email && <div style={{ fontSize: '0.78rem', color: '#4b5563' }}>{r.email}</div>}
                {formFields.map(f => r.fields?.[f.key] && (
                  <div key={f.key} style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                    <span style={{ color: '#9ca3af' }}>{f.label}: </span>{r.fields[f.key]}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr>
                <Th>Name</Th>
                {link.include_emails && <Th>Email</Th>}
                {formFields.map(f => <Th key={f.key}>{f.label}</Th>)}
                <Th>Status</Th>
                <Th>Registered</Th>
              </tr>
            </thead>
            <tbody>
              {registrants.map((r, i) => {
                const s = STATUS_STYLE[r.status] || { bg: '#f3f4f6', color: '#374151', label: r.status }
                return (
                  <tr key={i}>
                    <Td><span style={{ fontWeight: 600, color: NAVY }}>{r.full_name}</span></Td>
                    {link.include_emails && <Td>{r.email || ''}</Td>}
                    {formFields.map(f => <Td key={f.key}>{r.fields?.[f.key] || ''}</Td>)}
                    <Td><Pill s={s} /></Td>
                    <Td>{r.registered_at ? new Date(r.registered_at).toLocaleDateString('en-US') : ''}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '1.5rem', lineHeight: 1.5 }}>
        Read-only view shared by the Center on Trauma and Children. Please treat the
        names and contact details on this page as confidential.
        {/* Convert to Eastern before taking the date part. Slicing the UTC
            string would name the following day for an 11:59 PM ET expiry — the
            same bug the admin modal had. */}
        {link.expires_at && <> This link stops working after {formatEventDate(
          new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
            .format(new Date(link.expires_at))
        )}.</>}
      </p>
    </Shell>
  )
}

function Pill({ s }) {
  return (
    <span style={{ background: s.bg, color: s.color, padding: '0.1rem 0.45rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>
  )
}

function Stat({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: '6px', padding: '0.4rem 0.7rem', minWidth: '4.5rem' }}>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
    </div>
  )
}

const Th = ({ children }) => (
  <th scope="col" style={{ textAlign: 'left', padding: '0.45rem 0.55rem', fontSize: '0.68rem', fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.04em', background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', whiteSpace: 'nowrap' }}>{children}</th>
)
const Td = ({ children }) => (
  <td style={{ padding: '0.45rem 0.55rem', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top', color: '#1f2937' }}>{children}</td>
)

// Same branding as RegisterPage so a partner sees one coherent system.
function Shell({ children, narrow, wide = false }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: `linear-gradient(135deg, ${TEAL} 0%, ${NAVY} 100%)`,
      backgroundAttachment: 'fixed',
      padding: narrow ? '1rem 0.75rem' : '2rem 1rem',
    }}>
      <div style={{
        background: 'white', borderRadius: '0.75rem',
        padding: narrow ? '1.5rem 1.25rem' : '2rem',
        boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
        maxWidth: wide ? '900px' : '460px', width: '100%',
        marginTop: narrow ? '1rem' : '2rem', marginBottom: narrow ? '1rem' : '2rem',
      }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <img src={ctacLogo} alt="Center on Trauma and Children"
            style={{ maxWidth: narrow ? '200px' : '255px', width: '100%', height: 'auto' }} />
        </div>
        {children}
        <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '2px solid #e5e7eb', display: 'flex', justifyContent: 'center' }}>
          <img src={ukLogo} alt="University of Kentucky"
            style={{ maxWidth: narrow ? '200px' : '250px', width: '100%', height: 'auto' }} />
        </div>
      </div>
    </div>
  )
}
