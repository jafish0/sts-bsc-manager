import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { logDownload } from '../utils/logDownload'
import { timeAgo } from '../utils/constants'
import { formatEventDate, formatTimeRange } from '../config/programConfig'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'
import ukLogo from '../assets/UK_Lockup-286.png'

const NAVY = '#0E1F56'
const TEAL = '#00A79D'

// Public collaborative hub. URL: /hub/:token (+ /forum, /forum/:threadId, /resources)
//
// One shared page per collaborative, live at a STATIC URL for the whole cycle —
// unlike the standalone training hub, there is no per-event time window and no
// sign-in gate. Reading requires nothing but the link; posting (forum, parking
// lot) requires identity-lite: a name/district/role captured at session sign-in
// (localStorage) or entered once in a small inline form.
//
// Security posture, recorded deliberately: the URL is effectively shareable and
// Josh + Ginny explicitly accepted that. noindex keeps it out of search
// indexes. Do NOT add an access code or "harden" this without asking.
//
// All data flows through token-scoped SECURITY DEFINER RPCs (hub_lookup,
// hub_resources, hub_forum_*, hub_post_*) — anon's table grants were not
// broadened. The future-materials gate (a session's materials are hidden until
// that session starts) is enforced in SQL: hub_lookup never returns a future
// session's documents or storage paths.

const IDENTITY_KEY = 'bsc_hub_identity'

function loadIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !String(parsed.name || '').trim()) return null
    return parsed
  } catch {
    return null // private browsing / blocked storage — the form will ask
  }
}

function saveIdentity(identity) {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity))
  } catch { /* private browsing — identity just won't persist */ }
}

// The confirmed "current session" rule: during an event's window that event is
// current; otherwise the next upcoming one becomes current the moment the
// previous one ends; after the final session, show the last session plus a
// "concluded" note. `started` / `ended` are computed in SQL against the event's
// own timezone, so no client-side timezone math can drift.
function pickCurrentSession(events) {
  if (!events || events.length === 0) return { current: null, concluded: false }
  const inWindow = events.find(e => e.started && !e.ended)
  if (inWindow) return { current: inWindow, concluded: false }
  const next = events.find(e => !e.started)
  if (next) return { current: next, concluded: false }
  return { current: events[events.length - 1], concluded: true }
}

const DOC_CATEGORY_LABELS = [
  { value: 'agenda', label: '📋 Agenda' },
  { value: 'slides', label: '📽 PowerPoint Slides' },
  { value: 'handout', label: '📄 Handouts' },
  { value: 'general', label: '📎 Other Materials' },
]

function groupDocs(docs) {
  const groups = []
  DOC_CATEGORY_LABELS.forEach(cat => {
    const inCat = docs.filter(d =>
      cat.value === 'general'
        ? !['agenda', 'slides', 'handout'].includes(d.document_type)
        : d.document_type === cat.value
    )
    if (inCat.length > 0) groups.push({ ...cat, docs: inCat })
  })
  return groups
}

function fmtBytes(n) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default function CollaborativeHub({ view = 'home' }) {
  const { token, threadId } = useParams()
  const [loading, setLoading] = useState(true)
  const [hub, setHub] = useState(null) // { collaborative_id, name, program_type, events, documents }
  const [error, setError] = useState(null)

  // Keep this page out of search indexes; the URL is the only gate.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => { document.head.removeChild(meta) }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error: err } = await supabase.rpc('hub_lookup', { p_token: token })
      if (cancelled) return
      if (err || !data) {
        setError('This hub link is invalid or the hub has been turned off.')
      } else {
        setHub(data)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [token])

  if (loading) return <HubShell><Card><p style={{ color: '#6b7280', margin: 0 }}>Loading…</p></Card></HubShell>
  if (error || !hub) {
    return (
      <HubShell>
        <Card>
          <h2 style={{ color: NAVY, marginTop: 0 }}>Hub not found</h2>
          <p style={{ color: '#374151' }}>{error || 'This hub link is invalid.'}</p>
        </Card>
      </HubShell>
    )
  }

  return (
    <HubShell>
      {view === 'home' && <HubHome token={token} hub={hub} />}
      {view === 'forum' && <HubForumList token={token} hub={hub} />}
      {view === 'thread' && <HubForumThread token={token} hub={hub} threadId={threadId} />}
      {view === 'resources' && <HubResources token={token} hub={hub} />}
    </HubShell>
  )
}

