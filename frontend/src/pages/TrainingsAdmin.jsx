import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, cardStyle, cardHeaderStyle } from '../utils/constants'
import StandaloneTrainingModal from '../components/StandaloneTrainingModal'

// Standalone trainings admin listing — /admin/trainings.
// Lists trainings the caller can SEE (super_admin sees all; trainer_admin
// sees all standalone trainings via the "Trainer admins read all standalone
// trainings" RLS policy). Edit/delete actions only enabled on trainings the
// caller can MANAGE (own or super_admin) per the admin RLS policy.
export default function TrainingsAdmin() {
  const navigate = useNavigate()
  const { user, isAdminLevel, isSuperAdmin } = useAuth()

  const [trainings, setTrainings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('bsc_events')
      .select('id, title, event_date, end_date, start_time, end_time, zoom_link, location_name, city, state, hub_token, created_by, user_profiles:created_by ( full_name )')
      .eq('kind', 'standalone_training')
      .order('event_date', { ascending: false })

    // Attach registration counts per training (sum across all registration links for the event)
    const trainingIds = (data || []).map(t => t.id)
    let countsByEvent = {}
    if (trainingIds.length > 0) {
      const { data: linkRows } = await supabase
        .from('event_registration_link_events')
        .select('event_id, registration_link_id')
        .in('event_id', trainingIds)
      const linkIdsByEvent = {}
      ;(linkRows || []).forEach(r => {
        if (!linkIdsByEvent[r.event_id]) linkIdsByEvent[r.event_id] = []
        linkIdsByEvent[r.event_id].push(r.registration_link_id)
      })
      const allLinkIds = [...new Set((linkRows || []).map(r => r.registration_link_id))]
      if (allLinkIds.length > 0) {
        const { data: regs } = await supabase
          .from('event_registrations')
          .select('registration_link_id, status')
          .in('registration_link_id', allLinkIds)
          .in('status', ['registered','checked_in'])
        const regCountByLink = {}
        ;(regs || []).forEach(r => {
          regCountByLink[r.registration_link_id] = (regCountByLink[r.registration_link_id] || 0) + 1
        })
        Object.entries(linkIdsByEvent).forEach(([eventId, linkIds]) => {
          countsByEvent[eventId] = linkIds.reduce((sum, lid) => sum + (regCountByLink[lid] || 0), 0)
        })
      }
    }

    setTrainings((data || []).map(t => ({
      ...t,
      registered_count: countsByEvent[t.id] || 0,
      can_manage: isSuperAdmin || t.created_by === user?.id,
    })))
    setLoading(false)
  }

  useEffect(() => { if (user?.id) load() }, [user?.id])

  const handleSaved = (saved) => {
    setShowCreateModal(false)
    setEditingEvent(null)
    load()
    // If we just created a new one, jump to its manage page
    if (saved && !editingEvent) {
      navigate(`/admin/event/${saved.id}`)
    }
  }

  const now = new Date()
  const statusOf = (t) => {
    const start = new Date(t.event_date + 'T' + (t.start_time || '00:00:00'))
    const endDateStr = t.end_date || t.event_date
    const end = new Date(endDateStr + 'T' + (t.end_time || '23:59:00'))
    if (now < start) return { label: 'Upcoming', color: '#1e40af', bg: '#dbeafe' }
    if (now > end) return { label: 'Closed', color: '#6b7280', bg: '#f3f4f6' }
    return { label: 'In progress', color: '#166534', bg: '#dcfce7' }
  }

  if (!isAdminLevel) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Only admins can manage standalone trainings.
        <div style={{ marginTop: '1rem' }}>
          <button onClick={() => navigate('/admin')} style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Back to Dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <div style={{ background: COLORS.navy, color: 'white', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => navigate('/admin')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>← Back</button>
            <h1 style={{ margin: 0, fontSize: '1.4rem' }}>📚 Standalone Trainings</h1>
          </div>
          <button
            onClick={() => { setEditingEvent(null); setShowCreateModal(true) }}
            style={{
              background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
              color: 'white', padding: '0.55rem 1.25rem', borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.3)', fontWeight: 600,
              cursor: 'pointer', fontSize: '0.9rem',
            }}
          >+ Create Training</button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        <section style={{ ...cardStyle }}>
          <div style={cardHeaderStyle}>All standalone trainings</div>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : trainings.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No standalone trainings yet. Click <strong>+ Create Training</strong> above to add one.
            </p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-card-alt, #f9fafb)', borderBottom: '2px solid var(--border)' }}>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Date(s)</th>
                    <th style={thStyle}>Mode</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Registered</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Trainer</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {trainings.map(t => {
                    const status = statusOf(t)
                    const mode = t.zoom_link ? 'Online' : 'In-person'
                    const dates = t.end_date
                      ? `${fmtShort(t.event_date)} – ${fmtShort(t.end_date)}`
                      : fmtShort(t.event_date)
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={tdStyle}>
                          <strong style={{ color: COLORS.navy }}>{t.title}</strong>
                          {t.location_name && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {t.location_name}{t.city && ` · ${t.city}${t.state ? ', ' + t.state : ''}`}
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>{dates}</td>
                        <td style={tdStyle}>{mode}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <strong style={{ color: '#166534' }}>{t.registered_count}</strong>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ background: status.bg, color: status.color, padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{status.label}</span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {t.user_profiles?.full_name || '—'}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button onClick={() => navigate(`/admin/event/${t.id}`)} style={{ background: COLORS.navy, color: 'white', border: 'none', padding: '0.3rem 0.65rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}>Manage</button>
                            {t.can_manage && (
                              <button onClick={() => { setEditingEvent(t); setShowCreateModal(true) }} style={{ background: 'transparent', color: COLORS.navy, border: `1px solid ${COLORS.navy}`, padding: '0.3rem 0.65rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}>Edit</button>
                            )}
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
        <StandaloneTrainingModal
          editingEvent={editingEvent}
          onClose={() => { setShowCreateModal(false); setEditingEvent(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

const thStyle = {
  textAlign: 'left', padding: '0.5rem 0.6rem',
  fontWeight: 700, color: 'var(--text-secondary)',
  fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em',
}
const tdStyle = { padding: '0.5rem 0.6rem', verticalAlign: 'middle' }

function fmtShort(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
