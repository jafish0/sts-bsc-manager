import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'

const STATUS_META = {
  new:          { label: 'New',          color: '#1e40af', bg: '#dbeafe' },
  triaged:      { label: 'Triaged',      color: '#92400e', bg: '#fef3c7' },
  incorporated: { label: 'Incorporated', color: '#166534', bg: '#dcfce7' },
  declined:     { label: 'Declined',     color: '#6b7280', bg: '#f3f4f6' },
}
const CATEGORY_META = {
  bug: '🐞 Bug', confusing: '😕 Confusing', idea: '💡 Idea', question: '❓ Question',
}
const SEVERITY_META = {
  high:   { label: 'High',   color: '#991b1b' },
  medium: { label: 'Medium', color: '#92400e' },
  low:    { label: 'Low',    color: '#6b7280' },
}

// Feedback triage board for the Anchor Lab demo phase — super_admin only
// (trainer_admins submit feedback but must not see everyone else's).
// Reviews rows from app_feedback (widget shipped in a52463d).
export default function FeedbackAdmin() {
  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()

  const [rows, setRows] = useState([])
  const [collabNames, setCollabNames] = useState({})
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [submitterFilter, setSubmitterFilter] = useState('all')
  const [collabFilter, setCollabFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Detail panel
  const [selected, setSelected] = useState(null)        // the open row
  const [screenshotUrl, setScreenshotUrl] = useState(null)
  const [draftStatus, setDraftStatus] = useState('new')
  const [draftNotes, setDraftNotes] = useState('')
  const [savingDetail, setSavingDetail] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('app_feedback')
      .select('*')
      .order('created_at', { ascending: false })
    setRows(data || [])

    // Resolve collaborative names for display
    const collabIds = [...new Set((data || []).map(r => r.collaborative_id).filter(Boolean))]
    if (collabIds.length > 0) {
      const { data: collabs } = await supabase
        .from('collaboratives').select('id, name').in('id', collabIds)
      setCollabNames(Object.fromEntries((collabs || []).map(c => [c.id, c.name])))
    }
    setLoading(false)
  }

  useEffect(() => { if (isSuperAdmin) load() }, [isSuperAdmin])

  const openDetail = async (row) => {
    setSelected(row)
    setDraftStatus(row.status)
    setDraftNotes(row.admin_notes || '')
    setScreenshotUrl(null)
    if (row.screenshot_path) {
      const { data, error } = await supabase.storage
        .from('feedback-screenshots')
        .createSignedUrl(row.screenshot_path, 3600)
      if (!error) setScreenshotUrl(data.signedUrl)
    }
  }

  const saveDetail = async () => {
    if (!selected) return
    setSavingDetail(true)
    const isResolved = draftStatus === 'incorporated' || draftStatus === 'declined'
    const patch = {
      status: draftStatus,
      admin_notes: draftNotes.trim() || null,
      resolved_at: isResolved
        ? (selected.resolved_at || new Date().toISOString())
        : null,
    }
    const { error } = await supabase.from('app_feedback').update(patch).eq('id', selected.id)
    setSavingDetail(false)
    if (error) { alert('Could not save: ' + error.message); return }
    setSelected(null)
    await load()
  }

  const submitters = useMemo(
    () => [...new Set(rows.map(r => r.user_email).filter(Boolean))].sort(),
    [rows]
  )
  const collabOptions = useMemo(
    () => [...new Set(rows.map(r => r.collaborative_id).filter(Boolean))],
    [rows]
  )

  const filtered = rows
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => categoryFilter === 'all' || r.category === categoryFilter)
    .filter(r => severityFilter === 'all' || r.severity === severityFilter)
    .filter(r => submitterFilter === 'all' || r.user_email === submitterFilter)
    .filter(r => collabFilter === 'all' || r.collaborative_id === collabFilter)
    .filter(r => {
      const t = search.trim().toLowerCase()
      if (!t) return true
      return (r.message || '').toLowerCase().includes(t)
        || (r.page_label || '').toLowerCase().includes(t)
        || (r.route || '').toLowerCase().includes(t)
    })

  const countsByStatus = useMemo(() => {
    const counts = {}
    rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })
    return counts
  }, [rows])

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Only super admins can review feedback.
        <div style={{ marginTop: '1rem' }}>
          <button onClick={() => navigate('/admin')} style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Back to Dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <div style={{ background: COLORS.navy, color: 'white', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => navigate('/admin')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>← Back</button>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>🐞 Feedback Triage</h1>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        {/* Status summary */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              style={{
                background: statusFilter === key ? meta.color : meta.bg,
                color: statusFilter === key ? 'white' : meta.color,
                border: 'none', padding: '0.45rem 0.9rem', borderRadius: '999px',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
              }}
            >{countsByStatus[key] || 0} {meta.label.toLowerCase()}</button>
          ))}
        </div>

        {/* Filters */}
        <section style={{ ...cardStyle, marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search message / page / route…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '14rem', padding: '0.45rem 0.75rem', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.85rem', background: 'var(--bg-card)' }}
          />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={selStyle}>
            <option value="all">All types</option>
            {Object.entries(CATEGORY_META).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={selStyle}>
            <option value="all">All severities</option>
            {Object.entries(SEVERITY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <select value={submitterFilter} onChange={e => setSubmitterFilter(e.target.value)} style={selStyle}>
            <option value="all">All submitters</option>
            {submitters.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {collabOptions.length > 0 && (
            <select value={collabFilter} onChange={e => setCollabFilter(e.target.value)} style={selStyle}>
              <option value="all">All collaboratives</option>
              {collabOptions.map(id => <option key={id} value={id}>{collabNames[id] || id.slice(0, 8)}</option>)}
            </select>
          )}
        </section>

        {/* List */}
        <section style={{ ...cardStyle }}>
          <div style={cardHeaderStyle}>
            Feedback
            <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              {filtered.length} of {rows.length}
            </span>
          </div>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No feedback matches the current filters.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
              {filtered.map(r => {
                const st = STATUS_META[r.status] || STATUS_META.new
                const sev = SEVERITY_META[r.severity] || SEVERITY_META.low
                return (
                  <button
                    key={r.id}
                    onClick={() => openDetail(r)}
                    style={{
                      textAlign: 'left', background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      borderLeft: `4px solid ${sev.color}`,
                      borderRadius: '6px', padding: '0.6rem 0.85rem', cursor: 'pointer',
                      display: 'grid', gridTemplateColumns: '7.5rem 1fr auto', gap: '0.75rem', alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{new Date(r.created_at).toLocaleDateString()}</div>
                      <div>{new Date(r.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {CATEGORY_META[r.category] || r.category} · <strong>{r.page_label || r.route}</strong>
                        {r.collaborative_id && collabNames[r.collaborative_id] && (
                          <span style={{ color: 'var(--text-muted)' }}> · {collabNames[r.collaborative_id]}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.user_email} — {r.message}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: sev.color }}>{sev.label}</span>
                      <span style={{ background: st.bg, color: st.color, padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{st.label}</span>
                      {r.screenshot_path && <span title="Has screenshot">📸</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setSelected(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card, white)', borderRadius: '0.75rem', maxWidth: '860px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-heading)' }}>
                {CATEGORY_META[selected.category] || selected.category} — {selected.page_label || selected.route}
              </h3>
              <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <span><strong>{selected.user_email}</strong> ({selected.user_role})</span>
              <span>{new Date(selected.created_at).toLocaleString()}</span>
              <span>severity: <strong style={{ color: SEVERITY_META[selected.severity]?.color }}>{selected.severity}</strong></span>
              <span>route: <code>{selected.route}</code></span>
              {selected.viewport && <span>viewport: {selected.viewport}</span>}
            </div>

            <div style={{ background: 'var(--bg-card-alt, #f9fafb)', borderRadius: '6px', padding: '0.75rem 1rem', fontSize: '0.95rem', color: 'var(--text-body)', whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>
              {selected.message}
            </div>

            {selected.screenshot_path && (
              <div style={{ marginBottom: '1rem' }}>
                {screenshotUrl ? (
                  <a href={screenshotUrl} target="_blank" rel="noopener noreferrer" title="Open full size">
                    <img src={screenshotUrl} alt="Feedback screenshot" style={{ maxWidth: '100%', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  </a>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading screenshot…</div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '12rem 1fr', gap: '0.75rem', alignItems: 'start' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Status</label>
                <select value={draftStatus} onChange={e => setDraftStatus(e.target.value)} style={{ ...selStyle, width: '100%' }}>
                  {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Admin notes</label>
                <textarea
                  value={draftNotes}
                  onChange={e => setDraftNotes(e.target.value)}
                  rows={3}
                  placeholder="Triage notes, links to commits, decisions…"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', background: 'var(--bg-card)' }}
                />
              </div>
            </div>

            {(draftStatus === 'incorporated' || draftStatus === 'declined') && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Saving will stamp resolved_at{selected.resolved_at ? ` (already set ${new Date(selected.resolved_at).toLocaleDateString()})` : ''}.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => setSelected(null)} disabled={savingDetail} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveDetail} disabled={savingDetail} style={{ background: COLORS.teal, color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 600, cursor: savingDetail ? 'wait' : 'pointer' }}>
                {savingDetail ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const selStyle = {
  padding: '0.45rem 0.6rem', border: '1px solid var(--border-light)',
  borderRadius: '6px', fontSize: '0.82rem', background: 'var(--bg-card)',
}
