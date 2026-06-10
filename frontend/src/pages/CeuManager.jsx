import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import JSZip from 'jszip'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'
import {
  buildApprovalsText, buildLcAttendance, buildAttendanceHtml,
  dateRange, eventHours, fetchCertificateTemplate, fmtHours, mergeCertificate,
} from '../utils/ceu'

// CEU certificate issuance for one learning collaborative.
// Three steps on one page: Configure (eligible sessions + approval bodies),
// Review (per-participant hours with manual overrides), Generate (merged
// .docx certificates — bulk ZIP download and/or per-participant email).
// Ported from the desktop tool; see utils/ceu.js for provenance.
export default function CeuManager() {
  const { collaborativeId } = useParams()
  const navigate = useNavigate()
  const { user, canAdminCollaborative } = useAuth()

  const [loading, setLoading] = useState(true)
  const [collaborative, setCollaborative] = useState(null)
  const [events, setEvents] = useState([])
  const [attendanceRows, setAttendanceRows] = useState([])
  const [config, setConfig] = useState({
    ceu_sw: false, ceu_psych: false, ceu_lpcc: false,
    ceu_aswb: false, aswb_period: '',
    ceu_eila: false, eila_number: '',
    ceu_frsky: false, frsky_number: '',
    location: '', trainer_name: '',
  })
  const [savingConfig, setSavingConfig] = useState(false)
  const [excluded, setExcluded] = useState(new Set())        // emails excluded from issuance
  const [overrides, setOverrides] = useState(new Set())      // `${email}|${eventId}` force-counted
  const [expandedEmail, setExpandedEmail] = useState(null)
  const [working, setWorking] = useState(null)               // progress message during generate/email
  const [issuedLog, setIssuedLog] = useState([])

  const load = async () => {
    setLoading(true)
    const { data: collab } = await supabase
      .from('collaboratives').select('id, name').eq('id', collaborativeId).maybeSingle()
    setCollaborative(collab || null)

    const { data: evts } = await supabase
      .from('bsc_events')
      .select('id, title, event_date, start_time, end_time, event_type, ceu_eligible')
      .eq('collaborative_id', collaborativeId)
      .order('event_date', { ascending: true })
    setEvents(evts || [])

    const eligibleIds = (evts || []).filter(e => e.ceu_eligible).map(e => e.id)
    if (eligibleIds.length > 0) {
      const { data: att } = await supabase
        .from('session_attendance')
        .select('bsc_event_id, attendee_name, attendee_email, signed_in_at, evaluation_completed_at, sign_out_method')
        .in('bsc_event_id', eligibleIds)
      setAttendanceRows(att || [])
    } else {
      setAttendanceRows([])
    }

    const { data: cfg } = await supabase
      .from('collaborative_ceu_config').select('*').eq('collaborative_id', collaborativeId).maybeSingle()
    if (cfg) setConfig(cfg)

    const { data: issued } = await supabase
      .from('ceu_certificates')
      .select('attendee_email, attendee_name, hours_awarded, issued_at, emailed_at')
      .eq('collaborative_id', collaborativeId)
      .order('issued_at', { ascending: false })
    setIssuedLog(issued || [])

    setLoading(false)
  }

  useEffect(() => { load() }, [collaborativeId])

  const eligibleEvents = useMemo(
    () => events.filter(e => e.ceu_eligible && e.start_time && e.end_time),
    [events]
  )

  // Base computation + manual overrides applied on top.
  const participants = useMemo(() => {
    const base = buildLcAttendance(eligibleEvents, attendanceRows)
    return base.map(p => {
      let hoursAwarded = 0
      const sessionData = p.sessionData.map(s => {
        const forced = overrides.has(`${p.email}|${s.eventId}`)
        const effective = s.counted || forced
        if (effective) hoursAwarded += s.hours
        return { ...s, forced, effective }
      })
      return { ...p, sessionData, hoursAwarded }
    })
  }, [eligibleEvents, attendanceRows, overrides])

  const included = participants.filter(p => !excluded.has(p.email) && p.hoursAwarded > 0)
  const hoursTotal = eligibleEvents.reduce((sum, e) => sum + eventHours(e), 0)

  const toggleEligible = async (evt) => {
    const next = !evt.ceu_eligible
    if (next && (!evt.start_time || !evt.end_time)) {
      alert('CEU-eligible sessions need both a start and end time (hours are computed from the schedule). Set times on the collaborative page first.')
      return
    }
    const { error } = await supabase.from('bsc_events').update({ ceu_eligible: next }).eq('id', evt.id)
    if (error) { alert('Could not update: ' + error.message); return }
    await load()
  }

  const saveConfig = async () => {
    setSavingConfig(true)
    const { error } = await supabase.from('collaborative_ceu_config').upsert({
      collaborative_id: collaborativeId,
      ceu_sw: config.ceu_sw, ceu_psych: config.ceu_psych, ceu_lpcc: config.ceu_lpcc,
      ceu_aswb: config.ceu_aswb, aswb_period: config.aswb_period || null,
      ceu_eila: config.ceu_eila, eila_number: config.eila_number || null,
      ceu_frsky: config.ceu_frsky, frsky_number: config.frsky_number || null,
      location: config.location || null, trainer_name: config.trainer_name || null,
      updated_at: new Date().toISOString(),
    })
    setSavingConfig(false)
    if (error) alert('Could not save config: ' + error.message)
  }

  const certMapping = (p) => ({
    '<<NAME>>': p.name,
    '<<TRAINING>>': collaborative?.name || '',
    '<<HOURS>>': fmtHours(p.hoursAwarded),
    '<<TOTALHOURS>>': fmtHours(hoursTotal),
    '<<TRAINER>>': config.trainer_name || '',
    '<<DATE>>': dateRange(eligibleEvents),
    '<<LOCATION>>': config.location || '',
    '<<CEU_APPROVALS>>': buildApprovalsText(config, hoursTotal),
  })

  const recordIssued = async (p) => {
    const { data } = await supabase.from('ceu_certificates').insert({
      collaborative_id: collaborativeId,
      attendee_email: p.email,
      attendee_name: p.name,
      hours_awarded: p.hoursAwarded,
      hours_total: hoursTotal,
      issued_by: user?.id || null,
    }).select('id').single()
    return data?.id || null
  }

  const generateZip = async () => {
    if (included.length === 0) { alert('No participants with awarded hours to issue.'); return }
    setWorking('Loading template…')
    try {
      const template = await fetchCertificateTemplate()
      const outZip = new JSZip()
      for (let i = 0; i < included.length; i++) {
        const p = included[i]
        setWorking(`Generating ${i + 1} of ${included.length}: ${p.name}`)
        const blob = await mergeCertificate(template, certMapping(p))
        const safe = p.name.replace(/[^A-Za-z0-9._ -]/g, '')
        outZip.file(`${safe} - ${(collaborative?.name || 'Certificate').replace(/[^A-Za-z0-9._ -]/g, '')}.docx`, blob)
        await recordIssued(p)
      }
      setWorking('Packaging ZIP…')
      const zipBlob = await outZip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CEU_Certificates_${(collaborative?.name || '').replace(/[^A-Za-z0-9._ -]/g, '_')}.zip`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      await load()
    } catch (err) {
      alert('Generation failed: ' + (err.message || String(err)))
    } finally {
      setWorking(null)
    }
  }

  const emailCertificates = async () => {
    if (included.length === 0) { alert('No participants with awarded hours to email.'); return }
    if (!window.confirm(`Email certificates to ${included.length} participant${included.length === 1 ? '' : 's'}? Each gets their merged certificate attached plus their attendance summary.`)) return
    setWorking('Loading template…')
    try {
      const template = await fetchCertificateTemplate()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      let sent = 0, failed = 0
      for (let i = 0; i < included.length; i++) {
        const p = included[i]
        setWorking(`Emailing ${i + 1} of ${included.length}: ${p.name}`)
        const blob = await mergeCertificate(template, certMapping(p))
        const base64 = await blobToBase64(blob)
        const certId = await recordIssued(p)
        const firstName = p.name.split(/\s+/)[0] || p.name
        const approvals = buildApprovalsText(config, hoursTotal)
        const html = `<div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 640px;">
          <p>Hello ${esc(firstName)}! Thank you for participating in "${esc(collaborative?.name || '')}"!</p>
          <p>Your certificate is attached. You attended <strong>${fmtHours(p.hoursAwarded)}</strong> of <strong>${fmtHours(hoursTotal)}</strong> possible hours:</p>
          ${buildAttendanceHtml(p)}
          ${approvals ? `<p style="font-size: 13px; color: #374151; white-space: pre-wrap;">${esc(approvals)}</p>` : ''}
          <p style="font-size: 12px; color: #6b7280;">Sent by the CTAC BSC Manager.</p>
        </div>`
        const safe = p.name.replace(/[^A-Za-z0-9._ -]/g, '')
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-ceu-certificate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: p.email,
            subject: `Your CEU certificate — ${collaborative?.name || ''}`,
            html,
            attachment_base64: base64,
            attachment_filename: `${safe} - Certificate.docx`,
            certificate_id: certId,
          }),
        })
        if (resp.ok) sent += 1; else failed += 1
      }
      alert(`Done. ${sent} sent${failed > 0 ? `, ${failed} failed` : ''}.`)
      await load()
    } catch (err) {
      alert('Email run failed: ' + (err.message || String(err)))
    } finally {
      setWorking(null)
    }
  }

  if (!canAdminCollaborative(collaborativeId)) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Only admins of this collaborative can issue CEU certificates.
      </div>
    )
  }
  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <div style={{ background: COLORS.navy, color: 'white', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => navigate(`/admin/collaboratives/${collaborativeId}`)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>← Back</button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem' }}>🎓 CEU Certificates</h1>
            <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>{collaborative?.name}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        {working && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2rem', fontSize: '1rem', color: '#0E1F56', fontWeight: 600 }}>{working}</div>
          </div>
        )}

        {/* Step 1 — Configure */}
        <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <div style={cardHeaderStyle}>1 · Configure</div>

          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0.75rem 0 0.4rem' }}>CEU-eligible sessions</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Hours auto-compute from each session's scheduled start/end time. Sessions without both times can't be eligible.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {events.map(evt => {
              const hrs = eventHours(evt)
              const hasTimes = evt.start_time && evt.end_time
              return (
                <label key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.35rem 0.5rem', borderRadius: '4px', background: evt.ceu_eligible ? '#ecfdf5' : 'transparent', cursor: hasTimes ? 'pointer' : 'not-allowed', opacity: hasTimes ? 1 : 0.55 }}>
                  <input type="checkbox" checked={evt.ceu_eligible} disabled={!hasTimes && !evt.ceu_eligible} onChange={() => toggleEligible(evt)} />
                  <span style={{ flex: 1 }}>
                    <strong>{evt.title}</strong> · {evt.event_date}
                    {hasTimes ? ` · ${fmtHours(hrs)} hr${hrs === 1 ? '' : 's'}` : ' · (no start/end time)'}
                  </span>
                </label>
              )
            })}
          </div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
            Total possible hours: <strong>{fmtHours(hoursTotal)}</strong> across {eligibleEvents.length} session{eligibleEvents.length === 1 ? '' : 's'}
          </div>

          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '1.25rem 0 0.4rem' }}>Approval bodies</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1.5rem', fontSize: '0.85rem' }}>
            <label><input type="checkbox" checked={config.ceu_sw} onChange={e => setConfig({ ...config, ceu_sw: e.target.checked })} /> KY Board of Social Work</label>
            <label><input type="checkbox" checked={config.ceu_psych} onChange={e => setConfig({ ...config, ceu_psych: e.target.checked })} /> KY Board of Psychology</label>
            <label><input type="checkbox" checked={config.ceu_lpcc} onChange={e => setConfig({ ...config, ceu_lpcc: e.target.checked })} /> LPCC</label>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <label style={{ whiteSpace: 'nowrap' }}><input type="checkbox" checked={config.ceu_aswb} onChange={e => setConfig({ ...config, ceu_aswb: e.target.checked })} /> ASWB</label>
              {config.ceu_aswb && <input type="text" value={config.aswb_period || ''} onChange={e => setConfig({ ...config, aswb_period: e.target.value })} placeholder="approval period" style={miniInput} />}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <label style={{ whiteSpace: 'nowrap' }}><input type="checkbox" checked={config.ceu_eila} onChange={e => setConfig({ ...config, ceu_eila: e.target.checked })} /> EILA</label>
              {config.ceu_eila && <input type="text" value={config.eila_number || ''} onChange={e => setConfig({ ...config, eila_number: e.target.value })} placeholder="EILA #" style={miniInput} />}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <label style={{ whiteSpace: 'nowrap' }}><input type="checkbox" checked={config.ceu_frsky} onChange={e => setConfig({ ...config, ceu_frsky: e.target.checked })} /> FRSKY</label>
              {config.ceu_frsky && <input type="text" value={config.frsky_number || ''} onChange={e => setConfig({ ...config, frsky_number: e.target.value })} placeholder="FRSKY #" style={miniInput} />}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Location (for the certificate)</label>
              <input type="text" value={config.location || ''} onChange={e => setConfig({ ...config, location: e.target.value })} placeholder="e.g., Virtual / Lexington, KY" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Trainer name (for the certificate)</label>
              <input type="text" value={config.trainer_name || ''} onChange={e => setConfig({ ...config, trainer_name: e.target.value })} placeholder="e.g., Dr. Ginny Sprang" style={inputStyle} />
            </div>
          </div>

          <button onClick={saveConfig} disabled={savingConfig} style={{ marginTop: '1rem', background: COLORS.teal, color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 600, cursor: savingConfig ? 'wait' : 'pointer' }}>
            {savingConfig ? 'Saving…' : 'Save configuration'}
          </button>
        </section>

        {/* Step 2 — Review */}
        <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <div style={cardHeaderStyle}>
            2 · Review participants
            <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              credit per session = sign-in + completed evaluation + explicit sign-out
            </span>
          </div>
          {participants.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No attendance on CEU-eligible sessions yet. Mark sessions eligible in step 1.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' }}>
              {participants.map(p => {
                const isExcluded = excluded.has(p.email)
                const isOpen = expandedEmail === p.email
                const zero = p.hoursAwarded === 0
                return (
                  <div key={p.email} style={{ border: '1px solid var(--border-light)', borderLeft: `4px solid ${isExcluded ? '#9ca3af' : zero ? '#ef4444' : p.hoursAwarded < hoursTotal ? '#f59e0b' : '#16a34a'}`, borderRadius: '6px', background: 'var(--bg-card)', opacity: isExcluded ? 0.55 : 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0.75rem' }}>
                      <button onClick={() => setExpandedEmail(isOpen ? null : p.email)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-body)' }}>{p.name} <span style={{ color: COLORS.teal }}>{isOpen ? '▾' : '▸'}</span></div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.email}</div>
                      </button>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: zero ? '#ef4444' : 'var(--text-body)' }}>
                        {fmtHours(p.hoursAwarded)} / {fmtHours(hoursTotal)} hrs
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {p.sessionData.filter(s => s.effective).length}/{p.sessionData.length} sessions
                      </span>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={() => setExcluded(prev => {
                            const next = new Set(prev)
                            if (next.has(p.email)) next.delete(p.email); else next.add(p.email)
                            return next
                          })}
                        /> include
                      </label>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '0 0.75rem 0.75rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-card-alt)', borderBottom: '1px solid var(--border)' }}>
                              <th style={thMini}>Session</th>
                              <th style={thMini}>Hours</th>
                              <th style={thMini}>Signed in</th>
                              <th style={thMini}>Eval</th>
                              <th style={thMini}>Signed out</th>
                              <th style={thMini}>Credited</th>
                              <th style={thMini}>Manual override</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.sessionData.map(s => (
                              <tr key={s.eventId} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={tdMini}>{s.title} · {s.date}</td>
                                <td style={tdMini}>{fmtHours(s.hours)}</td>
                                <td style={{ ...tdMini, textAlign: 'center' }}>{s.signedIn ? '✓' : '—'}</td>
                                <td style={{ ...tdMini, textAlign: 'center' }}>{s.evalCompleted ? '✓' : '—'}</td>
                                <td style={{ ...tdMini, textAlign: 'center' }}>{s.signedOut ? '✓' : '—'}</td>
                                <td style={{ ...tdMini, textAlign: 'center', fontWeight: 700, color: s.effective ? '#16a34a' : '#ef4444' }}>{s.effective ? 'yes' : 'no'}</td>
                                <td style={{ ...tdMini, textAlign: 'center' }}>
                                  {!s.counted && (
                                    <label style={{ fontSize: '0.72rem', cursor: 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={s.forced}
                                        onChange={() => setOverrides(prev => {
                                          const key = `${p.email}|${s.eventId}`
                                          const next = new Set(prev)
                                          if (next.has(key)) next.delete(key); else next.add(key)
                                          return next
                                        })}
                                      /> count it
                                    </label>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Step 3 — Generate */}
        <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <div style={cardHeaderStyle}>3 · Generate</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <strong>{included.length}</strong> participant{included.length === 1 ? '' : 's'} will receive certificates
            (included + at least one credited session). Certificates are merged .docx files from the branded LC template.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={generateZip} disabled={!!working || included.length === 0} style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.55rem 1.25rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', opacity: included.length === 0 ? 0.5 : 1 }}>
              ⬇ Download all as ZIP
            </button>
            <button onClick={emailCertificates} disabled={!!working || included.length === 0} style={{ background: COLORS.teal, color: 'white', border: 'none', padding: '0.55rem 1.25rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', opacity: included.length === 0 ? 0.5 : 1 }}>
              ✉ Email to participants
            </button>
          </div>

          {issuedLog.length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>Issued log</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {issuedLog.slice(0, 15).map((c, i) => (
                  <li key={i} style={{ padding: '0.25rem 0', borderBottom: '1px solid var(--border)' }}>
                    {c.attendee_name} · {fmtHours(c.hours_awarded)} hrs · {new Date(c.issued_at).toLocaleString()}
                    {c.emailed_at && ' · ✉ emailed'}
                  </li>
                ))}
                {issuedLog.length > 15 && <li style={{ padding: '0.25rem 0', fontStyle: 'italic' }}>…and {issuedLog.length - 15} more</li>}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const inputStyle = {
  width: '100%', padding: '0.5rem 0.75rem',
  border: '1px solid var(--border-light)', borderRadius: '6px',
  fontSize: '0.9rem', boxSizing: 'border-box', background: 'var(--bg-card)',
}
const miniInput = { ...inputStyle, width: '11rem', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }
const thMini = { textAlign: 'left', padding: '0.3rem 0.4rem', fontWeight: 700 }
const tdMini = { padding: '0.3rem 0.4rem' }
