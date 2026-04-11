import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import AddTeamModal from '../components/AddTeamModal'
import InviteTeamLeaderModal from '../components/InviteTeamLeaderModal'
import AttendanceReport from '../components/AttendanceReport'
import EvaluationReport from '../components/EvaluationReport'
import ctacLogo from '../assets/CTAC_white.png'

const EVENT_TYPES = [
  { value: 'learning_session', label: 'Learning Session', audience: 'all_teams' },
  { value: 'all_team_call', label: 'All-Team Call', audience: 'all_teams' },
  { value: 'senior_leader_call', label: 'Senior Leader Call', audience: 'senior_leaders' },
  { value: 'team_consultation', label: 'Team Consultation', audience: 'individual_team' },
  { value: 'assessment_window', label: 'Assessment Window', audience: 'all_teams' },
  { value: 'other', label: 'Other', audience: 'all_teams' }
]

export default function CollaborativeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [collaborative, setCollaborative] = useState(null)
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddTeamModal, setShowAddTeamModal] = useState(false)
  const [inviteTeam, setInviteTeam] = useState(null)
  const [teamLeaders, setTeamLeaders] = useState({})
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'active'
  })

  // Events state
  const [events, setEvents] = useState([])
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({
    event_type: 'learning_session', title: '', event_date: '',
    start_time: '', end_time: '', location: 'Virtual'
  })

  // Session link & report state
  const [sessionLinks, setSessionLinks] = useState({})
  const [attendanceCounts, setAttendanceCounts] = useState({})
  const [evalCounts, setEvalCounts] = useState({})
  const [viewAttendance, setViewAttendance] = useState(null)
  const [viewEvaluation, setViewEvaluation] = useState(null)
  const [linkCopied, setLinkCopied] = useState(null)

  useEffect(() => {
    fetchCollaborative()
    fetchTeams()
    fetchTeamLeaders()
    fetchEvents()
  }, [id])

  const fetchCollaborative = async () => {
    try {
      const { data, error } = await supabase
        .from('collaboratives')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      setCollaborative(data)
      setEditForm({
        name: data.name,
        description: data.description || '',
        start_date: data.start_date,
        end_date: data.end_date || '',
        status: data.status || 'active'
      })
    } catch (error) {
      console.error('Error fetching collaborative:', error)
      alert('Error loading collaborative details')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          team_codes (
            id,
            code,
            timepoint,
            created_at
          )
        `)
        .eq('collaborative_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTeams(data || [])
    } catch (error) {
      console.error('Error fetching teams:', error)
    }
  }

  const fetchTeamLeaders = async () => {
    try {
      // Get all teams for this collaborative first
      const { data: collabTeams } = await supabase
        .from('teams')
        .select('id')
        .eq('collaborative_id', id)

      if (!collabTeams?.length) return

      const teamIds = collabTeams.map(t => t.id)
      const { data: leaders, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, team_id, role')
        .in('team_id', teamIds)
        .in('role', ['agency_admin', 'team_leader'])

      if (error) throw error

      // Group by team_id
      const grouped = {}
      for (const leader of (leaders || [])) {
        if (!grouped[leader.team_id]) grouped[leader.team_id] = []
        grouped[leader.team_id].push(leader)
      }
      setTeamLeaders(grouped)
    } catch (err) {
      console.error('Error fetching team leaders:', err)
    }
  }

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('bsc_events')
      .select('*')
      .eq('collaborative_id', id)
      .order('event_date')
    setEvents(data || [])

    // Load session links for learning sessions
    const { data: links } = await supabase
      .from('session_links')
      .select('*')
      .eq('collaborative_id', id)
    const linkMap = {}
    ;(links || []).forEach(l => { linkMap[l.bsc_event_id] = l })
    setSessionLinks(linkMap)

    // Load attendance counts
    const { data: attData } = await supabase
      .from('session_attendance')
      .select('bsc_event_id')
      .eq('collaborative_id', id)
    const attCounts = {}
    ;(attData || []).forEach(a => { attCounts[a.bsc_event_id] = (attCounts[a.bsc_event_id] || 0) + 1 })
    setAttendanceCounts(attCounts)

    // Load eval counts
    const { data: evalData } = await supabase
      .from('session_evaluations')
      .select('bsc_event_id')
      .eq('collaborative_id', id)
    const eCounts = {}
    ;(evalData || []).forEach(e => { eCounts[e.bsc_event_id] = (eCounts[e.bsc_event_id] || 0) + 1 })
    setEvalCounts(eCounts)
  }

  const generateSessionLink = async (evt) => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 8)
    // Expire at 4:00 PM EST on event date
    const expiresAt = new Date(`${evt.event_date}T21:00:00.000Z`) // 4PM EST = 9PM UTC

    const { data, error } = await supabase
      .from('session_links')
      .insert({
        bsc_event_id: evt.id,
        collaborative_id: id,
        token,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single()

    if (error) { alert('Error: ' + error.message); return }
    setSessionLinks(prev => ({ ...prev, [evt.id]: data }))
  }

  const closeSession = async (evt) => {
    if (!window.confirm('Close this session? All unsigned-out attendees will be marked as session-closed.')) return
    const link = sessionLinks[evt.id]
    if (!link) return

    // Deactivate link
    await supabase.from('session_links').update({ is_active: false }).eq('id', link.id)

    // Bulk sign-out attendees without sign-out time
    await supabase
      .from('session_attendance')
      .update({ signed_out_at: new Date().toISOString(), sign_out_method: 'session_closed' })
      .eq('bsc_event_id', evt.id)
      .is('signed_out_at', null)

    setSessionLinks(prev => ({ ...prev, [evt.id]: { ...prev[evt.id], is_active: false } }))
  }

  const copySessionLink = async (token) => {
    const url = `https://sts-bsc-manager.vercel.app/session/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(token)
      setTimeout(() => setLinkCopied(null), 2000)
    } catch (err) {
      alert('Failed to copy link')
    }
  }

  const handleAddEvent = async () => {
    if (!newEvent.event_date || !newEvent.title.trim()) return
    const typeInfo = EVENT_TYPES.find(t => t.value === newEvent.event_type)
    const lsCount = events.filter(e => e.event_type === newEvent.event_type).length
    const { error } = await supabase
      .from('bsc_events')
      .insert({
        collaborative_id: id,
        event_type: newEvent.event_type,
        title: newEvent.title.trim(),
        event_date: newEvent.event_date,
        start_time: newEvent.start_time || null,
        end_time: newEvent.end_time || null,
        location: newEvent.location || null,
        audience: typeInfo?.audience || 'all_teams',
        sequence_number: newEvent.event_type === 'learning_session' ? lsCount + 1 : null
      })
    if (error) { alert('Error adding event: ' + error.message); return }
    setShowAddEvent(false)
    setNewEvent({ event_type: 'learning_session', title: '', event_date: '', start_time: '', end_time: '', location: 'Virtual' })
    fetchEvents()
  }

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event?')) return
    const { error } = await supabase.from('bsc_events').delete().eq('id', eventId)
    if (error) { alert('Error: ' + error.message); return }
    setEvents(prev => prev.filter(e => e.id !== eventId))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('collaboratives')
        .update(editForm)
        .eq('id', id)

      if (error) throw error

      setCollaborative({ ...collaborative, ...editForm })
      setIsEditing(false)
      alert('Collaborative updated successfully!')
    } catch (error) {
      console.error('Error updating collaborative:', error)
      alert('Error updating collaborative')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditForm({
      name: collaborative.name,
      description: collaborative.description || '',
      start_date: collaborative.start_date,
      end_date: collaborative.end_date || '',
      status: collaborative.status || 'active'
    })
    setIsEditing(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Code copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
      alert('Failed to copy code')
    }
  }

  const getTimepointLabel = (timepoint) => {
    const labels = {
      baseline: 'Baseline',
      endline: 'Endline',
      'followup_6mo': '6-Month Follow-up',
      'followup_12mo': '12-Month Follow-up'
    }
    return labels[timepoint] || timepoint
  }

  const handleAddTeamSuccess = () => {
    setShowAddTeamModal(false)
    fetchTeams()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📋</div>
          <div>Loading collaborative details...</div>
        </div>
      </div>
    )
  }

  if (!collaborative) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h2 style={{ color: '#374151', marginBottom: '1rem' }}>Collaborative Not Found</h2>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
            The collaborative you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/admin/collaboratives')}
            style={{
              background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            Back to Collaboratives
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0E1F56 0%, #1a2f6f 100%)' }}>
      {/* Header */}
      <div style={{ 
        background: 'rgba(255, 255, 255, 0.1)', 
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '1.5rem 2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', cursor: 'pointer' }}
            onClick={() => navigate('/admin/collaboratives')}>
            <img 
              src={ctacLogo} 
              alt="CTAC" 
              style={{ height: '50px', width: 'auto' }}
            />
            <div>
              <h1 style={{ fontSize: '1.25rem', margin: 0, color: 'white' }}>Collaborative Details</h1>
              <p style={{ fontSize: '0.875rem', margin: 0, opacity: 0.9, color: 'white' }}>
                View and manage collaborative information
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '2px solid white',
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'white'
              e.currentTarget.style.color = '#0E1F56'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
              e.currentTarget.style.color = 'white'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {/* Back Button */}
        <button
          onClick={() => navigate('/admin/collaboratives')}
          style={{
            background: 'white',
            color: '#6b7280',
            padding: '0.625rem 1.25rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontWeight: '600',
            cursor: 'pointer',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          ← Back to Collaboratives
        </button>

        {/* Collaborative Info Card */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ color: '#0E1F56', fontSize: '1.875rem', margin: '0 0 0.5rem 0' }}>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={{
                      fontSize: '1.875rem',
                      fontWeight: '700',
                      padding: '0.5rem',
                      border: '2px solid #0E1F56',
                      borderRadius: '8px',
                      width: '100%'
                    }}
                  />
                ) : (
                  collaborative.name
                )}
              </h2>
              <span style={{
                background: collaborative.status === 'active' ? '#d1fae5' : '#f3f4f6',
                color: collaborative.status === 'active' ? '#10b981' : '#6b7280',
                padding: '0.25rem 0.75rem',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}>
                {collaborative.status === 'active' ? 'Active' : 'Completed'}
              </span>
            </div>

            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
                  color: 'white',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Edit
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  style={{
                    background: '#e5e7eb',
                    color: '#374151',
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    opacity: saving ? 0.5 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    background: saving ? '#9ca3af' : 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
                    color: 'white',
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editForm.end_date}
                    onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.95rem'
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <>
              {collaborative.description && (
                <p style={{ color: '#6b7280', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                  {collaborative.description}
                </p>
              )}

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '2px solid #e5e7eb'
              }}>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Start Date</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0E1F56' }}>
                    {formatDate(collaborative.start_date)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>End Date</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0E1F56' }}>
                    {formatDate(collaborative.end_date)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Teams</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#00A79D' }}>
                    {teams.length}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* BSC Events Section */}
        <div style={{
          background: 'white', borderRadius: '12px', padding: '2rem',
          marginBottom: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0E1F56', margin: 0 }}>
              BSC Events
            </h3>
            <button onClick={() => setShowAddEvent(!showAddEvent)} style={{
              background: showAddEvent ? '#e5e7eb' : 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
              color: showAddEvent ? '#374151' : 'white',
              padding: '0.625rem 1.25rem', borderRadius: '8px', border: 'none',
              fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem'
            }}>{showAddEvent ? 'Cancel' : '+ Add Event'}</button>
          </div>

          {showAddEvent && (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select value={newEvent.event_type} onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
                  style={{ padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }}>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input type="text" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Event title" style={{ padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input type="date" value={newEvent.event_date} onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                  style={{ padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }} />
                <input type="time" value={newEvent.start_time} onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                  style={{ padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }} />
                <input type="time" value={newEvent.end_time} onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                  style={{ padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }} />
                <input type="text" value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="Location" style={{ padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }} />
              </div>
              <button onClick={handleAddEvent} style={{
                background: '#00A79D', color: 'white', border: 'none', borderRadius: '6px',
                padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
              }}>Add Event</button>
            </div>
          )}

          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              <p>No events scheduled yet. Add Learning Sessions and other key dates above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {events.map(evt => {
                const link = sessionLinks[evt.id]
                const isLS = evt.event_type === 'learning_session'
                const attCount = attendanceCounts[evt.id] || 0
                const evCount = evalCounts[evt.id] || 0
                const isExpired = link && new Date(link.expires_at) < new Date()
                const linkActive = link && link.is_active && !isExpired

                return (
                  <div key={evt.id} style={{
                    padding: '0.75rem 1rem', background: '#f9fafb', borderRadius: '8px',
                    border: '1px solid #f3f4f6'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase',
                          background: isLS ? '#dbeafe' : '#f3f4f6',
                          color: isLS ? '#1e40af' : '#6b7280',
                          padding: '0.15rem 0.5rem', borderRadius: '4px'
                        }}>{EVENT_TYPES.find(t => t.value === evt.event_type)?.label || evt.event_type}</span>
                        <span style={{ fontWeight: '600', color: '#0E1F56', fontSize: '0.9rem' }}>{evt.title}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                          {new Date(evt.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {evt.start_time && ` at ${evt.start_time.slice(0,5)}`}
                        </span>
                        {evt.location && <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>({evt.location})</span>}
                        {isLS && attCount > 0 && (
                          <span style={{ background: '#d1fae5', color: '#166534', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>
                            {attCount} attended
                          </span>
                        )}
                        {isLS && evCount > 0 && (
                          <span style={{ background: '#EFF6FF', color: '#1E40AF', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>
                            {evCount} evals
                          </span>
                        )}
                      </div>
                      <button onClick={() => handleDeleteEvent(evt.id)} style={{
                        background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem'
                      }}>Delete</button>
                    </div>

                    {/* Session management controls for learning sessions */}
                    {isLS && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {!link ? (
                          <button onClick={() => generateSessionLink(evt)} style={{
                            padding: '0.25rem 0.6rem', background: '#00A79D', color: 'white',
                            border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600'
                          }}>Generate Sign-In Link</button>
                        ) : (
                          <>
                            {/* Link status */}
                            <span style={{
                              fontSize: '0.7rem', fontWeight: '600',
                              color: linkActive ? '#166534' : '#991B1B',
                              background: linkActive ? '#d1fae5' : '#FEE2E2',
                              padding: '0.15rem 0.4rem', borderRadius: '4px'
                            }}>
                              {linkActive ? 'Link Active' : isExpired ? 'Expired' : 'Closed'}
                            </span>

                            {/* Copy link */}
                            <button onClick={() => copySessionLink(link.token)} style={{
                              padding: '0.25rem 0.6rem', background: '#e0f2fe', color: '#0369a1',
                              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600'
                            }}>
                              {linkCopied === link.token ? 'Copied!' : 'Copy Link'}
                            </button>

                            {/* Close session */}
                            {linkActive && (
                              <button onClick={() => closeSession(evt)} style={{
                                padding: '0.25rem 0.6rem', background: '#FEE2E2', color: '#991B1B',
                                border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600'
                              }}>Close Session</button>
                            )}
                          </>
                        )}

                        {/* View reports */}
                        {attCount > 0 && (
                          <button onClick={() => setViewAttendance(evt)} style={{
                            padding: '0.25rem 0.6rem', background: '#0E1F56', color: 'white',
                            border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600'
                          }}>Attendance</button>
                        )}
                        {evCount > 0 && (
                          <button onClick={() => setViewEvaluation(evt)} style={{
                            padding: '0.25rem 0.6rem', background: '#0E1F56', color: 'white',
                            border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600'
                          }}>Evaluations</button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Teams Section */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0E1F56', margin: 0 }}>
              Teams
            </h3>
            <button
              onClick={() => setShowAddTeamModal(true)}
              style={{
                background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.95rem',
                boxShadow: '0 4px 12px rgba(0, 167, 157, 0.3)'
              }}
            >
              + Add Team
            </button>
          </div>

          {teams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}>👥</div>
              <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem', fontWeight: '600' }}>No teams yet</p>
              <p style={{ fontSize: '0.95rem' }}>Add your first team to get started</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {teams.map((team) => (
                <div
                  key={team.id}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0E1F56', margin: '0 0 0.5rem 0' }}>
                        {team.team_name}
                      </h4>
                      <p style={{ color: '#6b7280', fontSize: '0.95rem', margin: 0 }}>
                        {team.agency_name}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => navigate(`/admin/smartie-goals/${team.id}`)}
                        style={{
                          background: '#0E1F56',
                          color: 'white',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Goals
                      </button>
                      <button
                        onClick={() => navigate(`/admin/pdsa/${team.id}`)}
                        style={{
                          background: '#0E1F56',
                          color: 'white',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        PDSA
                      </button>
                      <button
                        onClick={() => navigate(`/admin/sts-pat/${team.id}`)}
                        style={{
                          background: '#0E1F56',
                          color: 'white',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        STS-PAT
                      </button>
                      <button
                        onClick={() => navigate(`/admin/team-report/${team.id}`)}
                        style={{
                          background: '#00A79D',
                          color: 'white',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        View Report
                      </button>
                      <button
                        onClick={() => setInviteTeam(team)}
                        style={{
                          background: 'white',
                          color: '#0E1F56',
                          border: '2px solid #0E1F56',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        + Invite Leader
                      </button>
                    </div>
                  </div>

                  {team.contact_name && (
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#6b7280' }}>
                      <strong>Contact:</strong> {team.contact_name}
                      {team.contact_email && ` (${team.contact_email})`}
                    </div>
                  )}

                  {teamLeaders[team.id]?.length > 0 && (
                    <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#6b7280' }}>
                      <strong>Team Leaders:</strong>{' '}
                      {teamLeaders[team.id].map((l, i) => (
                        <span key={l.id}>
                          {i > 0 && ', '}
                          {l.full_name || l.email}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                    gap: '1rem',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    {team.team_codes && team.team_codes.map((code) => (
                      <div
                        key={code.id}
                        style={{
                          background: '#f9fafb',
                          padding: '1rem',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb'
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                          {getTimepointLabel(code.timepoint)}
                        </div>
                        <div style={{ 
                          fontSize: '1.125rem', 
                          fontWeight: '700', 
                          color: '#0E1F56',
                          fontFamily: 'monospace',
                          marginBottom: '0.75rem',
                          letterSpacing: '0.05em'
                        }}>
                          {code.code}
                        </div>
                        <button
                          onClick={() => copyToClipboard(code.code)}
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: 'none',
                            padding: '0.375rem 0.75rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}
                        >
                          📋 Copy Code
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attendance Report Modal */}
      {viewAttendance && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }} onClick={() => setViewAttendance(null)}>
          <div style={{
            background: 'white', borderRadius: '0.75rem', padding: '1.5rem',
            maxWidth: '1000px', width: '100%', maxHeight: '85vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <AttendanceReport
              eventId={viewAttendance.id}
              eventTitle={viewAttendance.title}
              eventDate={viewAttendance.event_date}
              collaborativeName={collaborative?.name}
              onClose={() => setViewAttendance(null)}
            />
          </div>
        </div>
      )}

      {/* Evaluation Report Modal */}
      {viewEvaluation && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }} onClick={() => setViewEvaluation(null)}>
          <div style={{
            background: 'white', borderRadius: '0.75rem', padding: '1.5rem',
            maxWidth: '900px', width: '100%', maxHeight: '85vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <EvaluationReport
              eventId={viewEvaluation.id}
              eventTitle={viewEvaluation.title}
              onClose={() => setViewEvaluation(null)}
            />
          </div>
        </div>
      )}

      {/* Add Team Modal */}
      {showAddTeamModal && (
        <AddTeamModal
          collaborativeId={id}
          onClose={() => setShowAddTeamModal(false)}
          onSuccess={handleAddTeamSuccess}
        />
      )}

      {/* Invite Team Leader Modal */}
      {inviteTeam && (
        <InviteTeamLeaderModal
          teamId={inviteTeam.id}
          teamName={inviteTeam.agency_name || inviteTeam.team_name}
          onClose={() => setInviteTeam(null)}
          onSuccess={() => fetchTeamLeaders()}
        />
      )}
    </div>
  )
}