/* ------------------------------------------------------------------ */
/* Landing view                                                        */
/* ------------------------------------------------------------------ */

function HubHome({ token, hub }) {
  const navigate = useNavigate()
  const events = hub.events || []
  const docs = hub.documents || []
  const { current, concluded } = pickCurrentSession(events)

  const [recentThreads, setRecentThreads] = useState([])
  useEffect(() => {
    let cancelled = false
    supabase.rpc('hub_forum_threads', { p_token: token, p_limit: 3, p_offset: 0 })
      .then(({ data }) => { if (!cancelled && Array.isArray(data)) setRecentThreads(data) })
    return () => { cancelled = true }
  }, [token])

  const currentDocs = current ? docs.filter(d => d.event_id === current.id) : []
  // Previous sessions: every started event other than the current one,
  // newest first, collapsed by default so past material stays reachable
  // without burying the current session.
  const previousSessions = events
    .filter(e => e.started && (!current || e.id !== current.id))
    .slice()
    .reverse()
    .map(e => ({ event: e, docs: docs.filter(d => d.event_id === e.id) }))

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <>
      {/* Header */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <img src={ctacLogo} alt="Center on Trauma and Children" style={{ maxWidth: '230px', width: '100%', height: 'auto' }} />
        </div>
        <h1 style={{ color: NAVY, fontSize: '1.4rem', margin: '0 0 0.25rem', textAlign: 'center' }}>{hub.name}</h1>
        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>{todayLabel}</div>

        {current && (
          <div style={{
            marginTop: '1rem', background: '#f0fdfa', border: `1px solid ${TEAL}40`,
            borderLeft: `4px solid ${TEAL}`, borderRadius: '8px', padding: '0.85rem 1rem',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {concluded ? 'Final session' : current.started ? 'Current session' : 'Next session'}
            </div>
            <div style={{ fontWeight: 700, color: NAVY, fontSize: '1.05rem', marginTop: '0.15rem' }}>{current.title}</div>
            <div style={{ color: '#374151', fontSize: '0.88rem', marginTop: '0.15rem' }}>
              {formatEventDate(current.event_date)}
              {current.start_time && <> · {formatTimeRange(current.start_time, current.end_time, current.timezone)}</>}
              {current.location && <span style={{ color: '#6b7280' }}> · {current.location}</span>}
            </div>
            {current.zoom_link && !current.ended && (
              <a href={current.zoom_link} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-block', marginTop: '0.6rem', background: '#2563eb', color: 'white',
                textDecoration: 'none', padding: '0.45rem 0.9rem', borderRadius: '6px',
                fontSize: '0.85rem', fontWeight: 600,
              }}>🎦 Join Zoom</a>
            )}
            {concluded && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#6b7280' }}>
                This collaborative has concluded. Materials from every session stay available below.
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Current session materials (agenda first, then the rest, by category) */}
      {current && (
        <Card title={current.started ? `Materials — ${current.title}` : `Materials — ${current.title}`}>
          {!current.started ? (
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
              Materials for this session will appear here when the session starts.
            </p>
          ) : currentDocs.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
              No materials have been posted for this session yet.
            </p>
          ) : (
            <DocGroups docs={currentDocs} />
          )}
        </Card>
      )}

      {/* Previous sessions, collapsed */}
      {previousSessions.length > 0 && (
        <Card title="Previous sessions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {previousSessions.map(({ event, docs: eventDocs }) => (
              <CollapsibleSession key={event.id} event={event} docs={eventDocs} />
            ))}
          </div>
        </Card>
      )}

      {/* Community forum card + recent posts feed */}
      <Card title="💬 Community Forum">
        <p style={{ color: '#374151', fontSize: '0.9rem', marginTop: 0 }}>
          Share strategies, ask questions, and connect with other participants across the collaborative.
        </p>
        {recentThreads.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {recentThreads.map(t => (
              <button
                key={t.id}
                onClick={() => navigate(`/hub/${token}/forum/${t.id}`)}
                style={{
                  textAlign: 'left', background: '#f9fafb', border: '1px solid #e5e7eb',
                  borderRadius: '8px', padding: '0.6rem 0.8rem', cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, color: NAVY, fontSize: '0.9rem' }}>
                  {t.is_pinned && <span style={{ background: TEAL, color: 'white', padding: '0.05rem 0.35rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, marginRight: '0.4rem' }}>PINNED</span>}
                  {t.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                  {t.author}{t.author_district ? ` · ${t.author_district}` : ''} · {timeAgo(t.last_reply_at || t.created_at)} · {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}
                </div>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => navigate(`/hub/${token}/forum`)}
          style={{
            background: NAVY, color: 'white', border: 'none', padding: '0.55rem 1.1rem',
            borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
          }}
        >{recentThreads.length > 0 ? 'View all discussions →' : 'Start the first discussion →'}</button>
      </Card>

      {/* Resources card */}
      <Card title="📚 Resource Library">
        <p style={{ color: '#374151', fontSize: '0.9rem', marginTop: 0 }}>
          Guides, tools, and videos curated for this program — browse by topic anytime.
        </p>
        <button
          onClick={() => navigate(`/hub/${token}/resources`)}
          style={{
            background: TEAL, color: 'white', border: 'none', padding: '0.55rem 1.1rem',
            borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
          }}
        >Browse resources →</button>
      </Card>

      {/* Parking lot — only when the trainer has opted the current session in
          (parking_lot_enabled, off by default). hub_post_parking_lot refuses
          server-side too, so the hidden card is UX, not the boundary. */}
      {current?.parking_lot_enabled === true && (
        <ParkingLotCard token={token} currentTitle={current?.title} />
      )}
    </>
  )
}

function CollapsibleSession({ event, docs }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '0.7rem 0.9rem', textAlign: 'left',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, color: NAVY, fontSize: '0.92rem' }}>{event.title}</div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            {formatEventDate(event.event_date)}
            {docs.length > 0 && <> · {docs.length} file{docs.length === 1 ? '' : 's'}</>}
          </div>
        </div>
        <span style={{ color: NAVY, fontSize: '1rem', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>▶</span>
      </button>
      {open && (
        <div style={{ padding: '0 0.9rem 0.9rem' }}>
          {docs.length === 0
            ? <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>No materials were posted for this session.</div>
            : <DocGroups docs={docs} />}
        </div>
      )}
    </div>
  )
}

function DocGroups({ docs }) {
  const groups = groupDocs(docs)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {groups.map(g => (
        <div key={g.value}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            {g.label}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {g.docs.map(d => (
              <li key={d.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem',
                padding: '0.45rem 0', borderTop: '1px solid #e5e7eb',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: '#1f2937', fontSize: '0.9rem', overflowWrap: 'anywhere' }}>{d.file_name}</div>
                  {d.file_size != null && <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{fmtBytes(d.file_size)}</div>}
                </div>
                <DocumentDownloadButton doc={d} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function DocumentDownloadButton({ doc }) {
  const [busy, setBusy] = useState(false)
  const click = async () => {
    setBusy(true)
    try {
      const { data, error } = await supabase.storage
        .from('event-documents')
        .createSignedUrl(doc.storage_path, 3600)
      if (error) throw error
      logDownload({ documentId: doc.id }) // anon — userId stays null
      window.open(data.signedUrl, '_blank')
    } catch {
      alert('Could not generate a download link. Please try again, or ask your trainer.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <button onClick={click} disabled={busy} style={{
      background: TEAL, color: 'white', border: 'none', padding: '0.35rem 0.8rem',
      borderRadius: '6px', cursor: busy ? 'wait' : 'pointer', fontSize: '0.8rem', fontWeight: 600,
      flexShrink: 0,
    }}>{busy ? '…' : 'Download'}</button>
  )
}

/* ------------------------------------------------------------------ */
/* Identity-lite                                                       */
/* ------------------------------------------------------------------ */

// Wraps any posting UI. Reading never goes through this — identity is required
// to POST, never to READ. If localStorage already has an identity (captured at
// session sign-in, or from a previous post), children render immediately;
// otherwise a small inline name/district/role form appears once and persists.
function IdentityGate({ children, prompt = 'Before you post, tell us who you are:' }) {
  const [identity, setIdentity] = useState(loadIdentity)
  const [form, setForm] = useState({ name: '', district: '', role: '' })

  if (identity) return children(identity)

  const submit = (e) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) return
    const id = { name, district: form.district.trim(), role: form.role.trim() }
    saveIdentity(id)
    setIdentity(id)
  }

  const inputStyle = {
    width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #d1d5db',
    borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box',
  }

  return (
    <form onSubmit={submit} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.9rem' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.6rem' }}>{prompt}</div>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <input type="text" required value={form.name} placeholder="Your name *"
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
        <input type="text" value={form.district} placeholder="District or organization"
          onChange={(e) => setForm(f => ({ ...f, district: e.target.value }))} style={inputStyle} />
        <input type="text" value={form.role} placeholder="Role (e.g., Teacher, Counselor)"
          onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle} />
      </div>
      <button type="submit" style={{
        marginTop: '0.6rem', background: TEAL, color: 'white', border: 'none',
        padding: '0.45rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
      }}>Continue</button>
      <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.4rem' }}>
        Shown next to your posts so trainers and other participants know who's talking. Saved on this device only.
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Parking lot                                                         */
/* ------------------------------------------------------------------ */

function ParkingLotCard({ token, currentTitle }) {
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (identity) => {
    const body = draft.trim()
    if (!body) return
    setSubmitting(true)
    const { error } = await supabase.rpc('hub_post_parking_lot', {
      p_token: token,
      p_body: body,
      p_author_name: identity.name,
      p_author_district: identity.district || null,
      p_author_role: identity.role || null,
    })
    setSubmitting(false)
    if (error) { alert('Could not send your question. Please try again.'); return }
    setDraft('')
    setSent(true)
    setTimeout(() => setSent(false), 6000)
  }

  return (
    <Card title="🅿️ Have a question? Ask here">
      <p style={{ color: '#374151', fontSize: '0.88rem', marginTop: 0 }}>
        Questions and comments land in the trainers' parking lot
        {currentTitle ? <> for <strong>{currentTitle}</strong></> : null} and get picked up at the next session.
      </p>
      <IdentityGate prompt="Before you ask, tell us who you are:">
        {(identity) => (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(identity) }}
                placeholder="What would you like to ask or share?"
                disabled={submitting}
                style={{
                  flex: '1 1 220px', padding: '0.55rem 0.75rem', border: '1px solid #d1d5db',
                  borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => submit(identity)}
                disabled={submitting || !draft.trim()}
                style={{
                  background: (submitting || !draft.trim()) ? '#9ca3af' : TEAL, color: 'white', border: 'none',
                  padding: '0.55rem 1.1rem', borderRadius: '6px',
                  cursor: submitting ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: 600,
                }}
              >{submitting ? 'Sending…' : 'Send'}</button>
            </div>
            {sent && (
              <div style={{ marginTop: '0.5rem', background: '#ecfdf5', color: '#065f46', padding: '0.45rem 0.7rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                Sent — the trainers will see it before the next session. Posting as {identity.name}.
              </div>
            )}
          </>
        )}
      </IdentityGate>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Forum views                                                         */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 20

function HubForumList({ token, hub }) {
  const navigate = useNavigate()
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [posting, setPosting] = useState(false)

  const fetchThreads = async (offset = 0) => {
    const { data } = await supabase.rpc('hub_forum_threads', { p_token: token, p_limit: PAGE_SIZE, p_offset: offset })
    const rows = Array.isArray(data) ? data : []
    setThreads(prev => offset === 0 ? rows : [...prev, ...rows])
    setHasMore(rows.length === PAGE_SIZE)
    setLoading(false)
  }

  useEffect(() => { fetchThreads(0) }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const postThread = async (identity) => {
    if (newTitle.trim().length < 3 || !newBody.trim()) {
      alert('Please give your post a title (at least 3 characters) and a message.')
      return
    }
    setPosting(true)
    const { data: id, error } = await supabase.rpc('hub_post_thread', {
      p_token: token,
      p_title: newTitle.trim(),
      p_body: newBody.trim(),
      p_author_name: identity.name,
      p_author_district: identity.district || null,
      p_author_role: identity.role || null,
    })
    setPosting(false)
    if (error) { alert('Could not post. Please try again.'); return }
    setNewTitle(''); setNewBody(''); setShowNew(false)
    if (id) navigate(`/hub/${token}/forum/${id}`)
  }

  const inputStyle = {
    width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db',
    borderRadius: '6px', fontSize: '0.92rem', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  return (
    <>
      <HubSubHeader token={token} title={`Community Forum — ${hub.name}`} />
      <Card>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: showNew ? '0.75rem' : 0 }}>
          <button onClick={() => setShowNew(s => !s)} style={{
            background: showNew ? '#e5e7eb' : TEAL, color: showNew ? '#374151' : 'white',
            border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: 600,
          }}>{showNew ? 'Cancel' : '+ New post'}</button>
        </div>
        {showNew && (
          <IdentityGate>
            {(identity) => (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <input type="text" value={newTitle} maxLength={200} placeholder="Title…"
                  onChange={(e) => setNewTitle(e.target.value)} style={inputStyle} />
                <textarea rows={4} value={newBody} placeholder="What would you like to discuss?"
                  onChange={(e) => setNewBody(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Posting as {identity.name}{identity.district ? ` (${identity.district})` : ''}</span>
                  <button onClick={() => postThread(identity)} disabled={posting} style={{
                    background: posting ? '#9ca3af' : TEAL, color: 'white', border: 'none',
                    padding: '0.5rem 1.25rem', borderRadius: '6px', cursor: posting ? 'wait' : 'pointer',
                    fontSize: '0.9rem', fontWeight: 600,
                  }}>{posting ? 'Posting…' : 'Post'}</button>
                </div>
              </div>
            )}
          </IdentityGate>
        )}
      </Card>

      {loading ? (
        <Card><p style={{ color: '#6b7280', margin: 0 }}>Loading discussions…</p></Card>
      ) : threads.length === 0 ? (
        <Card>
          <p style={{ color: '#6b7280', margin: 0 }}>No discussions yet — be the first to post!</p>
        </Card>
      ) : (
        <>
          {threads.map(t => (
            <button
              key={t.id}
              onClick={() => navigate(`/hub/${token}/forum/${t.id}`)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', background: 'white',
                border: t.is_pinned ? `2px solid ${TEAL}` : '1px solid #e5e7eb',
                borderRadius: '12px', padding: '1rem 1.15rem', marginBottom: '0.6rem', cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ fontWeight: 600, color: NAVY, fontSize: '1rem' }}>
                {t.is_pinned && <span style={{ background: TEAL, color: 'white', padding: '0.05rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, marginRight: '0.4rem' }}>PINNED</span>}
                {t.title}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.3rem 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {t.body.length > 160 ? t.body.slice(0, 160) + '…' : t.body}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                <strong style={{ color: '#6b7280' }}>{t.author}</strong>
                {t.author_district ? ` · ${t.author_district}` : ''}
                {' · '}{timeAgo(t.last_reply_at || t.created_at)}
                {' · '}{t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}
              </div>
            </button>
          ))}
          {hasMore && (
            <Card>
              <button onClick={() => fetchThreads(threads.length)} style={{
                width: '100%', background: 'transparent', color: NAVY, border: 'none',
                cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
              }}>Load more</button>
            </Card>
          )}
        </>
      )}
    </>
  )
}

function HubForumThread({ token, threadId }) {
  const [data, setData] = useState(null) // { thread, posts }
  const [loading, setLoading] = useState(true)
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)

  const load = async () => {
    const { data: d } = await supabase.rpc('hub_forum_thread', { p_token: token, p_thread_id: threadId })
    setData(d || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [token, threadId]) // eslint-disable-line react-hooks/exhaustive-deps

  const reply = async (identity) => {
    const body = replyBody.trim()
    if (!body) return
    setReplying(true)
    const { error } = await supabase.rpc('hub_post_reply', {
      p_token: token,
      p_thread_id: threadId,
      p_body: body,
      p_author_name: identity.name,
      p_author_district: identity.district || null,
      p_author_role: identity.role || null,
    })
    setReplying(false)
    if (error) { alert('Could not post your reply. Please try again.'); return }
    setReplyBody('')
    load()
  }

  if (loading) return <><HubSubHeader token={token} title="Community Forum" backTo="forum" /><Card><p style={{ color: '#6b7280', margin: 0 }}>Loading…</p></Card></>
  if (!data?.thread) return <><HubSubHeader token={token} title="Community Forum" backTo="forum" /><Card><p style={{ color: '#6b7280', margin: 0 }}>This discussion could not be found.</p></Card></>

  const { thread, posts } = data

  return (
    <>
      <HubSubHeader token={token} title="Community Forum" backTo="forum" />
      <Card>
        <h2 style={{ color: NAVY, fontSize: '1.15rem', margin: '0 0 0.35rem' }}>{thread.title}</h2>
        <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
          <strong style={{ color: '#6b7280' }}>{thread.author}</strong>
          {thread.author_district ? ` · ${thread.author_district}` : ''}
          {thread.author_role ? ` · ${thread.author_role}` : ''}
          {' · '}{timeAgo(thread.created_at)}
        </div>
        <p style={{ color: '#374151', fontSize: '0.92rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 }}>{thread.body}</p>
      </Card>

      <Card title={`${(posts || []).length} ${(posts || []).length === 1 ? 'Reply' : 'Replies'}`}>
        {(posts || []).length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.88rem', margin: 0 }}>No replies yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {posts.map(p => (
              <div key={p.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.7rem 0.9rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.3rem' }}>
                  <strong style={{ color: '#6b7280' }}>{p.author}</strong>
                  {p.author_district ? ` · ${p.author_district}` : ''}
                  {' · '}{timeAgo(p.created_at)}
                </div>
                <div style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.body}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.9rem' }}>
          <IdentityGate>
            {(identity) => (
              <>
                <textarea
                  rows={3}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write a reply…"
                  style={{
                    width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db',
                    borderRadius: '6px', fontSize: '0.92rem', boxSizing: 'border-box',
                    fontFamily: 'inherit', resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Replying as {identity.name}</span>
                  <button
                    onClick={() => reply(identity)}
                    disabled={replying || !replyBody.trim()}
                    style={{
                      background: (replying || !replyBody.trim()) ? '#9ca3af' : TEAL, color: 'white',
                      border: 'none', padding: '0.5rem 1.2rem', borderRadius: '6px',
                      cursor: replying ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: 600,
                    }}
                  >{replying ? 'Posting…' : 'Post reply'}</button>
                </div>
              </>
            )}
          </IdentityGate>
        </div>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Resources view                                                      */
/* ------------------------------------------------------------------ */

function HubResources({ token, hub }) {
  const [resources, setResources] = useState([])
  const [categories, setCategories] = useState([])
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: res }, { data: cats }] = await Promise.all([
        supabase.rpc('hub_resources', { p_token: token }),
        supabase.from('resource_categories')
          .select('category_key, category_label, sort_order')
          .eq('program_type', hub.program_type)
          .order('sort_order'),
      ])
      if (cancelled) return
      setResources(Array.isArray(res) ? res : [])
      setCategories(cats || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [token, hub.program_type])

  const tabs = useMemo(() => {
    const withCounts = categories.map(c => ({
      value: c.category_key,
      label: c.category_label,
      count: resources.filter(r => r.tags?.includes(c.category_key)).length,
    })).filter(c => c.count > 0)
    return withCounts
  }, [categories, resources])

  useEffect(() => {
    if (!active && tabs.length > 0) setActive(tabs[0].value)
  }, [tabs, active])

  const filtered = active ? resources.filter(r => r.tags?.includes(active)) : resources

  return (
    <>
      <HubSubHeader token={token} title={`Resource Library — ${hub.name}`} />
      {loading ? (
        <Card><p style={{ color: '#6b7280', margin: 0 }}>Loading resources…</p></Card>
      ) : (
        <>
          {tabs.length > 0 && (
            <Card>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {tabs.map(t => (
                  <button key={t.value} onClick={() => setActive(t.value)} style={{
                    padding: '0.4rem 0.7rem', borderRadius: '8px',
                    border: active === t.value ? `2px solid ${TEAL}` : '1px solid #e5e7eb',
                    background: active === t.value ? '#e0f7f5' : 'white',
                    color: active === t.value ? '#0f766e' : '#374151',
                    fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem',
                  }}>{t.label} <span style={{ opacity: 0.6 }}>({t.count})</span></button>
                ))}
              </div>
            </Card>
          )}
          {filtered.length === 0 ? (
            <Card><p style={{ color: '#6b7280', margin: 0 }}>No resources here yet.</p></Card>
          ) : (
            filtered.map(r => <HubResourceRow key={r.id} resource={r} />)
          )}
        </>
      )}
    </>
  )
}

function HubResourceRow({ resource }) {
  const [busy, setBusy] = useState(false)
  const isFile = ['pdf', 'docx', 'doc', 'pptx'].includes(resource.resource_type) && resource.file_path

  const download = async () => {
    setBusy(true)
    try {
      const { data, error } = await supabase.storage
        .from('resources')
        .createSignedUrl(resource.file_path, 3600)
      if (error) throw error
      logDownload({ resourceId: resource.id })
      window.open(data.signedUrl, '_blank')
    } catch {
      alert('Could not generate a download link. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const openUrl = resource.resource_type === 'youtube' ? resource.youtube_url : resource.link_url

  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px',
      padding: '0.9rem 1.1rem', marginBottom: '0.6rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap',
    }}>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: NAVY, fontSize: '0.95rem', overflowWrap: 'anywhere' }}>{resource.title}</div>
        {resource.description && (
          <div style={{ color: '#6b7280', fontSize: '0.83rem', marginTop: '0.2rem', lineHeight: 1.45 }}>{resource.description}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        {isFile ? (
          <button onClick={download} disabled={busy} style={{
            background: TEAL, color: 'white', border: 'none', padding: '0.4rem 0.85rem',
            borderRadius: '6px', cursor: busy ? 'wait' : 'pointer', fontSize: '0.8rem', fontWeight: 600,
          }}>{busy ? '…' : 'Download'}</button>
        ) : openUrl ? (
          <a href={openUrl} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-block', background: resource.resource_type === 'youtube' ? '#dc2626' : TEAL,
            color: 'white', textDecoration: 'none', padding: '0.4rem 0.85rem',
            borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600,
          }}>{resource.resource_type === 'youtube' ? '▶ Watch' : 'Open link'}</a>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shared shell                                                        */
/* ------------------------------------------------------------------ */

function HubSubHeader({ token, title, backTo = '' }) {
  const navigate = useNavigate()
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <button
        onClick={() => navigate(backTo === 'forum' ? `/hub/${token}/forum` : `/hub/${token}`)}
        style={{
          background: 'rgba(255,255,255,0.92)', color: NAVY, border: 'none',
          padding: '0.45rem 0.9rem', borderRadius: '8px', cursor: 'pointer',
          fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem',
        }}
      >← {backTo === 'forum' ? 'All discussions' : 'Hub home'}</button>
      <h1 style={{ color: 'white', fontSize: '1.15rem', margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>{title}</h1>
    </div>
  )
}

// Same brand background as the public registration page (teal→navy gradient,
// CTAC logo up top via the header card, UK lockup at the bottom) so the hub
// reads as part of the same system. Single column throughout, so it holds up
// at 360px — participants open this on phones during sessions.
function HubShell({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${TEAL} 0%, ${NAVY} 100%)`,
      backgroundAttachment: 'fixed',
      padding: '1.25rem 0.75rem 2rem',
    }}>
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        {children}
        <div style={{
          background: 'white', borderRadius: '0.75rem', padding: '1.25rem',
          display: 'flex', justifyContent: 'center', marginTop: '0.75rem',
        }}>
          <img src={ukLogo} alt="University of Kentucky" style={{ maxWidth: '220px', width: '100%', height: 'auto' }} />
        </div>
      </div>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <section style={{
      background: 'white', borderRadius: '0.75rem',
      padding: '1.25rem', marginBottom: '0.75rem',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    }}>
      {title && <h3 style={{ margin: '0 0 0.75rem', color: NAVY, fontSize: '1.05rem' }}>{title}</h3>}
      {children}
    </section>
  )
}
