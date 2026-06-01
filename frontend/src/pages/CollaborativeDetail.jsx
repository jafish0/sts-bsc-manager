import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import AddTeamModal from '../components/AddTeamModal'
import InviteTeamLeaderModal from '../components/InviteTeamLeaderModal'
import AttendanceReport from '../components/AttendanceReport'
import EvaluationReport from '../components/EvaluationReport'
import QrCodeModal from '../components/QrCodeModal'
import RegistrationLinkModal from '../components/RegistrationLinkModal'
import RegistrationRosterModal from '../components/RegistrationRosterModal'
import { PROGRAM_TYPE_COLORS, getProgramBranding } from '../config/programConfig'
import ctacLogo from '../assets/CTAC_white.png'

const EVENT_TYPES = [
  { value: 'learning_session', label: 'Learning Session', audience: 'all_teams' },
  { value: 'all_team_call', label: 'All-Team Call', audience: 'all_teams' },
  { value: 'senior_leader_call', label: 'Senior Leader Call', audience: 'senior_leaders' },
  { value: 'team_consultation', label: 'Team Consultation', audience: 'individual_team' },
  { value: 'assessment_window', label: 'Assessment Window', audience: 'all_teams' },
  { value: 'other', label: 'Other', audience: 'all_teams' }
]

// Compute the local time at which the pg_cron job will auto-close this session
// (event_date + end_time + 30 minutes, interpreted in the event's stored timezone).
// Returns a short human-readable label like "5:30pm" or "5:30pm tomorrow".
function formatAutoClose(evt) {
  if (!evt?.end_time || !evt?.event_date) return ''
  const closeAt = new Date(`${evt.event_date}T${evt.end_time}`)
  closeAt.setMinutes(closeAt.getMinutes() + 30)
  const opts = { hour: 'numeric', minute: '2-digit', hour12: true }
  const time = closeAt.toLocaleTimeString('en-US', opts).replace(' ', '').toLowerCase()
  const today = new Date()
  const sameDay = closeAt.toDateString() === today.toDateString()
  if (sameDay) return `at ${time}`
  // Different day — render the short date too.
  const date = closeAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `at ${time} on ${date}`
}

