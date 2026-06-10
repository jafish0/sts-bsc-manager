import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'
import RegistrationLinkModal from '../components/RegistrationLinkModal'
import RegistrationRosterModal from '../components/RegistrationRosterModal'

// Cross-collaborative registrations admin page (admin-tier only).
// Lives at /admin/registrations. Lets admins create new registration links
// for any of their assigned collaboratives + see every link they admin
// in one sortable table.
export default function RegistrationsAdmin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAdminLevel } = useAuth()

  const [collaboratives, setCollaboratives] = useState([])  // [{id, name, link_count, events: [...]}]
  const [registrationLinks, setRegistrationLinks] = useState([])  // flat array; each row has collaborative name joined in
  const [loading, setLoading] = useState(true)

  // Create flow. The ?prefill_collab=<id> query param (set by EventDetail's
  // "Create registration link →" affordance) preselects the dropdown.
  const [createCollabId, setCreateCollabId] = useState(() => searchParams.get('prefill_collab') || '')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingLink, setEditingLink] = useState(null)
  const [eventsForCreateCollab, setEventsForCreateCollab] = useState([])

  // Roster
  const [viewingRoster, setViewingRoster] = useState(null) // { id, title }

  // Sort
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const loadAll = async () => {
    setLoading(true)
    // 1. Pull all collabs the user can admin (RLS scopes for trainer_admins).
    const { data: collabs } = await supabase
      .from('collaboratives')
      .select('id, name, program_type, status')
      .order('name')

    // 2. Pull all registration links for those collabs.
    const collabIds = (collabs || []).map(c => c.id)
    let links = []
    if (collabIds.length > 0) {
      const { data: l } = await supabase
        .from('event_registration_links')
        .select('*')
        .in('collaborative_id', collabIds)
        .order('created_at', { ascending: false })
      links = l || []
    }

    // 3. Counts per link.
    const linkIds = links.map(l => l.id)
    let countsByLink = {}
    if (linkIds.length > 0) {
      const { data: regs } = await supabase
        .from('event_registrations')
        .select('registration_link_id, status')
        .in('registration_link_id', linkIds)
      ;(regs || []).forEach(r => {
        if (!countsByLink[r.registration_link_id]) countsByLink[r.registration_link_id] = { registered: 0, waitlisted: 0, cancelled: 0, checked_in: 0 }
        countsByLink[r.registration_link_id][r.status] = (countsByLink[r.registration_link_id][r.status] || 0) + 1
      })
    }

    // 4. Compose flat list with collab name; compute per-collab link counts.
    const collabById = Object.fromEntries((collabs || []).map(c => [c.id, c]))
    const linkCountByCollab = {}
    links.forEach(l => { linkCountByCollab[l.collaborative_id] = (linkCountByCollab[l.collaborative_id] || 0) + 1 })
    const collabsWithCounts = (collabs || []).map(c => ({
      ...c,
      link_count: linkCountByCollab[c.id] || 0,
    }))
    const flatLinks = links.map(l => ({
      ...l,
      counts: countsByLink[l.id] || { registered: 0, waitlisted: 0, cancelled: 0, checked_in: 0 },
      collaborative_name: collabById[l.collaborative_id]?.name || '?',
    }))

    setCollaboratives(collabsWithCounts)
    setRegistrationLinks(flatLinks)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  // When the user picks a collab to create against, fetch its events for the modal.
  useEffect(() => {
    if (!createCollabId) { setEventsForCreateCollab([]); return }
    ;(async () => {
      const { data } = await supabase
        .from('bsc_events')
        .select('id, title, event_date, start_time, end_time')
        .eq('collaborative_id', createCollabId)
        .order('event_date', { ascending: true })
      setEventsForCreateCollab(data || [])
    })()
  }, [createCollabId])

  const sortedLinks = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const arr = [...registrationLinks]
    arr.sort((a, b) => {
      const av = sortValue(a, sortField)
      const bv = sortValue(b, sortField)
      if (av == null && bv == null) return 0
      if (av == null) return 1 * dir
      if (bv == null) return -1 * dir
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return arr
  }, [registrationLinks, sortField, sortDir])

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const arrow = (field) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  const handleEdit = async (link) => {
    // Fetch events for the link's collab so the modal can show the picker.
    const { data: events } = await supabase
      .from('bsc_events')
      .select('id, title, event_date, start_time, end_time')
      .eq('collaborative_id', link.collaborative_id)
      .order('event_date', { ascending: true })
    setEventsForCreateCollab(events || [])
    setCreateCollabId(link.collaborative_id)
    setEditingLink(link)
    setShowCreateModal(true)
  }

  const startCreate = () => {
    if (!createCollabId) { alert('Pick a collaborative first.'); return }
    setEditingLink(null)
    setShowCreateModal(true)
  }

  if (!isAdminLevel) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Only admins can manage registrations.
        <div style={{ marginTop: '1rem' }}>
          <button onClick={() => navigate('/admin')} style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Back to Dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ background: COLORS.navy, color: 'white', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => navigate('/admin')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>← Back</button>
            <h1 style={{ margin: 0, fontSize: '1.4rem' }}>📝 Registrations</h1>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>

        {/* Create section */}
        <section style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <div style={cardHeaderStyle}>Create a registration link</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Pick a collaborative, then build a public registration form. You can create more than one link per collaborative
            (e.g., a general public link and a senior-leaders-only link with different fields).
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={createCollabId}
              onChange={e => setCreateCollabId(e.target.value)}
              style={{ flex: 1, minWidth: '20rem', padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem', background: 'var(--bg-card)' }}
            >
              <option value="">— Pick a collaborative —</option>
              {collaboratives.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.link_count > 0 && ` (${c.link_count} link${c.link_count === 1 ? '' : 's'})`}
                </option>
              ))}
            </select>
            <button
              onClick={startCreate}
              disabled={!createCollabId}
              style={{
                background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
                color: 'white', padding: '0.55rem 1.25rem', borderRadius: '6px',
                border: 'none', fontWeight: 600, cursor: createCollabId ? 'pointer' : 'not-allowed',
                fontSize: '0.9rem', opacity: createCollabId ? 1 : 0.5,
              }}
            >+ Create Registration Link</button>
          </div>
        </section>

        {/* All links table */}
        <section style={{ ...cardStyle }}>
          <div style={cardHeaderStyle}>All registration links</div>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : registrationLinks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              You don't have any registration links yet. Pick a collaborative above to create your first one.
            </p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-card-alt, #f9fafb)', borderBottom: '2px solid var(--border)' }}>
                    <Th onClick={() => toggleSort('title')}>Title{arrow('title')}</Th>
                    <Th onClick={() => toggleSort('collaborative_name')}>Collaborative{arrow('collaborative_name')}</Th>
                    <Th onClick={() => toggleSort('status')}>Status{arrow('status')}</Th>
                    <Th onClick={() => toggleSort('registered')} align="right">Registered{arrow('registered')}</Th>
                    <Th onClick={() => toggleSort('waitlisted')} align="right">Waitlisted{arrow('waitlisted')}</Th>
                    <Th onClick={() => toggleSort('capacity')} align="right">Capacity{arrow('capacity')}</Th>
                    <Th onClick={() => toggleSort('created_at')}>Created{arrow('created_at')}</Th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLinks.map(link => {
                    const status = computeStatus(link)
                    return (
                      <tr key={link.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={tdStyle}><strong style={{ color: COLORS.navy }}>{link.title}</strong></td>
                        <td style={tdStyle}>{link.collaborative_name}</td>
                        <td style={tdStyle}>
                          <span style={{ background: status.bg, color: status.color, padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{status.label}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}><strong style={{ color: '#166534' }}>{link.counts.registered}</strong></td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: link.counts.waitlisted > 0 ? '#92400e' : 'var(--text-faint)' }}>{link.counts.waitlisted || ''}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{link.capacity ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                        <td style={{ ...tdStyle, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{new Date(link.created_at).toLocaleDateString()}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button onClick={() => setViewingRoster({ id: link.id, title: link.title })} style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.3rem 0.65rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}>Roster</button>
                            <button onClick={() => handleEdit(link)} style={{ background: 'transparent', color: COLORS.navy, border: `1px solid ${COLORS.navy}`, padding: '0.3rem 0.65rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}>Edit</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showCreateModal && (
        <RegistrationLinkModal
          collaborativeId={createCollabId}
          eventsForCollab={eventsForCreateCollab}
          editingLink={editingLink}
          onClose={() => { setShowCreateModal(false); setEditingLink(null) }}
          onSaved={() => { loadAll() }}
        />
      )}

      {viewingRoster && (
        <RegistrationRosterModal
          linkId={viewingRoster.id}
          linkTitle={viewingRoster.title}
          onClose={() => setViewingRoster(null)}
          onChange={loadAll}
        />
      )}
    </div>
  )
}

const thStyle = {
  textAlign: 'left', padding: '0.5rem 0.6rem',
  fontWeight: 700, color: 'var(--text-secondary)',
  fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em',
  cursor: 'pointer', userSelect: 'none',
}

const tdStyle = {
  padding: '0.5rem 0.6rem', verticalAlign: 'middle',
}

function Th({ onClick, children, align = 'left' }) {
  return <th style={{ ...thStyle, textAlign: align }} onClick={onClick}>{children}</th>
}

function sortValue(link, field) {
  if (field === 'registered') return link.counts.registered
  if (field === 'waitlisted') return link.counts.waitlisted
  if (field === 'capacity') return link.capacity ?? -Infinity
  if (field === 'status') return computeStatus(link).label
  if (field === 'collaborative_name') return (link.collaborative_name || '').toLowerCase()
  if (field === 'title') return (link.title || '').toLowerCase()
  if (field === 'created_at') return link.created_at || ''
  return null
}

function computeStatus(link) {
  if (!link.is_active) return { label: 'Closed', color: '#991b1b', bg: '#fee2e2' }
  if (link.registration_opens_at && new Date(link.registration_opens_at) > new Date()) return { label: 'Pre-open', color: '#92400e', bg: '#fef3c7' }
  if (link.registration_closes_at && new Date(link.registration_closes_at) < new Date()) return { label: 'Closed', color: '#991b1b', bg: '#fee2e2' }
  return { label: 'Active', color: '#166534', bg: '#dcfce7' }
}
