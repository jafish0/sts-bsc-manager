import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../utils/supabase'
import AddTeamModal from '../components/AddTeamModal'
import ctacLogo from '../assets/UKCTAC_logoasuite_web__primary_tagline_color.png'

function CollaborativeDetail() {
  const { id } = useParams()
  const [collaborative, setCollaborative] = useState(null)
  const [teams, setTeams] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAddTeamModal, setShowAddTeamModal] = useState(false)
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchCollaborative()
    fetchTeams()
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
      setEditData(data)
    } catch (error) {
      console.error('Error fetching collaborative:', error)
      setError('Failed to load collaborative')
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
            active
          )
        `)
        .eq('collaborative_id', id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setTeams(data || [])
    } catch (error) {
      console.error('Error fetching teams:', error)
    }
  }

  const handleSave = async () => {
    setError('')
    setSaving(true)

    // Validation
    if (!editData.name?.trim()) {
      setError('Collaborative name is required')
      setSaving(false)
      return
    }

    if (editData.start_date && editData.end_date && 
        new Date(editData.end_date) <= new Date(editData.start_date)) {
      setError('End date must be after start date')
      setSaving(false)
      return
    }

    try {
      const { data, error: updateError } = await supabase
        .from('collaboratives')
        .update({
          name: editData.name.trim(),
          description: editData.description?.trim() || null,
          start_date: editData.start_date || null,
          end_date: editData.end_date || null,
          baseline_start_date: editData.baseline_start_date || null,
          baseline_end_date: editData.baseline_end_date || null,
          endline_start_date: editData.endline_start_date || null,
          endline_end_date: editData.endline_end_date || null,
          followup_6mo_start_date: editData.followup_6mo_start_date || null,
          followup_6mo_end_date: editData.followup_6mo_end_date || null,
          followup_12mo_start_date: editData.followup_12mo_start_date || null,
          followup_12mo_end_date: editData.followup_12mo_end_date || null,
          status: editData.status
        })
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      setCollaborative(data)
      setIsEditing(false)
    } catch (err) {
      console.error('Error updating collaborative:', err)
      setError(err.message || 'Failed to update collaborative')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditData(collaborative)
    setIsEditing(false)
    setError('')
  }

  const handleChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddTeamSuccess = () => {
    setShowAddTeamModal(false)
    fetchTeams() // Refresh teams list
  }

  const handleSignOut = async () => {
    await signOut()
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      'active': { text: 'Active', color: '#10b981', bg: '#d1fae5' },
      'upcoming': { text: 'Upcoming', color: '#0ea5e9', bg: '#e0f2fe' },
      'completed': { text: 'Completed', color: '#6b7280', bg: '#f3f4f6' }
    }
    return statusConfig[status] || statusConfig['active']
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    alert('Code copied to clipboard!')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>Loading collaborative...</p>
      </div>
    )
  }

  if (!collaborative) {
    return (
      <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#ef4444' }}>Collaborative Not Found</h2>
          <button
            onClick={() => navigate('/collaboratives')}
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

  const statusBadge = getStatusBadge(isEditing ? editData.status : collaborative.status)

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #0E1F56 0%, #00A79D 100%)',
        color: 'white',
        padding: '1rem 2rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
             onClick={() => navigate('/collaboratives')}>
          <img 
            src={ctacLogo} 
            alt="CTAC" 
            style={{ height: '50px', width: 'auto' }}
          />
          <div>
            <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Collaborative Details</h1>
            <p style={{ fontSize: '0.875rem', margin: 0, opacity: 0.9 }}>
              View and manage collaborative information
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
              {profile?.email}
            </p>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>
              {profile?.role === 'super_admin' ? 'Super Admin' : profile?.role}
            </p>
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
              e.target.style.background = 'white'
              e.target.style.color = '#0E1F56'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)'
              e.target.style.color = 'white'
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Back Button */}
        <button
          onClick={() => navigate('/collaboratives')}
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

        {/* Main Card */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          marginBottom: '2rem'
        }}>
          {/* Header with Edit Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '2rem' }}>
            <div style={{ flex: 1 }}>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  style={{
                    fontSize: '2rem',
                    fontWeight: '700',
                    color: '#0E1F56',
                    border: '2px solid #00A79D',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                <h2 style={{ color: '#0E1F56', margin: 0, fontSize: '2rem' }}>
                  {collaborative.name}
                </h2>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginLeft: '1rem' }}>
              <span style={{
                background: statusBadge.bg,
                color: statusBadge.color,
                padding: '0.5rem 1rem',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}>
                {statusBadge.text}
              </span>
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
                <>
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
                      opacity: saving ? 0.6 : 1
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
                </>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #ef4444',
              color: '#991b1b',
              padding: '0.75rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ 
              display: 'block', 
              color: '#6b7280', 
              fontSize: '0.875rem', 
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Description
            </label>
            {isEditing ? (
              <textarea
                value={editData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#00A79D'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            ) : (
              <p style={{ color: '#374151', margin: 0, lineHeight: '1.6' }}>
                {collaborative.description || 'No description provided'}
              </p>
            )}
          </div>

          {/* Overall Dates */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
            marginBottom: '2rem',
            paddingBottom: '2rem',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <div>
              <label style={{ 
                display: 'block', 
                color: '#6b7280', 
                fontSize: '0.875rem', 
                fontWeight: '600',
                marginBottom: '0.5rem'
              }}>
                Overall Start Date
              </label>
              {isEditing ? (
                <input
                  type="date"
                  value={editData.start_date || ''}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00A79D'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              ) : (
                <p style={{ color: '#374151', fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
                  {formatDate(collaborative.start_date)}
                </p>
              )}
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                color: '#6b7280', 
                fontSize: '0.875rem', 
                fontWeight: '600',
                marginBottom: '0.5rem'
              }}>
                Overall End Date
              </label>
              {isEditing ? (
                <input
                  type="date"
                  value={editData.end_date || ''}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00A79D'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              ) : (
                <p style={{ color: '#374151', fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
                  {formatDate(collaborative.end_date)}
                </p>
              )}
            </div>
          </div>

          {/* Status (only in edit mode) */}
          {isEditing && (
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                color: '#6b7280', 
                fontSize: '0.875rem', 
                fontWeight: '600',
                marginBottom: '0.5rem'
              }}>
                Status
              </label>
              <select
                value={editData.status || 'active'}
                onChange={(e) => handleChange('status', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          )}

          {/* Assessment Timepoints */}
          <h3 style={{ color: '#0E1F56', fontSize: '1.25rem', marginBottom: '1rem' }}>
            Assessment Timepoints
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem'
          }}>
            {/* Baseline */}
            <div style={{ 
              background: '#f9fafb', 
              padding: '1.25rem', 
              borderRadius: '8px',
              borderLeft: '4px solid #00A79D'
            }}>
              <h4 style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600', marginTop: 0, marginBottom: '0.75rem' }}>
                Baseline
              </h4>
              {isEditing ? (
                <>
                  <input
                    type="date"
                    value={editData.baseline_start_date || ''}
                    onChange={(e) => handleChange('baseline_start_date', e.target.value)}
                    placeholder="Start"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      marginBottom: '0.5rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <input
                    type="date"
                    value={editData.baseline_end_date || ''}
                    onChange={(e) => handleChange('baseline_end_date', e.target.value)}
                    placeholder="End"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </>
              ) : (
                <>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>Start: {formatDate(collaborative.baseline_start_date)}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>End: {formatDate(collaborative.baseline_end_date)}</p>
                </>
              )}
            </div>

            {/* Endline */}
            <div style={{ 
              background: '#f9fafb', 
              padding: '1.25rem', 
              borderRadius: '8px',
              borderLeft: '4px solid #0E1F56'
            }}>
              <h4 style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600', marginTop: 0, marginBottom: '0.75rem' }}>
                Endline
              </h4>
              {isEditing ? (
                <>
                  <input
                    type="date"
                    value={editData.endline_start_date || ''}
                    onChange={(e) => handleChange('endline_start_date', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      marginBottom: '0.5rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <input
                    type="date"
                    value={editData.endline_end_date || ''}
                    onChange={(e) => handleChange('endline_end_date', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </>
              ) : (
                <>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>Start: {formatDate(collaborative.endline_start_date)}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>End: {formatDate(collaborative.endline_end_date)}</p>
                </>
              )}
            </div>

            {/* 6-Month Follow-up */}
            <div style={{ 
              background: '#f9fafb', 
              padding: '1.25rem', 
              borderRadius: '8px',
              borderLeft: '4px solid #10b981'
            }}>
              <h4 style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600', marginTop: 0, marginBottom: '0.75rem' }}>
                6-Month Follow-up
              </h4>
              {isEditing ? (
                <>
                  <input
                    type="date"
                    value={editData.followup_6mo_start_date || ''}
                    onChange={(e) => handleChange('followup_6mo_start_date', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      marginBottom: '0.5rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <input
                    type="date"
                    value={editData.followup_6mo_end_date || ''}
                    onChange={(e) => handleChange('followup_6mo_end_date', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </>
              ) : (
                <>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>Start: {formatDate(collaborative.followup_6mo_start_date)}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>End: {formatDate(collaborative.followup_6mo_end_date)}</p>
                </>
              )}
            </div>

            {/* 12-Month Follow-up */}
            <div style={{ 
              background: '#f9fafb', 
              padding: '1.25rem', 
              borderRadius: '8px',
              borderLeft: '4px solid #f59e0b'
            }}>
              <h4 style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600', marginTop: 0, marginBottom: '0.75rem' }}>
                12-Month Follow-up
              </h4>
              {isEditing ? (
                <>
                  <input
                    type="date"
                    value={editData.followup_12mo_start_date || ''}
                    onChange={(e) => handleChange('followup_12mo_start_date', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      marginBottom: '0.5rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <input
                    type="date"
                    value={editData.followup_12mo_end_date || ''}
                    onChange={(e) => handleChange('followup_12mo_end_date', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </>
              ) : (
                <>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>Start: {formatDate(collaborative.followup_12mo_start_date)}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>End: {formatDate(collaborative.followup_12mo_end_date)}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Teams Section */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#0E1F56', fontSize: '1.25rem', margin: 0 }}>
              Teams ({teams.length})
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
            <div style={{
              background: '#f9fafb',
              borderRadius: '8px',
              padding: '3rem',
              textAlign: 'center',
              border: '2px dashed #e5e7eb'
            }}>
              <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '1.05rem' }}>
                No teams added yet
              </p>
              <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                Add teams to this collaborative to generate assessment codes
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {teams.map((team) => (
                <div
                  key={team.id}
                  style={{
                    background: '#f9fafb',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    border: '1px solid #e5e7eb'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ color: '#0E1F56', margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>
                        {team.agency_name}
                      </h4>
                      {team.team_name && (
                        <p style={{ color: '#6b7280', margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontStyle: 'italic' }}>
                          {team.team_name}
                        </p>
                      )}
                      {team.primary_contact_name && (
                        <p style={{ color: '#6b7280', margin: '0 0 0.25rem 0', fontSize: '0.9rem' }}>
                          Contact: {team.primary_contact_name}
                        </p>
                      )}
                      {team.primary_contact_email && (
                        <p style={{ color: '#6b7280', margin: '0 0 0.25rem 0', fontSize: '0.9rem' }}>
                          Email: {team.primary_contact_email}
                        </p>
                      )}
                      {team.estimated_staff_count && (
                        <p style={{ color: '#6b7280', margin: 0, fontSize: '0.9rem' }}>
                          Staff: ~{team.estimated_staff_count}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Team Codes */}
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                    <h5 style={{ color: '#374151', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                      Assessment Codes:
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      {team.team_codes?.map((code) => (
                        <div
                          key={code.id}
                          style={{
                            background: 'white',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0 0 0.25rem 0', textTransform: 'uppercase' }}>
                              {code.timepoint.replace('_', ' ')}
                            </p>
                            <p style={{ color: '#0E1F56', fontSize: '0.9rem', fontWeight: '600', margin: 0, fontFamily: 'monospace' }}>
                              {code.code}
                            </p>
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
                            Copy
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Team Modal */}
      {showAddTeamModal && (
        <AddTeamModal
          collaborativeId={id}
          onClose={() => setShowAddTeamModal(false)}
          onSuccess={handleAddTeamSuccess}
        />
      )}
    </div>
  )
}

export default CollaborativeDetail