export default function CollaborativeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canAdminCollaborative } = useAuth()
  // True if the current user can administer THIS collaborative (super_admin
  // OR a trainer assigned to it via collaborative_trainers).
  const isAdminHere = canAdminCollaborative(id)
  const [collaborative, setCollaborative] = useState(null)
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddTeamModal, setShowAddTeamModal] = useState(false)
  const [inviteTeam, setInviteTeam] = useState(null)
  const [teamLeaders, setTeamLeaders] = useState({})
  const [trainers, setTrainers] = useState([])  // [{ user_id, full_name, email, is_coordinator }]
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
    start_time: '', end_time: '', location: 'Virtual', zoom_link: ''
  })
  // Inline edit panel for an existing event row.
  // Holds a single event id whose form is currently expanded; null = none open.
  const [editingEventId, setEditingEventId] = useState(null)
  const [editingEventDraft, setEditingEventDraft] = useState(null)
  const [savingEvent, setSavingEvent] = useState(false)

  // Team rosters (full member list per team) — shown in a collapsible section
  // below the Teams card so Dr. Sprang can grab emails fast during sessions.
  const [teamMembers, setTeamMembers] = useState({}) // { team_id: [{id, full_name, email, role}, ...] }
  const [showAllRosters, setShowAllRosters] = useState(false)
  const [expandedRosterTeamIds, setExpandedRosterTeamIds] = useState(new Set())
  const [copiedEmail, setCopiedEmail] = useState(null)

  // Registration links state — Create lives on /admin/registrations now;
  // CollaborativeDetail keeps the per-collab list + Edit + View Roster.
  const [registrationLinks, setRegistrationLinks] = useState([])
  const [showRegistrationModal, setShowRegistrationModal] = useState(false)
  const [editingLink, setEditingLink] = useState(null)
  const [viewingRosterFor, setViewingRosterFor] = useState(null) // { id, title }

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
    fetchTeamMembers()
    fetchEvents()
    fetchTrainers()
    fetchRegistrationLinks()
  }, [id])

  // Pull every active member of every team in this collab, so the Team
  // Rosters section can render with one fetch.
  const fetchTeamMembers = async () => {
    const { data: collabTeams } = await supabase
      .from('teams').select('id').eq('collaborative_id', id)
    if (!collabTeams?.length) { setTeamMembers({}); return }
    const teamIds = collabTeams.map(t => t.id)
    const { data: members } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, team_id, role, agency_role, is_active')
      .in('team_id', teamIds)
      .eq('is_active', true)
      .order('full_name')
    const grouped = {}
    ;(members || []).forEach(m => {
      if (!grouped[m.team_id]) grouped[m.team_id] = []
      grouped[m.team_id].push(m)
    })
    setTeamMembers(grouped)
  }

  const toggleRosterTeam = (teamId) => {
    setExpandedRosterTeamIds(prev => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId); else next.add(teamId)
      return next
    })
  }

  const copyEmailToClipboard = async (email) => {
    try {
      await navigator.clipboard.writeText(email)
      setCopiedEmail(email)
      setTimeout(() => setCopiedEmail(null), 2000)
    } catch (err) {
      console.warn('Clipboard write failed:', err)
    }
  }

  // Pull all registration links + status counts for this collaborative.
  const fetchRegistrationLinks = async () => {
    const { data: links } = await supabase
      .from('event_registration_links')
      .select('*')
      .eq('collaborative_id', id)
      .order('created_at', { ascending: false })
    if (!links || links.length === 0) { setRegistrationLinks([]); return }
    // Counts by status, per link
    const linkIds = links.map(l => l.id)
    const { data: regs } = await supabase
      .from('event_registrations')
      .select('registration_link_id, status')
      .in('registration_link_id', linkIds)
    const counts = {}
    ;(regs || []).forEach(r => {
      if (!counts[r.registration_link_id]) counts[r.registration_link_id] = { registered: 0, waitlisted: 0, cancelled: 0, checked_in: 0 }
      counts[r.registration_link_id][r.status] = (counts[r.registration_link_id][r.status] || 0) + 1
    })
    setRegistrationLinks(links.map(l => ({ ...l, counts: counts[l.id] || { registered: 0, waitlisted: 0, cancelled: 0, checked_in: 0 } })))
  }

  // (Roster fetch / promote / cancel / CSV export now live in
  // RegistrationRosterModal — see frontend/src/components/RegistrationRosterModal.jsx)

  // Fetch CTAC trainers + coordinator assigned to this collaborative.
  const fetchTrainers = async () => {
    const { data, error } = await supabase
      .from('collaborative_trainers')
      .select('user_id, is_coordinator, user_profiles(full_name, email)')
      .eq('collaborative_id', id)
    if (error) {
      console.error('Failed to load trainers:', error)
      return
    }
    setTrainers((data || []).map(r => ({
      user_id: r.user_id,
      is_coordinator: r.is_coordinator,
      full_name: r.user_profiles?.full_name || 'Unknown',
      email: r.user_profiles?.email || '',
    })))
  }

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

  const [evalLinkCopied, setEvalLinkCopied] = useState(null)
  // { url, title, subtitle, filename } | null — drives the QR code modal
  const [qrModal, setQrModal] = useState(null)

  const copySessionLink = async (token) => {
    const url = `https://bsc.ctac.app/session/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(token)
      setTimeout(() => setLinkCopied(null), 2000)
    } catch (err) {
      alert('Failed to copy link')
    }
  }

  const copyEvalLink = async (token) => {
    const url = `https://bsc.ctac.app/session/${token}/eval`
    try {
      await navigator.clipboard.writeText(url)
      setEvalLinkCopied(token)
      setTimeout(() => setEvalLinkCopied(null), 2000)
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
        zoom_link: newEvent.zoom_link?.trim() || null,
        audience: typeInfo?.audience || 'all_teams',
        sequence_number: newEvent.event_type === 'learning_session' ? lsCount + 1 : null
      })
    if (error) { alert('Error adding event: ' + error.message); return }
    setShowAddEvent(false)
    setNewEvent({ event_type: 'learning_session', title: '', event_date: '', start_time: '', end_time: '', location: 'Virtual', zoom_link: '' })
    fetchEvents()
  }

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event?')) return
    const { error } = await supabase.from('bsc_events').delete().eq('id', eventId)
    if (error) { alert('Error: ' + error.message); return }
    setEvents(prev => prev.filter(e => e.id !== eventId))
  }

  const startEditingEvent = (evt) => {
    setEditingEventId(evt.id)
    setEditingEventDraft({
      event_type: evt.event_type,
      title: evt.title || '',
      event_date: evt.event_date || '',
      start_time: evt.start_time ? evt.start_time.slice(0, 5) : '',
      end_time: evt.end_time ? evt.end_time.slice(0, 5) : '',
      location: evt.location || '',
      zoom_link: evt.zoom_link || '',
    })
  }

  const cancelEditingEvent = () => {
    setEditingEventId(null)
    setEditingEventDraft(null)
  }

  const saveEditedEvent = async () => {
    if (!editingEventId || !editingEventDraft) return
    setSavingEvent(true)
    const updates = {
      event_type: editingEventDraft.event_type,
      title: editingEventDraft.title.trim(),
      event_date: editingEventDraft.event_date,
      start_time: editingEventDraft.start_time || null,
      end_time: editingEventDraft.end_time || null,
      location: editingEventDraft.location?.trim() || null,
      zoom_link: editingEventDraft.zoom_link?.trim() || null,
    }
    const { data, error } = await supabase
      .from('bsc_events')
      .update(updates)
      .eq('id', editingEventId)
      .select()
      .single()
    setSavingEvent(false)
    if (error) { alert('Could not save event: ' + error.message); return }
    setEvents(prev => prev.map(e => e.id === editingEventId ? { ...e, ...data } : e))
    cancelEditingEvent()
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
              {(() => {
                const ptc = PROGRAM_TYPE_COLORS[collaborative.program_type] || PROGRAM_TYPE_COLORS.sts_bsc
                return (
                  <span style={{
                    background: ptc.bg, color: ptc.color,
                    padding: '0.25rem 0.75rem', borderRadius: '12px',
                    fontSize: '0.75rem', fontWeight: '700'
                  }}>{ptc.label}</span>
                )
              })()}
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

            {isAdminHere && (!isEditing ? (
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
            ))}
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
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Coordinator</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#0E1F56' }}>
                    {(() => {
                      const c = trainers.find(t => t.is_coordinator)
                      return c
                        ? <span>{c.full_name}<span style={{ fontWeight: 400, fontSize: '0.85rem', color: '#6b7280' }}> ({c.email})</span></span>
                        : <span style={{ fontWeight: 400, color: '#9ca3af', fontStyle: 'italic' }}>None assigned</span>
                    })()}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Trainers</div>
                  <div style={{ fontSize: '0.95rem', color: '#0E1F56' }}>
                    {trainers.length > 0
                      ? trainers.map(t => t.full_name).join(', ')
                      : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>None assigned</span>}
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
            {isAdminHere && (
              <button onClick={() => setShowAddEvent(!showAddEvent)} style={{
                background: showAddEvent ? '#e5e7eb' : 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
                color: showAddEvent ? '#374151' : 'white',
                padding: '0.625rem 1.25rem', borderRadius: '8px', border: 'none',
                fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem'
              }}>{showAddEvent ? 'Cancel' : '+ Add Event'}</button>
            )}
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
              <input type="url" value={newEvent.zoom_link} onChange={(e) => setNewEvent({ ...newEvent, zoom_link: e.target.value })}
                placeholder="Zoom link (optional) — https://zoom.us/j/..."
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.75rem', boxSizing: 'border-box' }} />
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
                // Events that need sign-in / sign-out / evaluation tracking.
                // Includes Learning Sessions (the multi-hour intensives) plus
                // the shorter Learning Calls (all-team and senior-leader),
                // which CTAC also tracks attendance for. assessment_window,
                // team_consultation, and 'other' don't get session links.
                const hasSignIn = isLS
                  || evt.event_type === 'all_team_call'
                  || evt.event_type === 'senior_leader_call'
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
                        {evt.zoom_link && (
                          <a
                            href={evt.zoom_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: '#2563eb', color: 'white', textDecoration: 'none',
                              padding: '0.15rem 0.5rem', borderRadius: '4px',
                              fontSize: '0.7rem', fontWeight: '600',
                            }}
                          >🎦 Join Zoom</a>
                        )}
                        {hasSignIn && attCount > 0 && (
                          <span style={{ background: '#d1fae5', color: '#166534', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>
                            {attCount} attended
                          </span>
                        )}
                        {hasSignIn && evCount > 0 && (
                          <span style={{ background: '#EFF6FF', color: '#1E40AF', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>
                            {evCount} evals
                          </span>
                        )}
                      </div>
                      {isAdminHere && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => editingEventId === evt.id ? cancelEditingEvent() : startEditingEvent(evt)}
                            style={{
                              background: 'none', border: 'none',
                              color: editingEventId === evt.id ? '#6b7280' : '#0E1F56',
                              cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                            }}
                          >{editingEventId === evt.id ? 'Cancel' : 'Edit'}</button>
                          <button onClick={() => handleDeleteEvent(evt.id)} style={{
                            background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem'
                          }}>Delete</button>
                        </div>
                      )}
                    </div>

                    {/* Inline edit panel — admins only, one row at a time */}
                    {editingEventId === evt.id && editingEventDraft && (
                      <div style={{
                        marginTop: '0.5rem', padding: '0.75rem',
                        background: '#f9fafb', border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <select
                            value={editingEventDraft.event_type}
                            onChange={(e) => setEditingEventDraft(d => ({ ...d, event_type: e.target.value }))}
                            style={{ padding: '0.4rem', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '0.8rem' }}
                          >
                            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <input
                            type="text"
                            value={editingEventDraft.title}
                            onChange={(e) => setEditingEventDraft(d => ({ ...d, title: e.target.value }))}
                            placeholder="Event title"
                            style={{ padding: '0.4rem', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '0.8rem' }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input type="date" value={editingEventDraft.event_date}
                            onChange={(e) => setEditingEventDraft(d => ({ ...d, event_date: e.target.value }))}
                            style={{ padding: '0.4rem', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '0.8rem' }} />
                          <input type="time" value={editingEventDraft.start_time}
                            onChange={(e) => setEditingEventDraft(d => ({ ...d, start_time: e.target.value }))}
                            style={{ padding: '0.4rem', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '0.8rem' }} />
                          <input type="time" value={editingEventDraft.end_time}
                            onChange={(e) => setEditingEventDraft(d => ({ ...d, end_time: e.target.value }))}
                            style={{ padding: '0.4rem', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '0.8rem' }} />
                          <input type="text" value={editingEventDraft.location}
                            onChange={(e) => setEditingEventDraft(d => ({ ...d, location: e.target.value }))}
                            placeholder="Location"
                            style={{ padding: '0.4rem', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '0.8rem' }} />
                        </div>
                        <input
                          type="url"
                          value={editingEventDraft.zoom_link}
                          onChange={(e) => setEditingEventDraft(d => ({ ...d, zoom_link: e.target.value }))}
                          placeholder="🎦 Zoom link — paste https://zoom.us/j/... (leave blank to remove)"
                          style={{ width: '100%', padding: '0.4rem', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '0.8rem', boxSizing: 'border-box', marginBottom: '0.5rem' }}
                        />
                        <button
                          onClick={saveEditedEvent}
                          disabled={savingEvent}
                          style={{
                            background: '#00A79D', color: 'white', border: 'none', borderRadius: '4px',
                            padding: '0.4rem 1rem', cursor: savingEvent ? 'wait' : 'pointer',
                            fontWeight: '600', fontSize: '0.8rem',
                          }}
                        >{savingEvent ? 'Saving…' : 'Save changes'}</button>
                      </div>
                    )}

                    {/* Session management controls for Learning Sessions + Learning Calls */}
                    {hasSignIn && (
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

                            {/* Copy sign-in link */}
                            <button onClick={() => copySessionLink(link.token)} style={{
                              padding: '0.25rem 0.6rem', background: '#e0f2fe', color: '#0369a1',
                              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600'
                            }}>
                              {linkCopied === link.token ? 'Copied!' : 'Copy Sign-In Link'}
                            </button>

                            {/* Sign-in QR */}
                            <button
                              onClick={() => setQrModal({
                                url: `https://bsc.ctac.app/session/${link.token}`,
                                title: 'Sign-In QR Code',
                                subtitle: `${evt.title} · ${evt.event_date}`,
                                filename: `signin_${evt.event_date}_${evt.title}`,
                              })}
                              title="Show downloadable QR code for the sign-in link"
                              style={{
                                padding: '0.25rem 0.5rem', background: '#e0f2fe', color: '#0369a1',
                                border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer',
                                fontSize: '0.7rem', fontWeight: '600',
                              }}
                            >📱 QR</button>

                            {/* Copy eval & sign-out link */}
                            <button onClick={() => copyEvalLink(link.token)} style={{
                              padding: '0.25rem 0.6rem', background: '#FEF3C7', color: '#92400E',
                              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600'
                            }}>
                              {evalLinkCopied === link.token ? 'Copied!' : 'Copy Eval & Sign-Out Link'}
                            </button>

                            {/* Eval QR */}
                            <button
                              onClick={() => setQrModal({
                                url: `https://bsc.ctac.app/session/${link.token}/eval`,
                                title: 'Evaluation & Sign-Out QR Code',
                                subtitle: `${evt.title} · ${evt.event_date}`,
                                filename: `eval_${evt.event_date}_${evt.title}`,
                              })}
                              title="Show downloadable QR code for the evaluation/sign-out link"
                              style={{
                                padding: '0.25rem 0.5rem', background: '#FEF3C7', color: '#92400E',
                                border: '1px solid #fde68a', borderRadius: '4px', cursor: 'pointer',
                                fontSize: '0.7rem', fontWeight: '600',
                              }}
                            >📱 QR</button>

                            {/* Close session — auto-closes at end_time + 30 min via pg_cron */}
                            {linkActive && (
                              <>
                                <button
                                  onClick={() => closeSession(evt)}
                                  title={evt.end_time
                                    ? `Auto-closes ${formatAutoClose(evt)} (${evt.timezone || 'America/New_York'}). Click to close now.`
                                    : 'No end time set — auto-close disabled. Click to close now.'}
                                  style={{
                                    padding: '0.25rem 0.6rem', background: '#FEE2E2', color: '#991B1B',
                                    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600'
                                  }}
                                >Close now</button>
                                <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                                  {evt.end_time
                                    ? `auto-closes ${formatAutoClose(evt)}`
                                    : 'no auto-close (set end time)'}
                                </span>
                              </>
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

        {/* Registrations Section (admin-only) */}
        {isAdminHere && (
          <div style={{
            background: 'white', borderRadius: '12px', padding: '2rem',
            marginBottom: '2rem', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0E1F56', margin: 0 }}>
                📝 Registrations
              </h3>
              <button
                onClick={() => navigate('/admin/registrations')}
                style={{
                  background: 'transparent',
                  color: '#0E1F56',
                  border: '1px solid #0E1F56',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
                title="Create new links from the central Registrations page"
              >Manage all registrations →</button>
            </div>

            {registrationLinks.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                No registration links for this collaborative yet. Create one from the <a onClick={() => navigate('/admin/registrations')} style={{ color: '#0E1F56', cursor: 'pointer', textDecoration: 'underline' }}>Registrations admin page</a>.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {registrationLinks.map(link => {
                  const c = link.counts
                  const status = !link.is_active
                    ? { label: 'Closed', color: '#991b1b', bg: '#fee2e2' }
                    : (link.registration_opens_at && new Date(link.registration_opens_at) > new Date())
                      ? { label: 'Pre-open', color: '#92400e', bg: '#fef3c7' }
                      : (link.registration_closes_at && new Date(link.registration_closes_at) < new Date())
                        ? { label: 'Closed', color: '#991b1b', bg: '#fee2e2' }
                        : { label: 'Active', color: '#166534', bg: '#dcfce7' }
                  const shareUrl = `https://bsc.ctac.app/register/${link.token}`
                  return (
                    <div key={link.id} style={{
                      padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px',
                      display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'flex-start'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <strong style={{ color: '#0E1F56', fontSize: '1rem' }}>{link.title}</strong>
                          <span style={{ background: status.bg, color: status.color, padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>{status.label}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span><strong style={{ color: '#166534' }}>{c.registered}</strong> registered</span>
                          {c.waitlisted > 0 && <span><strong style={{ color: '#92400e' }}>{c.waitlisted}</strong> waitlisted</span>}
                          {c.cancelled > 0 && <span><strong style={{ color: '#6b7280' }}>{c.cancelled}</strong> cancelled</span>}
                          {c.checked_in > 0 && <span><strong style={{ color: '#0E1F56' }}>{c.checked_in}</strong> checked in</span>}
                          {link.capacity != null && <span>· capacity {link.capacity}</span>}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                          <code>{shareUrl}</code>
                          <button
                            onClick={() => navigator.clipboard.writeText(shareUrl)}
                            style={{ background: 'transparent', border: 'none', color: '#0E1F56', cursor: 'pointer', fontSize: '0.72rem', marginLeft: '0.5rem' }}
                          >Copy</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <button onClick={() => setViewingRosterFor({ id: link.id, title: link.title })} style={{ background: '#0E1F56', color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>View Roster</button>
                        <button onClick={() => { setEditingLink(link); setShowRegistrationModal(true) }} style={{ background: 'transparent', color: '#0E1F56', border: '1px solid #0E1F56', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>Edit</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

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
            {isAdminHere && (
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
            )}
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
                      {getProgramBranding(collaborative?.program_type).hasStsPat && (
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
                      )}
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
                      {isAdminHere && (
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
                      )}
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

        {/* Team Rosters — collapsible, all teams in this collab with leaders + members + emails + copy buttons */}
        {teams.length > 0 && (
          <div style={{
            background: 'white', borderRadius: '12px', padding: '2rem',
            marginTop: '2rem', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <button
              onClick={() => setShowAllRosters(s => !s)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0E1F56', margin: 0 }}>
                  👥 Team Rosters
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Quick lookup for leader + member emails across all {teams.length} team{teams.length === 1 ? '' : 's'}.
                </div>
              </div>
              <span style={{ fontSize: '1.4rem', color: '#0E1F56', transform: showAllRosters ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▶</span>
            </button>

            {showAllRosters && (
              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {teams.map(team => {
                  const isOpen = expandedRosterTeamIds.has(team.id)
                  const leaders = teamLeaders[team.id] || []
                  const allMembers = teamMembers[team.id] || []
                  // Members minus those already shown as leaders.
                  const leaderIds = new Set(leaders.map(l => l.id))
                  const otherMembers = allMembers.filter(m => !leaderIds.has(m.id))
                  const totalCount = leaders.length + otherMembers.length

                  return (
                    <div key={team.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb' }}>
                      <button
                        onClick={() => toggleRosterTeam(team.id)}
                        style={{
                          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.75rem 1rem', textAlign: 'left',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#0E1F56' }}>{team.team_name || team.agency_name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{team.agency_name} · {totalCount} {totalCount === 1 ? 'person' : 'people'}</div>
                        </div>
                        <span style={{ color: '#0E1F56', fontSize: '1.1rem', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▶</span>
                      </button>

                      {isOpen && (
                        <div style={{ padding: '0 1rem 1rem' }}>
                          {leaders.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0E1F56', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>Leaders</div>
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {leaders.map(l => (
                                  <RosterRow key={l.id} person={l} copiedEmail={copiedEmail} onCopy={copyEmailToClipboard} />
                                ))}
                              </ul>
                            </div>
                          )}
                          {otherMembers.length > 0 && (
                            <div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0E1F56', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>Members</div>
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {otherMembers.map(m => (
                                  <RosterRow key={m.id} person={m} copiedEmail={copiedEmail} onCopy={copyEmailToClipboard} />
                                ))}
                              </ul>
                            </div>
                          )}
                          {totalCount === 0 && (
                            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>No members yet.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
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

      {/* QR Code Modal */}
      {qrModal && (
        <QrCodeModal
          url={qrModal.url}
          title={qrModal.title}
          subtitle={qrModal.subtitle}
          filename={qrModal.filename}
          onClose={() => setQrModal(null)}
        />
      )}

      {/* Registration Link create/edit modal */}
      {showRegistrationModal && (
        <RegistrationLinkModal
          collaborativeId={id}
          eventsForCollab={events}
          editingLink={editingLink}
          onClose={() => { setShowRegistrationModal(false); setEditingLink(null) }}
          onSaved={() => { fetchRegistrationLinks() }}
        />
      )}

      {/* Roster modal — extracted into shared component */}
      {viewingRosterFor && (
        <RegistrationRosterModal
          linkId={viewingRosterFor.id}
          linkTitle={viewingRosterFor.title}
          onClose={() => setViewingRosterFor(null)}
          onChange={fetchRegistrationLinks}
        />
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

// Roster row used by the Team Rosters card. Shows name + email + 📋 copy button.
function RosterRow({ person, copiedEmail, onCopy }) {
  const isCopied = copiedEmail === person.email
  return (
    <li style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto',
      gap: '0.5rem', alignItems: 'center',
      padding: '0.4rem 0.5rem', borderBottom: '1px solid #e5e7eb', background: 'white',
    }}>
      <div>
        <div style={{ fontSize: '0.88rem', color: '#0E1F56', fontWeight: 500 }}>{person.full_name || '—'}</div>
        {person.email && (
          <a href={`mailto:${person.email}`} style={{ fontSize: '0.78rem', color: '#6b7280', textDecoration: 'none' }}>
            {person.email}
          </a>
        )}
      </div>
      <span style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'capitalize' }}>
        {(person.role || '').replace('_', ' ')}
      </span>
      {person.email ? (
        <button
          onClick={() => onCopy(person.email)}
          title="Copy email"
          style={{
            background: isCopied ? '#dcfce7' : '#e0f2fe',
            color: isCopied ? '#166534' : '#0369a1',
            border: 'none', padding: '0.3rem 0.6rem', borderRadius: '6px',
            cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap',
          }}
        >{isCopied ? '✓ Copied' : '📋 Copy'}</button>
      ) : <span />}
    </li>
  )
}